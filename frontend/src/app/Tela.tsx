import { Button, Result } from "antd";
import type { ReactNode } from "react";
import { Auditoria } from "../administracao/auditoria/Auditoria";
import { Usuarios } from "../administracao/usuarios/Usuarios";
import { VisaoGeral } from "../administracao/VisaoGeral";
import type { Creditos, Sessao } from "../compartilhado/tipos";
import { Conta } from "../conta/Conta";
import { Investigacao } from "../investigacoes/investigacao/Investigacao";
import { Investigacoes } from "../investigacoes/Investigacoes";
import { Painel } from "../investigacoes/painel/Painel";
import { Privacidade, Termos } from "../publico/Documentos";
import { INICIO } from "./navegacao";
import { navegar } from "./rotas";

type PropsTela = {
  caminho: string;
  sessao: Sessao;
  creditos: Creditos | null;
  aoExcluirConta: () => void;
  aoMudarNome: (nome: string | null) => void;
};

// As telas só do admin: para o analista, o endereço não existe.
const DO_ADMIN: Record<string, (sessao: Sessao) => ReactNode> = {
  "/usuarios": (sessao) => <Usuarios eu={sessao.usuario.nome} />,
  "/auditoria": () => <Auditoria />,
  "/visao-geral": () => <VisaoGeral />,
};

// A tela do app logado que corresponde ao endereço.
export function Tela({ caminho, sessao, creditos, aoExcluirConta, aoMudarNome }: PropsTela) {
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
  const doAdmin = DO_ADMIN[caminho];
  if (doAdmin && sessao.usuario.papel === "admin") return doAdmin(sessao);
  return (
    <Result
      status="404"
      title="Página não encontrada"
      extra={<Button onClick={() => navegar(INICIO)}>Voltar ao início</Button>}
    />
  );
}
