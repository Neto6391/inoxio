import { Button, Flex, Result, Spin } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { chamar, ErroApi, guardarCsrf, SESSAO_EXPIRADA, SESSAO_TROCADA } from "./api";
import { AceiteTermos } from "./AceiteTermos";
import { Ativar } from "./Ativar";
import { EsqueciSenha, RedefinirSenha } from "./Senha";
import { Conta } from "./Conta";
import { CreditosLateral, ehCreditos, textoCreditos } from "./Creditos";
import { Privacidade, Termos } from "./Documentos";
import { Auditoria } from "./Auditoria";
import { VisaoGeral } from "./Estatisticas";
import {
  IconeBusca,
  IconeConta,
  IconeEscudo,
  IconeGrafico,
  IconeLua,
  IconePainel,
  IconeRelogio,
  IconeSol,
  IconeUsuarios,
} from "./icones";
import { Investigacao } from "./Investigacao";
import { Investigacoes } from "./Investigacoes";
import { Landing } from "./Landing";
import { Login } from "./Login";
import { Onboarding } from "./Onboarding";
import { Rodape } from "./Rodape";
import { Painel } from "./Painel";
import { Link, navegar, useCaminho } from "./rotas";
import { definirTema, useTema } from "./tema";
import type { Creditos, RespostaSessao, Sessao } from "./tipos";
import { Usuarios } from "./Usuarios";

type PropsTela = {
  caminho: string;
  sessao: Sessao;
  creditos: Creditos | null;
  aoExcluirConta: () => void;
};

function Tela({ caminho, sessao, creditos, aoExcluirConta }: PropsTela) {
  const investigacao = caminho.match(/^\/investigacoes\/([\w-]+)$/);
  if (investigacao) return <Investigacao id={investigacao[1]} />;
  if (caminho === "/investigacoes") return <Investigacoes />;
  // "/entrar" depois do login também leva ao painel.
  if (caminho === "/painel" || caminho === "/entrar") return <Painel creditos={creditos} />;
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

type PropsItem = { para: string; ativo: boolean; icone: ReactNode; children: string };

function ItemMenu({ para, ativo, icone, children }: PropsItem) {
  return (
    <Link para={para} className={ativo ? "ativo" : undefined}>
      {icone}
      {children}
    </Link>
  );
}

function BotaoTema() {
  const tema = useTema();
  const rotulo = tema === "escuro" ? "Mudar para o modo claro" : "Mudar para o modo escuro";
  return (
    <button
      type="button"
      className="botao-tema"
      aria-label={rotulo}
      title={rotulo}
      onClick={() => definirTema(tema === "escuro" ? "claro" : "escuro")}
    >
      {tema === "escuro" ? <IconeSol /> : <IconeLua />}
    </button>
  );
}

export function App() {
  // undefined: ainda perguntando ao servidor; null: sem sessão.
  const [sessao, setSessao] = useState<Sessao | null | undefined>(undefined);
  const [creditos, setCreditos] = useState<Creditos | null>(null);
  // Sobe quando os créditos devem ser lidos de novo sem mudar de tela.
  const [releitura, setReleitura] = useState(0);
  const caminho = useCaminho();
  const nome = sessao?.usuario.nome;

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

  // A cada tela, os créditos são lidos de novo: depois de investigar, o número já mudou.
  useEffect(() => {
    if (!nome) return;
    chamar<unknown>("/api/creditos")
      .then((dados) => setCreditos(ehCreditos(dados) ? dados : null))
      .catch(() => setCreditos(null));
  }, [nome, caminho, releitura]);

  // Créditos esgotados voltam à meia-noite de Brasília; com a tela aberta, lê de novo
  // nessa hora (o servidor manda o instante em UTC, sem fuso).
  useEffect(() => {
    if (!creditos || creditos.restantes !== 0) return;
    const renova = Date.parse(/[zZ]$/.test(creditos.renova_em) ? creditos.renova_em : `${creditos.renova_em}Z`);
    if (Number.isNaN(renova)) return;
    const espera = window.setTimeout(() => setReleitura((n) => n + 1), Math.max(0, renova - Date.now()) + 1000);
    return () => window.clearTimeout(espera);
  }, [creditos]);

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
    <div className="casca">
      <aside className="lateral">
        <Link para="/painel">
          <span className="marca">
            <span className="marca-simbolo">I</span>
            Inóxio
          </span>
        </Link>
        <nav className="menu" aria-label="Menu principal">
          <ItemMenu para="/painel" icone={<IconePainel />} ativo={caminho === "/painel" || caminho === "/entrar"}>
            Painel
          </ItemMenu>
          <ItemMenu para="/investigacoes" icone={<IconeBusca />} ativo={caminho.startsWith("/investigacoes")}>
            Investigações
          </ItemMenu>
          <ItemMenu para="/conta" icone={<IconeConta />} ativo={caminho === "/conta"}>
            Minha conta
          </ItemMenu>
          {admin && <div className="menu-secao">Administração</div>}
          {admin && (
            <ItemMenu para="/visao-geral" icone={<IconeGrafico />} ativo={caminho === "/visao-geral"}>
              Visão geral
            </ItemMenu>
          )}
          {admin && (
            <ItemMenu para="/usuarios" icone={<IconeUsuarios />} ativo={caminho === "/usuarios"}>
              Usuários
            </ItemMenu>
          )}
          {admin && (
            <ItemMenu para="/auditoria" icone={<IconeEscudo />} ativo={caminho === "/auditoria"}>
              Auditoria
            </ItemMenu>
          )}
        </nav>
        {creditos && <CreditosLateral creditos={creditos} />}
      </aside>
      <div className="coluna">
        <header className="topo">
          <span className="topo-espaco" />
          {creditos && (
            <span className="pilula">
              <IconeRelogio />
              {textoCreditos(creditos)}
            </span>
          )}
          <BotaoTema />
          <Link para="/conta" className={caminho === "/conta" ? "quem ativo" : "quem"}>
            {sessao.usuario.nome} · {sessao.usuario.papel}
          </Link>
          <Button onClick={sair}>Sair</Button>
        </header>
        <main className="conteudo">
          <Tela
            caminho={caminho}
            sessao={sessao}
            creditos={creditos}
            aoExcluirConta={() => {
              setSessao(null);
              navegar("/");
            }}
          />
        </main>
        <Rodape />
      </div>
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
    </div>
  );
}
