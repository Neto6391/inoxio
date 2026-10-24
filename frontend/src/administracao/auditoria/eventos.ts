// A cor da etiqueta de cada tipo de evento; o nome vem do servidor, junto com o evento.
const CORES_EVENTO: Record<string, string> = {
  login: "green",
  login_falhou: "orange",
  login_bloqueado: "red",
  cadastro: "blue",
  ativacao: "blue",
  investigacao: "purple",
  investigacao_alheia: "gold",
  admin_cadastrou: "gold",
  admin_alterou: "gold",
  backup: "cyan",
  termos_aceitos: "blue",
  conta_excluida: "red",
  explicacao_pedida: "purple",
  conta_alterada: "blue",
  email_trocado: "blue",
};

export function etiquetaDoEvento(evento: EventoDaSessao) {
  return { texto: evento.nome ?? evento.tipo, cor: CORES_EVENTO[evento.tipo] ?? "default" };
}

export type EventoDaSessao = { quando: string; tipo: string; nome?: string; ip: string; detalhe: string };

export type SessaoAuditada = {
  id: string;
  aproximada: boolean;
  inicio_registrado: boolean;
  inicio: string;
  fim: string | null;
  motivo_fim: string | null;
  aberta: boolean;
  expira_em?: string;
  ip: string;
  acoes: number;
  eventos: EventoDaSessao[];
};
