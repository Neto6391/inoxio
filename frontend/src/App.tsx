import { Button, Flex, Layout, Result, Spin } from "antd";
import { useEffect, useState } from "react";
import { chamar, ErroApi, guardarCsrf, SESSAO_EXPIRADA, SESSAO_TROCADA } from "./api";
import { AceiteTermos } from "./AceiteTermos";
import { Ativar } from "./Ativar";
import { EsqueciSenha, RedefinirSenha } from "./Senha";
import { Conta } from "./Conta";
import { Privacidade, Termos } from "./Documentos";
import { Auditoria } from "./Auditoria";
import { VisaoGeral } from "./Estatisticas";
import { Investigacao } from "./Investigacao";
import { Landing } from "./Landing";
import { Login } from "./Login";
import { Onboarding } from "./Onboarding";
import { Rodape } from "./Rodape";
import { Painel } from "./Painel";
import { Link, navegar, useCaminho } from "./rotas";
import type { RespostaSessao, Sessao } from "./tipos";
import { Usuarios } from "./Usuarios";

type PropsTela = { caminho: string; sessao: Sessao; aoExcluirConta: () => void };

function Tela({ caminho, sessao, aoExcluirConta }: PropsTela) {
  const investigacao = caminho.match(/^\/investigacoes\/([\w-]+)$/);
  if (investigacao) return <Investigacao id={investigacao[1]} />;
  // "/entrar" depois do login também leva ao painel.
  if (caminho === "/painel" || caminho === "/entrar") return <Painel />;
  if (caminho === "/conta") {
    // A chave muda com o aceite: reaceitar os termos nesta tela recarrega o perfil.
    const chave = sessao.usuario.termos_pendentes ? "termos-pendentes" : "termos-aceitos";
    return <Conta key={chave} aoExcluir={aoExcluirConta} />;
  }
  if (caminho === "/usuarios" && sessao.usuario.papel === "admin") {
    return <Usuarios eu={sessao.usuario.nome} />;
  }
  if (caminho === "/auditoria" && sessao.usuario.papel === "admin") return <Auditoria />;
  if (caminho === "/visao-geral" && sessao.usuario.papel === "admin") return <VisaoGeral />;
  return (
    <Result
      status="404"
      title="Página não encontrada"
      extra={<Button onClick={() => navegar("/painel")}>Voltar ao painel</Button>}
    />
  );
}

function ItemMenu({ para, ativo, children }: { para: string; ativo: boolean; children: string }) {
  return (
    <Link para={para} className={ativo ? "ativo" : undefined}>
      {children}
    </Link>
  );
}

export function App() {
  // undefined: ainda perguntando ao servidor; null: sem sessão.
  const [sessao, setSessao] = useState<Sessao | null | undefined>(undefined);
  const caminho = useCaminho();

  function entrarCom(nova: Sessao) {
    guardarCsrf(nova.csrf);
    setSessao(nova);
  }

  useEffect(() => {
    function perguntarAoServidor() {
      chamar<RespostaSessao>("/api/sessao")
        .then(({ usuario, csrf }) =>
          usuario && csrf ? entrarCom({ usuario, csrf }) : setSessao(null),
        )
        .catch(() => setSessao(null));
    }
    const expirou = () => setSessao(null);
    perguntarAoServidor();
    window.addEventListener(SESSAO_EXPIRADA, expirou);
    window.addEventListener(SESSAO_TROCADA, perguntarAoServidor);
    return () => {
      window.removeEventListener(SESSAO_EXPIRADA, expirou);
      window.removeEventListener(SESSAO_TROCADA, perguntarAoServidor);
    };
  }, []);

  async function sair() {
    try {
      await chamar("/api/logout", { metodo: "POST" });
    } catch (falha) {
      // Token velho porque outra aba entrou de novo: sai da sessão que está valendo.
      if (falha instanceof ErroApi && falha.status === 403) {
        const atual = await chamar<RespostaSessao>("/api/sessao").catch(() => null);
        if (atual?.csrf) {
          guardarCsrf(atual.csrf);
          await chamar("/api/logout", { metodo: "POST" }).catch(() => undefined);
        }
      }
    }
    setSessao(null);
    navegar("/");
  }

  if (sessao === undefined) {
    return (
      <Flex justify="center" className="login">
        <Spin />
      </Flex>
    );
  }
  // A página inicial, a ativação de conta e a troca de senha são públicas, com ou sem sessão.
  if (caminho === "/") return <Landing sessao={sessao} />;
  if (caminho === "/ativar") return <Ativar />;
  if (caminho === "/esqueci-senha") return <EsqueciSenha />;
  if (caminho === "/redefinir") return <RedefinirSenha />;
  if (caminho === "/termos") return <Termos />;
  if (caminho === "/privacidade") return <Privacidade />;
  if (sessao === null) return <Login aoEntrar={entrarCom} />;

  const admin = sessao.usuario.papel === "admin";
  return (
    <Layout className="casca">
      <Layout.Header className="topo">
        <Link para="/painel">
          <span className="marca">
            <span className="marca-simbolo">I</span>
            Inóxio
          </span>
        </Link>
        <nav className="navegacao">
          <ItemMenu
            para="/painel"
            ativo={caminho === "/painel" || caminho === "/entrar" || caminho.startsWith("/investigacoes")}
          >
            Investigações
          </ItemMenu>
          {admin && (
            <ItemMenu para="/visao-geral" ativo={caminho === "/visao-geral"}>
              Visão geral
            </ItemMenu>
          )}
          {admin && (
            <ItemMenu para="/usuarios" ativo={caminho === "/usuarios"}>
              Usuários
            </ItemMenu>
          )}
          {admin && (
            <ItemMenu para="/auditoria" ativo={caminho === "/auditoria"}>
              Auditoria
            </ItemMenu>
          )}
        </nav>
        <span className="quem">
          <Link para="/conta" className={caminho === "/conta" ? "quem-texto ativo" : "quem-texto"}>
            {sessao.usuario.nome} · {sessao.usuario.papel}
          </Link>
        </span>
        <Button onClick={sair}>Sair</Button>
      </Layout.Header>
      <Layout.Content className="conteudo">
        <Tela
          caminho={caminho}
          sessao={sessao}
          aoExcluirConta={() => {
            setSessao(null);
            navegar("/");
          }}
        />
      </Layout.Content>
      <Rodape />
      <AceiteTermos
        aberto={sessao.usuario.termos_pendentes === true}
        aoAceitar={() =>
          setSessao({ ...sessao, usuario: { ...sessao.usuario, termos_pendentes: false } })
        }
        aoSair={sair}
      />
      <Onboarding
        aberto={sessao.usuario.onboarding_visto === false && sessao.usuario.termos_pendentes !== true}
        aoTerminar={() =>
          setSessao({ ...sessao, usuario: { ...sessao.usuario, onboarding_visto: true } })
        }
      />
    </Layout>
  );
}
