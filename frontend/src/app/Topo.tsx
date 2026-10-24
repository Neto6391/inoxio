import { Button, Tooltip } from "antd";
import { IconeLua, IconeRelogio, IconeSol } from "../compartilhado/icones";
import type { Creditos, Sessao } from "../compartilhado/tipos";
import { dicaCreditos, textoCreditos } from "../investigacoes/Creditos";
import { Link } from "./rotas";
import { definirTema, useTema } from "./tema";

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

type Props = { caminho: string; sessao: Sessao; creditos: Creditos | null; aoSair: () => void };

export function Topo({ caminho, sessao, creditos, aoSair }: Props) {
  return (
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
      <Button onClick={aoSair}>Sair</Button>
    </header>
  );
}
