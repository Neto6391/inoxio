// Cliente da API: sempre JSON, e o token CSRF em todo pedido que não é GET.

export const SESSAO_EXPIRADA = "inoxio:sessao-expirada";

export class ErroApi extends Error {
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

let tokenCsrf = "";

export function guardarCsrf(token: string): void {
  tokenCsrf = token;
}

type Opcoes = { metodo?: "GET" | "POST"; corpo?: unknown };

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
