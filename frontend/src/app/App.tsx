import { Flex, Spin } from "antd";
import { type ReactNode, useEffect } from "react";
import { AceiteTermos } from "../acesso/AceiteTermos";
import { Ativar, ConfirmarEmail } from "../acesso/Ativar";
import { Login } from "../acesso/Login";
import { Onboarding } from "../acesso/Onboarding";
import { EsqueciSenha, RedefinirSenha } from "../acesso/Senha";
import { Rodape } from "../compartilhado/Rodape";
import type { Sessao, Usuario } from "../compartilhado/tipos";
import { Privacidade, Termos } from "../publico/Documentos";
import { Landing } from "../publico/landing/Landing";
import { Menu } from "./Menu";
import { INICIO, Trilha } from "./navegacao";
import { Link, substituir, useCaminho } from "./rotas";
import { Tela } from "./Tela";
import { Topo } from "./Topo";
import { useCreditos } from "./useCreditos";
import { useSessao } from "./useSessao";

type PropsCasca = {
  caminho: string;
  sessao: Sessao;
  aoSair: () => void;
  aoEncerrar: () => void;
  aoAtualizar: (mudanca: Partial<Usuario>) => void;
};

// O app de quem está logado: menu à esquerda, topo, a tela do endereço e o rodapé.
function Casca({ caminho, sessao, aoSair, aoEncerrar, aoAtualizar }: PropsCasca) {
  const creditos = useCreditos(sessao.usuario.nome, caminho);
  return (
    <div className="casca">
      <aside className="lateral">
        <Link para={INICIO}>
          <span className="marca">
            <span className="marca-simbolo">I</span>
            Inóxio
          </span>
        </Link>
        <Menu caminho={caminho} admin={sessao.usuario.papel === "admin"} />
      </aside>
      <div className="coluna">
        <Topo caminho={caminho} sessao={sessao} creditos={creditos} aoSair={aoSair} />
        <main className="conteudo">
          <Trilha caminho={caminho} />
          <Tela
            caminho={caminho}
            sessao={sessao}
            creditos={creditos}
            aoExcluirConta={aoEncerrar}
            aoMudarNome={(novo) => aoAtualizar({ nome_exibicao: novo })}
          />
        </main>
        <Rodape />
      </div>
      <AceiteTermos
        aberto={sessao.usuario.termos_pendentes === true}
        aoAceitar={() => aoAtualizar({ termos_pendentes: false })}
        aoSair={aoSair}
      />
      <Onboarding
        aberto={sessao.usuario.onboarding_visto === false && sessao.usuario.termos_pendentes !== true}
        aoTerminar={() => aoAtualizar({ onboarding_visto: true })}
      />
    </div>
  );
}

// A ativação de conta, a troca de senha e a confirmação de e-mail são públicas, com ou
// sem sessão.
const PUBLICAS_SEMPRE: Record<string, () => ReactNode> = {
  "/ativar": () => <Ativar />,
  "/confirmar-email": () => <ConfirmarEmail />,
  "/esqueci-senha": () => <EsqueciSenha />,
  "/redefinir": () => <RedefinirSenha />,
};

export function App() {
  const { sessao, entrarCom, sair, encerrar, atualizarUsuario } = useSessao();
  const caminho = useCaminho();

  // Com sessão aberta, a página inicial pública não aparece: o logo e o "/" levam ao Início.
  // A landing e o login só voltam depois de sair ou de a sessão vencer. O endereço antigo
  // do Início (/painel), de favoritos e links, também leva ao novo.
  const naLandingLogado =
    Boolean(sessao) && (caminho === "/" || caminho === "/painel" || caminho === "/cadastro");
  useEffect(() => {
    if (naLandingLogado) substituir(INICIO);
  }, [naLandingLogado]);

  if (sessao === undefined || naLandingLogado) {
    return (
      <Flex justify="center" className="login">
        <Spin />
      </Flex>
    );
  }
  const publica = PUBLICAS_SEMPRE[caminho];
  if (publica) return publica();
  // Os documentos, logado, abrem dentro do app.
  if (sessao === null) {
    if (caminho === "/") return <Landing sessao={null} />;
    if (caminho === "/termos") return <Termos />;
    if (caminho === "/privacidade") return <Privacidade />;
    return <Login aoEntrar={entrarCom} abaInicial={caminho === "/cadastro" ? "criar" : "entrar"} />;
  }
  return (
    <Casca
      caminho={caminho}
      sessao={sessao}
      aoSair={sair}
      aoEncerrar={encerrar}
      aoAtualizar={atualizarUsuario}
    />
  );
}
