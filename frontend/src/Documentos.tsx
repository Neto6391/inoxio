import { Card, Flex, Typography } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { chamar } from "./api";
import { dataPorExtenso } from "./formato";
import { Rodape } from "./Rodape";
import { Link } from "./rotas";

type Secao = { titulo: string; corpo: ReactNode };
type Publico = { contato_privacidade: string; versao_termos: string };

// A versão dos termos tem uma fonte só, o servidor: é ela que decide quem precisa
// aceitar de novo.
function usePublico(): Publico | null {
  const [publico, setPublico] = useState<Publico | null>(null);
  useEffect(() => {
    chamar<Publico>("/api/publico")
      .then(setPublico)
      .catch(() => setPublico(null));
  }, []);
  return publico;
}

function Documento({ titulo, secoes }: { titulo: string; secoes: Secao[] }) {
  const publico = usePublico();
  return (
    <div className="landing">
      <header className="landing-topo">
        <Link para="/">
          <span className="marca">
            <span className="marca-simbolo">I</span>
            Inóxio
          </span>
        </Link>
      </header>
      <Card className="documento">
        <Typography.Title level={1}>{titulo}</Typography.Title>
        {publico && (
          <Typography.Text type="secondary">
            Versão de {dataPorExtenso(publico.versao_termos)}.
          </Typography.Text>
        )}
        {secoes.map((secao) => (
          <section key={secao.titulo}>
            <Typography.Title level={3}>{secao.titulo}</Typography.Title>
            {secao.corpo}
          </section>
        ))}
      </Card>
      <Rodape />
    </div>
  );
}

function P({ children }: { children: ReactNode }) {
  return <Typography.Paragraph>{children}</Typography.Paragraph>;
}

function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="lista-documento">
      {itens.map((item, posicao) => (
        <li key={posicao}>{item}</li>
      ))}
    </ul>
  );
}

function Contato() {
  const contato = usePublico()?.contato_privacidade;
  if (!contato) {
    return <>pela própria conta, na página Minha conta, ou com o administrador do sistema</>;
  }
  return (
    <>
      pela página Minha conta ou pelo e-mail <a href={`mailto:${contato}`}>{contato}</a>
    </>
  );
}

export function Privacidade() {
  return (
    <Documento
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
                  <b>Conta:</b> nome de usuário, e-mail (só de quem cria a conta pela página de
                  cadastro), a senha guardada apenas como hash argon2id, papel (admin ou analista),
                  datas de criação, de confirmação do e-mail e de aceite destes termos.
                </>,
                <>
                  <b>Uso:</b> os indicadores que você investiga (endereços de páginas, domínios, IPs e
                  hashes de arquivos) e os resultados de cada investigação.
                </>,
                <>
                  <b>Segurança:</b> endereço IP, data e hora de logins (certos e errados), logouts,
                  cadastros, investigações e ações de administração.
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
                "Enviar o e-mail de ativação da conta e, quando você pede, o link para criar uma senha nova: execução do contrato (art. 7º, V).",
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
                "Sessão: até 30 minutos sem uso ou 8 horas no total.",
                "Links de ativação (válidos por 24 horas) e de senha nova (1 hora): apagados quando usados; os vencidos saem do banco no próximo pedido de link.",
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
                  "levar os seus dados (portabilidade): botão Baixar meus dados, em Minha conta;",
                  "excluir a sua conta e os dados ligados a ela: botão Excluir minha conta, em Minha conta;",
                  <>
                    corrigir dados, saber com quem compartilhamos e revogar o aceite: <Contato />;
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

export function Termos() {
  return (
    <Documento
      titulo="Termos de Uso"
      secoes={[
        {
          titulo: "1. Aceite",
          corpo: (
            <P>
              Ao criar uma conta ou usar o Inóxio, você concorda com estes Termos e com a{" "}
              <Link para="/privacidade">Política de Privacidade</Link>. Se não concordar, não use o
              serviço.
            </P>
          ),
        },
        {
          titulo: "2. O serviço",
          corpo: (
            <P>
              O Inóxio consulta fontes públicas de reputação (VirusTotal e AbuseIPDB) sobre um
              endereço de página, domínio, IP ou hash de arquivo, calcula um veredito por regras
              fixas e usa IA para explicar o resultado. O resultado é informativo: um veredito
              &quot;sem evidência&quot; não garante que o indicador seja inofensivo, só que as
              fontes não acharam nada. A IA explica, não decide.
            </P>
          ),
        },
        {
          titulo: "3. Sua conta",
          corpo: (
            <Lista
              itens={[
                "A conta é pessoal: não compartilhe a senha.",
                "Você responde pelo que for feito com a sua conta.",
                "Informe um e-mail que seja seu: ele é usado para ativar a conta.",
              ]}
            />
          ),
        },
        {
          titulo: "4. Uso permitido",
          corpo: (
            <>
              <P>Você concorda em não:</P>
              <Lista
                itens={[
                  "usar o serviço para planejar ou apoiar ataques, fraude ou qualquer atividade ilegal;",
                  "tentar contornar limites de uso, de login ou de acesso;",
                  "automatizar consultas além das cotas da sua conta;",
                  "enviar dados pessoais de terceiros sem necessidade, por exemplo em parâmetros de URL;",
                  "atacar, sobrecarregar ou testar a segurança do sistema sem autorização por escrito.",
                ]}
              />
            </>
          ),
        },
        {
          titulo: "5. Limites e cotas",
          corpo: (
            <P>
              Cada conta tem limites de investigações por hora e por dia, que o administrador pode
              ajustar. Os limites existem para proteger o serviço e as cotas das fontes de terceiros.
            </P>
          ),
        },
        {
          titulo: "6. Serviços de terceiros",
          corpo: (
            <P>
              As consultas dependem de VirusTotal, AbuseIPDB e Groq, que têm termos próprios.
              Quando um deles fica fora do ar, o resultado sai inconclusivo. Na versão atual, o
              serviço usa planos gratuitos dessas fontes e não é oferecido comercialmente.
            </P>
          ),
        },
        {
          titulo: "7. Disponibilidade",
          corpo: (
            <P>
              O Inóxio é oferecido no estado em que se encontra, sem garantia de disponibilidade
              contínua. Podemos alterar, suspender ou encerrar funcionalidades.
            </P>
          ),
        },
        {
          titulo: "8. Suspensão e exclusão",
          corpo: (
            <P>
              Contas que violarem estes Termos podem ser desativadas. Você pode excluir a sua conta a
              qualquer momento, na página Minha conta.
            </P>
          ),
        },
        {
          titulo: "9. Responsabilidade",
          corpo: (
            <P>
              As decisões tomadas a partir de um resultado do Inóxio são de quem as toma. Na medida
              permitida pela lei, não respondemos por danos indiretos decorrentes do uso do serviço.
            </P>
          ),
        },
        {
          titulo: "10. Mudanças e lei aplicável",
          corpo: (
            <P>
              Quando estes Termos mudarem, a versão no topo muda e pediremos o seu aceite de novo.
              Estes Termos seguem a lei brasileira.
            </P>
          ),
        },
      ]}
    />
  );
}
