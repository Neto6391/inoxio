#!/usr/bin/env bash
# Ensaio local da borda: sobe a réplica, confere e derruba.
# Sai com 0 só se todas as conferências passarem.
set -uo pipefail
cd "$(dirname "$0")"

falhas=0
confere() { # confere "descrição" "texto esperado" "saída"
  if grep -qF -- "$2" <<<"$3"; then echo "ok    $1"; else
    echo "FALHA $1"; echo "      esperado: $2"; falhas=$((falhas + 1)); fi
}
nega() { # nega "descrição" "texto proibido" "saída"
  if grep -qF -- "$2" <<<"$3"; then
    echo "FALHA $1"; echo "      apareceu: $2"; falhas=$((falhas + 1))
  else echo "ok    $1"; fi
}
no_cliente() { docker compose exec -T cliente sh -c "$1" 2>&1; }

mkdir -p tls webroot/.well-known/acme-challenge
echo "sonda-do-ensaio" > webroot/.well-known/acme-challenge/sonda

# Dois builds falsos, com os marcadores que o Vite deixa no index.html.
SHA_A="$(printf 'a%.0s' $(seq 40))"
SHA_B="$(printf 'b%.0s' $(seq 40))"
for sha in "$SHA_A" "$SHA_B"; do
  mkdir -p "frontend/$sha/assets"
  printf '%s' '<!doctype html><head><meta name="csp-nonce" content="__CSP_NONCE__"><meta name="versao" content="__VERSAO__"></head><div id="raiz"></div>' >"frontend/$sha/index.html"
  echo "export {};" >"frontend/$sha/assets/app.js"
done
# O link aponta para o caminho de dentro do container, como o deploy faz na VPS.
ln -sfn "/home/inoxio/frontend/$SHA_A" frontend/atual

trap 'docker compose down -v >/dev/null 2>&1' EXIT
if ! docker compose up -d --quiet-pull >/dev/null; then
  echo "ENSAIO 1 REPROVADO: a réplica não subiu"; docker compose logs --tail 20; exit 1
fi
pronto=0
for _ in $(seq 1 30); do
  if no_cliente "curl -sk -o /dev/null https://172.30.99.2/" >/dev/null; then pronto=1; break; fi
  sleep 1
done
# Sem esta guarda, as conferências "nega" passariam com saída vazia.
if [ "$pronto" -ne 1 ]; then
  echo "ENSAIO 1 REPROVADO: a borda não respondeu"; docker compose logs --tail 30 borda; exit 1
fi

com_sni="$(no_cliente "curl -sk --resolve coabitante.teste:443:172.30.99.2 https://coabitante.teste/")"
confere "nome qualquer segue para o proxy coabitante" "X-Forwarded-Server" "$com_sni"
confere "o coabitante recebe o IP real pelo PROXY protocol" "X-Forwarded-For: 172.30.99.10" "$com_sni"
nega "o coabitante não vê o IP da borda" "X-Forwarded-For: 172.30.99.2" "$com_sni"

sem_sni="$(no_cliente "curl -sk -H 'X-Forwarded-For: 6.6.6.6' https://172.30.99.2/api/eco")"
confere "acesso por IP chega ao app do Inóxio" "X-Forwarded-Proto: https" "$sem_sni"
nega "acesso por IP não passa pelo proxy coabitante" "X-Forwarded-Server" "$sem_sni"
confere "o app recebe o IP real" "X-Forwarded-For: 172.30.99.10" "$sem_sni"
nega "X-Forwarded-For forjado é descartado" "6.6.6.6" "$sem_sni"

pqc="$(no_cliente "echo | openssl s_client -connect 172.30.99.2:443 -groups X25519MLKEM768")"
confere "o TLS do Inóxio negocia ML-KEM" "Negotiated TLS1.3 group: X25519MLKEM768" "$pqc"

http="$(no_cliente "curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://172.30.99.2/x")"
confere "HTTP redireciona para HTTPS" "301 https://172.30.99.2/x" "$http"

acme="$(no_cliente "curl -s http://172.30.99.2/.well-known/acme-challenge/sonda")"
confere "o desafio do Certbot é servido pela borda" "sonda-do-ensaio" "$acme"

