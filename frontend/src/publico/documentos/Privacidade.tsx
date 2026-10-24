import { Contato, Documento, Lista, P, type PropsDoDocumento } from "./Documento";

export function Privacidade({ dentroDoApp, naJanela }: PropsDoDocumento) {
  return (
    <Documento
      dentroDoApp={dentroDoApp}
      naJanela={naJanela}
      titulo="Política de Privacidade"
      secoes={[
        {
          titulo: "1. Sobre esta política",
          corpo: (
            <P>
              Esta política explica quais dados pessoais o Inóxio trata, para quê, com quem os
              compartilha, por quanto tempo os guarda e como você exerce os seus direitos, nos
              termos da Lei Geral de Proteção de Dados (Lei 13.709/2018, a LGPD). O responsável
              pelo tratamento (controlador) é o mantenedor do Inóxio, que você pode contatar{" "}
              <Contato />.
            </P>
          ),
        },
        {
          titulo: "2. Dados que tratamos",
          corpo: (
            <Lista
              itens={[
                <>
                  <b>Conta:</b> nome de usuário, nome de exibição (se você informar), e-mail (só de
                  quem cria a conta pela página de cadastro ou o informa em Minha conta), a senha
                  guardada apenas como hash argon2id, papel (admin ou analista), datas de criação,
                  de confirmação do e-mail e de aceite destes termos.
                </>,
                <>
                  <b>Uso:</b> os indicadores que você investiga (endereços de páginas, domínios, IPs e
                  hashes de arquivos) e os resultados de cada investigação.
                </>,
                <>
                  <b>Segurança:</b> endereço IP, data e hora de logins (certos e errados), logouts,
                  cadastros, investigações, mudanças na própria conta e ações de administração, cada
                  um ligado à sessão em que aconteceu.
                </>,
                <>
                  <b>Cookie:</b> um único cookie de sessão, necessário para manter você conectado.
                  Não usamos cookies de publicidade nem de análise de navegação.
                </>,
              ]}
            />
          ),
        },
        {
          titulo: "3. Para que usamos e com qual base legal",
          corpo: (
            <Lista
              itens={[
                "Criar e manter a sua conta e fazer as investigações que você pede: execução do contrato de uso do serviço (art. 7º, V).",
                "Enviar o e-mail de ativação da conta e, quando você pede, o link para criar uma senha nova ou para confirmar um e-mail novo (com um aviso ao e-mail antigo): execução do contrato (art. 7º, V).",
                "Prevenir fraude e abuso, limitar tentativas de login e manter a trilha de auditoria: legítimo interesse do controlador e proteção dos próprios usuários (art. 7º, IX).",
                "Gerar estatísticas de uso, agregadas, para o administrador do sistema: legítimo interesse (art. 7º, IX).",
              ]}
            />
          ),
        },
        {
          titulo: "4. Com quem compartilhamos",
          corpo: (
            <>
              <P>
                Para investigar um indicador, ele é enviado a serviços de terceiros. Se você colar
                um endereço que contenha dados pessoais (um e-mail num parâmetro da URL, por
                exemplo), eles irão junto; evite.
              </P>
              <Lista
                itens={[
                  "VirusTotal e AbuseIPDB: recebem o indicador para consultar a reputação.",
                  "Groq: recebe o indicador e as evidências para a explicação gerada por IA.",
                  "Google (Gmail): envia para o seu endereço o e-mail de ativação e o de senha nova.",
                  "Hostinger: hospeda o servidor onde ficam o sistema e o banco de dados.",
                ]}
              />
              <P>
                Alguns desses serviços ficam fora do Brasil, o que caracteriza transferência
                internacional de dados (art. 33). Não vendemos dados pessoais e não os usamos para
                publicidade.
              </P>
            </>
          ),
        },
        {
          titulo: "5. Por quanto tempo guardamos",
          corpo: (
            <Lista
              itens={[
                "Conta e investigações: enquanto a conta existir.",
                "Registros de auditoria (com IP): 90 dias.",
                "Tentativas de login: 15 minutos, para o bloqueio contra força bruta.",
                "Sessão: até 1 hora sem uso ou 8 horas no total.",
                "Links de ativação e de troca de e-mail (válidos por 24 horas) e de senha nova (1 hora): apagados quando usados; os vencidos saem do banco no próximo pedido de link.",
                "Cópias de segurança do banco: 14 dias. Um dado excluído pode continuar nelas até a cópia vencer.",
              ]}
            />
          ),
        },
        {
          titulo: "6. Seus direitos",
          corpo: (
            <>
              <P>Pela LGPD (art. 18), você pode, a qualquer momento:</P>
              <Lista
                itens={[
                  "confirmar e acessar os seus dados: página Minha conta;",
                  "corrigir o nome de exibição, o e-mail e a senha: página Minha conta;",
                  "levar os seus dados (portabilidade): botão Baixar meus dados, em Minha conta;",
                  "excluir a sua conta e os dados ligados a ela: botão Excluir minha conta, em Minha conta;",
                  <>
                    corrigir outros dados, saber com quem compartilhamos e revogar o aceite: <Contato />;
                  </>,
                  "reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
                ]}
              />
              <P>
                Ao excluir a conta, os registros de auditoria continuam pelo prazo acima, mas sem o
                seu nome de usuário.
              </P>
            </>
          ),
        },
        {
          titulo: "7. Como protegemos",
          corpo: (
            <P>
              Senhas guardadas só como hash argon2id; conexão HTTPS com TLS 1.3 e troca de chaves
              pós-quântica; sessão guardada no servidor; limite de tentativas de login; acesso aos
              dados restrito ao administrador; cópias de segurança diárias com acesso restrito.
            </P>
          ),
        },
        {
          titulo: "8. Menores de idade",
          corpo: <P>O Inóxio não é destinado a menores de 18 anos.</P>,
        },
        {
          titulo: "9. Mudanças nesta política",
          corpo: (
            <P>
              Quando esta política mudar, a versão no topo muda e pediremos o seu aceite de novo no
              próximo acesso.
            </P>
          ),
        },
      ]}
    />
  );
}
