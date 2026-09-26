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

sem_sni="$(no_cliente "curl -sk -H 'X-Forwarded-For: 6.6.6.6' https://172.30.99.2/")"
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

echo
if [ "$falhas" -eq 0 ]; then echo "ENSAIO 1 APROVADO"; else echo "ENSAIO 1 REPROVADO: $falhas falha(s)"; fi
exit "$falhas"