# A página do React sai da borda, sem passar pelo app.
nonce_de() { grep -i '^content-security-policy:' <<<"$1" | grep -o "'nonce-[0-9a-f]*'" | sed "s/'nonce-//; s/'//"; }
pagina="$(no_cliente "curl -sk --http1.1 -D - https://172.30.99.2/")"
nonce="$(nonce_de "$pagina")"
confere "a página leva nonce na CSP" "'nonce-" "$pagina"
confere "o mesmo nonce vai na meta tag" "name=\"csp-nonce\" content=\"${nonce:-sem-nonce}\"" "$pagina"
confere "a CSP só aceita script próprio" "script-src 'self';" "$pagina"
confere "a página não fica em cache" "Cache-Control: no-store" "$pagina"
confere "a página leva nosniff" "X-Content-Type-Options: nosniff" "$pagina"
confere "a página diz a versão publicada" "name=\"versao\" content=\"$SHA_A\"" "$pagina"
nega "nenhum marcador fica cru (nonce)" "__CSP_NONCE__" "$pagina"
nega "nenhum marcador fica cru (versão)" "__VERSAO__" "$pagina"
nega "a página não passa pelo app" "X-Forwarded-Proto" "$pagina"
outro="$(nonce_de "$(no_cliente "curl -sk --http1.1 -D - https://172.30.99.2/")")"
if [ -n "$nonce" ] && [ -n "$outro" ] && [ "$nonce" != "$outro" ]; then
  echo "ok    nonce novo a cada resposta"
else
  echo "FALHA nonce novo a cada resposta ($nonce / $outro)"; falhas=$((falhas + 1))
fi

cabeca="$(no_cliente "curl -sk -I -o /dev/null -w '%{http_code}' https://172.30.99.2/")"
confere "HEAD na página responde 200 (monitores usam HEAD)" "200" "$cabeca"

rota="$(no_cliente "curl -sk https://172.30.99.2/investigacoes/qualquer-id")"
confere "rota do React devolve a página" 'id="raiz"' "$rota"

ativo="$(no_cliente "curl -sk --http1.1 -D - -o /dev/null https://172.30.99.2/assets/app.js")"
confere "o JavaScript sai com o tipo certo" "Content-Type: application/javascript" "$ativo"
confere "o JavaScript leva nosniff" "X-Content-Type-Options: nosniff" "$ativo"
confere "os assets ficam em cache" "immutable" "$ativo"
sumido="$(no_cliente "curl -sk -o /dev/null -w '%{http_code}' https://172.30.99.2/assets/nada.js")"
confere "asset inexistente é 404, não a página" "404" "$sumido"

api="$(no_cliente "curl -sk --http1.1 -D - https://172.30.99.2/api/eco")"
confere "a API diz a versão publicada" "X-Inoxio-Versao: $SHA_A" "$api"
nega "a versão do app não passa da borda" "velha" "$api"
quantas="$(grep -ci '^x-inoxio-versao:' <<<"$api")"
confere "um cabeçalho de versão só" "1" "$quantas"
saude="$(no_cliente "curl -sk https://172.30.99.2/saude")"
confere "/saude chega ao app" "ok" "$saude"

# O deploy só troca o link: a borda passa a servir o build novo sem recarregar.
ln -sfn "/home/inoxio/frontend/$SHA_B" frontend/atual
depois="$(no_cliente "curl -sk --http1.1 -D - https://172.30.99.2/api/eco; curl -sk https://172.30.99.2/")"
confere "depois do deploy, a API diz a versão nova" "X-Inoxio-Versao: $SHA_B" "$depois"
confere "depois do deploy, a página é a nova" "name=\"versao\" content=\"$SHA_B\"" "$depois"

limite="$(no_cliente "for i in 1 2 3 4 5 6 7 8; do curl -sk -o /dev/null -X POST https://172.30.99.2/api/login; done; curl -sk -X POST https://172.30.99.2/api/login")"
confere "login acima do limite é 429 em JSON" '{"erro":"Muitas requisições' "$limite"

docker compose stop app-falso >/dev/null 2>&1
fora="$(no_cliente "curl -sk -w ' %{http_code}' https://172.30.99.2/api/eco; curl -sk https://172.30.99.2/")"
confere "app fora: a API responde 503 em JSON" '{"erro":"O Inóxio está reiniciando. Tente de novo em instantes."} 503' "$fora"
confere "app fora: a página continua de pé" 'id="raiz"' "$fora"

echo
if [ "$falhas" -eq 0 ]; then echo "ENSAIO 1 APROVADO"; else echo "ENSAIO 1 REPROVADO: $falhas falha(s)"; fi
exit "$falhas"
