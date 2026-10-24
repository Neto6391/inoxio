// Cliente da API: sempre JSON, e o token CSRF em todo pedido que não é GET.

export const SESSAO_EXPIRADA = "inoxio:sessao-expirada";
// Outra aba entrou de novo: o cookie mudou e o token CSRF guardado aqui ficou velho.
export const SESSAO_TROCADA = "inoxio:sessao-trocada";

export class ErroApi extends Error {
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

let tokenCsrf = "";

// A versão que esta aba carregou, posta pelo servidor no index.html. No Vite de
// desenvolvimento o marcador fica cru e a comparação não vale.
function versaoDaPagina(): string | null {
  const valor = document.querySelector('meta[name="versao"]')?.getAttribute("content") ?? null;
  return valor && valor !== "__VERSAO__" ? valor : null;
}

let desatualizada = false;

// Houve deploy depois que esta aba abriu: o JavaScript dela é o antigo.
export function paginaDesatualizada(): boolean {
  return desatualizada;
}

export function guardarCsrf(token: string): void {
  tokenCsrf = token;
}

type Opcoes = { metodo?: "GET" | "POST" | "PATCH"; corpo?: unknown };

export async function chamar<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const metodo = opcoes.metodo ?? "GET";
  const cabecalhos: Record<string, string> = {};
  if (opcoes.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  if (metodo !== "GET") cabecalhos["X-CSRF-Token"] = tokenCsrf;
  const resposta = await fetch(caminho, {
    method: metodo,
    headers: cabecalhos,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    credentials: "same-origin",
  });
  const publicada = resposta.headers.get("X-Inoxio-Versao");
  const minha = versaoDaPagina();
  if (publicada && minha && publicada !== minha) desatualizada = true;
  if (resposta.status === 401 && caminho !== "/api/login") {
    window.dispatchEvent(new Event(SESSAO_EXPIRADA));
  }
  if (resposta.status === 204) return undefined as T;
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ErroApi(resposta.status, dados.erro ?? "Erro inesperado.");
  return dados as T;
}

export function mensagemDeErro(falha: unknown): string {
  return falha instanceof ErroApi ? falha.message : "Falha inesperada. Tente de novo.";
}
