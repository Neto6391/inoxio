import { Button, Flex, Layout, Result, Spin } from "antd";
import { useEffect, useState } from "react";
import { chamar, ErroApi, guardarCsrf, SESSAO_EXPIRADA, SESSAO_TROCADA } from "./api";
import { Investigacao } from "./Investigacao";
import { Login } from "./Login";
import { Painel } from "./Painel";
import { Link, navegar, useCaminho } from "./rotas";
import type { RespostaSessao, Sessao } from "./tipos";
import { Usuarios } from "./Usuarios";

function Tela({ caminho, sessao }: { caminho: string; sessao: Sessao }) {
  const investigacao = caminho.match(/^\/investigacoes\/([\w-]+)$/);
  if (investigacao) return <Investigacao id={investigacao[1]} />;
  if (caminho === "/") return <Painel />;
  if (caminho === "/usuarios" && sessao.usuario.papel === "admin") {
    return <Usuarios eu={sessao.usuario.nome} />;
  }
  return (
    <Result
      status="404"
      title="Página não encontrada"
      extra={<Button onClick={() => navegar("/")}>Voltar ao painel</Button>}
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
  if (sessao === null) return <Login aoEntrar={entrarCom} />;

  const admin = sessao.usuario.papel === "admin";
  return (
    <Layout className="casca">
      <Layout.Header className="topo">
        <Link para="/">
          <span className="marca">
            <span className="marca-simbolo">I</span>
            Inóxio
          </span>
        </Link>
        <nav className="navegacao">
          <ItemMenu para="/" ativo={caminho === "/" || caminho.startsWith("/investigacoes")}>
            Investigações
          </ItemMenu>
          {admin && (
            <ItemMenu para="/usuarios" ativo={caminho === "/usuarios"}>
              Usuários
            </ItemMenu>
          )}
        </nav>
        <span className="quem">
          <span className="quem-texto">
            {sessao.usuario.nome} · {sessao.usuario.papel}
          </span>
        </span>
        <Button onClick={sair}>Sair</Button>
      </Layout.Header>
      <Layout.Content className="conteudo">
        <Tela caminho={caminho} sessao={sessao} />
      </Layout.Content>
    </Layout>
  );
}
