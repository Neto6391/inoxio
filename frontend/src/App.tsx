import { Button, Flex, Result, Spin, Tooltip } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { chamar, ErroApi, guardarCsrf, SESSAO_EXPIRADA, SESSAO_TROCADA } from "./api";
import { AceiteTermos } from "./AceiteTermos";
import { Ativar, ConfirmarEmail } from "./Ativar";
import { EsqueciSenha, RedefinirSenha } from "./Senha";
import { Conta } from "./Conta";
import { dicaCreditos, ehCreditos, textoCreditos } from "./Creditos";
import { Privacidade, Termos } from "./Documentos";
import { Auditoria } from "./Auditoria";
import { VisaoGeral } from "./Estatisticas";
import { IconeLua, IconeRelogio, IconeSol } from "./icones";
import { Investigacao } from "./Investigacao";
import { Investigacoes } from "./Investigacoes";
import { Landing } from "./Landing";
import { Login } from "./Login";
import { Onboarding } from "./Onboarding";
import { Rodape } from "./Rodape";
import { INICIO, PAGINAS, type Pagina, Trilha, raizDe } from "./navegacao";
import { Painel } from "./Painel";
import { Link, navegar, substituir, useCaminho } from "./rotas";
import { definirTema, useTema } from "./tema";
import type { Creditos, RespostaSessao, Sessao } from "./tipos";
import { Usuarios } from "./Usuarios";

type PropsTela = {
  caminho: string;
  sessao: Sessao;
  creditos: Creditos | null;
  aoExcluirConta: () => void;
  aoMudarNome: (nome: string | null) => void;
};

function Tela({ caminho, sessao, creditos, aoExcluirConta, aoMudarNome }: PropsTela) {
  const investigacao = caminho.match(/^\/investigacoes\/([\w-]+)$/);
  if (investigacao) return <Investigacao id={investigacao[1]} />;
  if (caminho === "/investigacoes") return <Investigacoes />;
  // "/entrar" depois do login também leva ao painel.
  if (caminho === INICIO || caminho === "/entrar") return <Painel creditos={creditos} nome={sessao.usuario.nome_exibicao ?? sessao.usuario.nome} />;
  if (caminho === "/conta") {
    // A chave muda com o aceite: reaceitar os termos nesta tela recarrega o perfil.
    const chave = sessao.usuario.termos_pendentes ? "termos-pendentes" : "termos-aceitos";
    return <Conta key={chave} aoExcluir={aoExcluirConta} aoMudarNome={aoMudarNome} />;
  }
  if (caminho === "/termos") return <Termos dentroDoApp />;
  if (caminho === "/privacidade") return <Privacidade dentroDoApp />;
  if (caminho === "/usuarios" && sessao.usuario.papel === "admin") {
    return <Usuarios eu={sessao.usuario.nome} />;
  }
  if (caminho === "/auditoria" && sessao.usuario.papel === "admin") return <Auditoria />;
  if (caminho === "/visao-geral" && sessao.usuario.papel === "admin") return <VisaoGeral />;
  return (
    <Result
      status="404"
      title="Página não encontrada"
      extra={<Button onClick={() => navegar(INICIO)}>Voltar ao início</Button>}
    />
  );
}

type PropsItem = { para: string; ativo: boolean; icone: ReactNode; children: ReactNode; className?: string };

function ItemMenu({ para, ativo, icone, children, className }: PropsItem) {
  const classes = [className, ativo ? "ativo" : undefined].filter(Boolean).join(" ");
  return (
    <Link para={para} className={classes || undefined}>
      {icone}
      {children}
    </Link>
  );
}

