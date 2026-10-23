export type Papel = "admin" | "analista";
export type Usuario = {
  nome: string;
  papel: Papel;
  onboarding_visto?: boolean;
  termos_pendentes?: boolean;
};
export type UsuarioListado = Usuario & {
  criado_em: string;
  ativo: boolean;
  email: string | null;
  // Cadastrou-se sozinho e ainda não confirmou o e-mail.
  pendente: boolean;
  cota_diaria: number | null;
};
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

export type Evidencia = {
  fonte: string;
  status: string;
  dados: Record<string, unknown>;
  // Contexto (os IPs de um domínio) aparece na tela, mas não entra no veredito.
  contexto?: boolean;
};

export type IpDoDominio = {
  ip: string;
  abuseipdb: string;
  score?: number;
  relatos?: number;
  pais?: string;
  isp?: string;
};

export type Termo = { termo: string; significado: string };

export type Analise = {
  resumo: string;
  tecnicas_mitre: string[];
  recomendacoes: string[];
  // Nula quando o modelo não a informou.
  confianca: string | null;
  // Análises feitas antes do glossário não têm termos.
  termos?: Termo[];
  // Um parágrafo por fonte consultada; as análises antigas não têm.
  por_fonte?: string[];
};

// Cota de hoje, que zera à meia-noite de Brasília. Sem cota (admin), cota e restantes vêm nulos.
export type Creditos = {
  cota: number | null;
  usados: number;
  restantes: number | null;
  renova_em: string;
};

export type DetalheInvestigacao = ResumoInvestigacao & {
  nota: number | null;
  rotulo: string;
  evidencias: Evidencia[];
  analise: Analise | null;
  // pendente: a IA ainda escreve a explicação, que chega em segundo plano.
  analise_estado?: "pendente" | "pronta" | "indisponivel";
  reaproveitada: boolean;
};
