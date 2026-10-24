import type { ReactNode } from "react";
import { INICIO, PAGINAS, type Pagina, raizDe } from "./navegacao";
import { Link } from "./rotas";

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
export function Menu({ caminho, admin }: { caminho: string; admin: boolean }) {
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