// O menu sai do mapa das telas: as raízes em cima, e as filhas de uma raiz embaixo dela.
// A Administração abre na Visão geral e mostra as telas dela enquanto se está nela.
function Menu({ caminho, admin }: { caminho: string; admin: boolean }) {
  const doMenu = PAGINAS.filter((pagina) => pagina.icone && (admin || !pagina.admin));
  const raizAtual = raizDe(caminho);
  const ativa = (pagina: Pagina) =>
    pagina.caminho === caminho || (caminho === "/entrar" && pagina.caminho === INICIO) || (pagina.caminho !== INICIO && caminho.startsWith(`${pagina.caminho}/`));
  const geral = doMenu.filter((pagina) => !pagina.admin);
  const administracao = doMenu.find((pagina) => pagina.admin && !pagina.pai);
  const filhas = doMenu.filter((pagina) => pagina.admin && pagina.pai === administracao?.caminho);
  const aberta = administracao !== undefined && raizAtual === administracao.caminho;
  return (
    <nav className="menu" aria-label="Menu principal">
      {geral.map((pagina) => (
        <ItemMenu key={pagina.caminho} para={pagina.caminho} icone={pagina.icone} ativo={ativa(pagina)}>
          {pagina.titulo}
        </ItemMenu>
      ))}
      {administracao && (
        <div className="menu-grupo" aria-expanded={aberta}>
          <ItemMenu para={administracao.caminho} icone={administracao.icone} ativo={caminho === administracao.caminho}>
            <span className="menu-grupo-nome">Administração</span>
            <span className="menu-seta" aria-hidden="true">
              {aberta ? "▾" : "▸"}
            </span>
          </ItemMenu>
          {aberta &&
            filhas.map((pagina) => (
              <ItemMenu key={pagina.caminho} para={pagina.caminho} icone={pagina.icone} ativo={ativa(pagina)} className="submenu">
                {pagina.titulo}
              </ItemMenu>
            ))}
        </div>
      )}
    </nav>
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

  // Com sessão aberta, a página inicial pública não aparece: o logo e o "/" levam ao Início.
  // A landing e o login só voltam depois de sair ou de a sessão vencer. O endereço antigo
  // do Início (/painel), de favoritos e links, também leva ao novo.
  const naLandingLogado =
    Boolean(sessao) && (caminho === "/" || caminho === "/painel" || caminho === "/cadastro");
  useEffect(() => {
    if (naLandingLogado) substituir(INICIO);
  }, [naLandingLogado]);

  function entrarCom(nova: Sessao) {
    guardarCsrf(nova.csrf);
    setSessao(nova);
    // Quem entrou pela tela de login vai para o Início, e o endereço acompanha.
    if (["/entrar", "/cadastro"].includes(window.location.pathname)) substituir(INICIO);
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

  if (sessao === undefined || naLandingLogado) {
    return (
      <Flex justify="center" className="login">
        <Spin />
      </Flex>
    );
  }
  // A ativação de conta, a troca de senha e a confirmação de e-mail são públicas, com ou
  // sem sessão. Os documentos, logado, abrem dentro do app.
  if (caminho === "/ativar") return <Ativar />;
  if (caminho === "/confirmar-email") return <ConfirmarEmail />;
  if (caminho === "/esqueci-senha") return <EsqueciSenha />;
  if (caminho === "/redefinir") return <RedefinirSenha />;
  if (sessao === null) {
    if (caminho === "/") return <Landing sessao={null} />;
    if (caminho === "/termos") return <Termos />;
    if (caminho === "/privacidade") return <Privacidade />;
    return <Login aoEntrar={entrarCom} abaInicial={caminho === "/cadastro" ? "criar" : "entrar"} />;
  }

  const admin = sessao.usuario.papel === "admin";
  return (
    <div className="casca">
      <aside className="lateral">
        <Link para={INICIO}>
          <span className="marca">
            <span className="marca-simbolo">I</span>
            Inóxio
          </span>
        </Link>
        <Menu caminho={caminho} admin={admin} />
      </aside>
      <div className="coluna">
        <header className="topo">
          <span className="topo-espaco" />
          {creditos && (
            <Tooltip title={dicaCreditos(creditos)}>
              <span className="pilula" tabIndex={0}>
                <IconeRelogio />
                {textoCreditos(creditos)}
              </span>
            </Tooltip>
          )}
          <BotaoTema />
          <Link para="/conta" className={caminho === "/conta" ? "quem ativo" : "quem"}>
            {sessao.usuario.nome_exibicao ?? sessao.usuario.nome} · {sessao.usuario.papel}
          </Link>
          <Button onClick={sair}>Sair</Button>
        </header>
        <main className="conteudo">
          <Trilha caminho={caminho} />
          <Tela
            caminho={caminho}
            sessao={sessao}
            creditos={creditos}
            aoExcluirConta={() => {
              setSessao(null);
              navegar("/");
            }}
            aoMudarNome={(novo) =>
              setSessao({ ...sessao, usuario: { ...sessao.usuario, nome_exibicao: novo } })
            }
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
