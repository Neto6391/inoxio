import { INICIO } from "../../app/navegacao";
import { navegar } from "../../app/rotas";
import { Rodape } from "../../compartilhado/Rodape";
import type { Sessao } from "../../compartilhado/tipos";
import { usePublico } from "../Documentos";
import { ChamadaFinal, ComoFunciona, Destaque, Planos, Recursos, TiposEGarantias, Topo } from "./Secoes";

export function Landing({ sessao }: { sessao: Sessao | null }) {
  const publico = usePublico();
  const contato = publico?.contato_privacidade ?? "";
  const entrar = () => navegar(sessao ? INICIO : "/entrar");
  // A tela de entrar abre direto na aba de criar conta.
  const criarConta = () => navegar(sessao ? INICIO : "/cadastro");

  return (
    <div className="pagina-inicial">
      <Topo aoEntrar={entrar} aoCriarConta={criarConta} />
      <Destaque aoCriarConta={criarConta} />
      <ComoFunciona />
      <Recursos />
      <TiposEGarantias />
      <Planos contato={contato} aoCriarConta={criarConta} />
      <ChamadaFinal aoCriarConta={criarConta} />
      <div className="pagina-largura">
        <Rodape />
      </div>
    </div>
  );
}
