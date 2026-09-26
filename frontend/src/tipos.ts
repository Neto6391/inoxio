export type Papel = "admin" | "analista";
export type Usuario = { nome: string; papel: Papel };
export type Sessao = { usuario: Usuario; csrf: string };
// Resposta do GET /api/sessao: sem sessão, usuario e csrf vêm nulos (status 200).
export type RespostaSessao = { usuario: Usuario | null; csrf: string | null };

export type ResumoInvestigacao = {
  id: string;
  tipo: string;
  valor: string;
  veredito: string;
  criada_em: string;
};

export type Evidencia = { fonte: string; status: string; dados: Record<string, unknown> };

export type Analise = {
  resumo: string;
  tecnicas_mitre: string[];
  recomendacoes: string[];
  confianca: string;
};

export type DetalheInvestigacao = ResumoInvestigacao & {
  nota: number | null;
  rotulo: string;
  evidencias: Evidencia[];
  analise: Analise | null;
  reaproveitada: boolean;
};
