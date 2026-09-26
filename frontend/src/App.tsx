import { Button, Flex, Layout, Result, Spin } from "antd";
import { useEffect, useState } from "react";
import { chamar, guardarCsrf, SESSAO_EXPIRADA } from "./api";
import { Investigacao } from "./Investigacao";
import { Login } from "./Login";
import { Painel } from "./Painel";
import { Link, navegar, useCaminho } from "./rotas";
import type { RespostaSessao, Sessao } from "./tipos";

function Tela({ caminho }: { caminho: string }) {
  const investigacao = caminho.match(/^\/investigacoes\/([\w-]+)$/);
  if (investigacao) return <Investigacao id={investigacao[1]} />;
  if (caminho === "/") return <Painel />;
  return (
    <Result
      status="404"
      title="Página não encontrada"
      extra={<Button onClick={() => navegar("/")}>Voltar ao painel</Button>}
    />
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
    chamar<RespostaSessao>("/api/sessao")
      .then(({ usuario, csrf }) =>
        usuario && csrf ? entrarCom({ usuario, csrf }) : setSessao(null),
      )
      .catch(() => setSessao(null));
    const expirou = () => setSessao(null);
    window.addEventListener(SESSAO_EXPIRADA, expirou);
    return () => window.removeEventListener(SESSAO_EXPIRADA, expirou);
  }, []);

  async function sair() {
    await chamar("/api/logout", { metodo: "POST" }).catch(() => undefined);
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

  return (
    <Layout className="casca">
      <Layout.Header className="topo">
        <Link para="/">
          <span className="marca">Inóxio</span>
        </Link>
        <span className="quem">
          {sessao.usuario.nome} · {sessao.usuario.papel}
        </span>
        <Button onClick={sair}>Sair</Button>
      </Layout.Header>
      <Layout.Content className="conteudo">
        <Tela caminho={caminho} />
      </Layout.Content>
    </Layout>
  );
}
