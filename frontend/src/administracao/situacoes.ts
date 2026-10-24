// A situação de cada conta, como o servidor a calcula, com o nome e a cor da etiqueta.
export type Situacao = "ativa" | "desativada" | "aguardando" | "recusada";

export const SITUACOES: Record<Situacao, { texto: string; cor: string }> = {
  ativa: { texto: "ativa", cor: "green" },
  desativada: { texto: "desativada", cor: "red" },
  aguardando: { texto: "aguardando e-mail", cor: "orange" },
  recusada: { texto: "recusada", cor: "red" },
};
