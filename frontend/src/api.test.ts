import { afterEach, expect, test, vi } from "vitest";
import { chamar, ErroApi, guardarCsrf, SESSAO_EXPIRADA } from "./api";

afterEach(() => vi.unstubAllGlobals());

function respondendo(status: number, corpo: unknown = {}) {
  const pedidos: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_caminho: string, pedido: RequestInit) => {
      pedidos.push(pedido);
      return new Response(status === 204 ? null : JSON.stringify(corpo), { status });
    }),
  );
  return pedidos;
}

test("POST leva o token CSRF e JSON; GET não leva token", async () => {
  const pedidos = respondendo(200);
  guardarCsrf("token-da-sessao");
  await chamar("/api/sessao");
  await chamar("/api/investigacoes", { metodo: "POST", corpo: { entrada: "8.8.8.8" } });
  const cabecalhos = pedidos.map((pedido) => pedido.headers as Record<string, string>);
  expect(cabecalhos[0]["X-CSRF-Token"]).toBeUndefined();
  expect(cabecalhos[1]["X-CSRF-Token"]).toBe("token-da-sessao");
  expect(cabecalhos[1]["Content-Type"]).toBe("application/json");
});

test("erro da API vira ErroApi com a mensagem do servidor", async () => {
  respondendo(429, { erro: "Limite de uso atingido. Tente mais tarde." });
  await expect(chamar("/api/investigacoes")).rejects.toMatchObject({
    status: 429,
    message: "Limite de uso atingido. Tente mais tarde.",
  });
});

test("401 avisa o app que a sessão expirou", async () => {
  respondendo(401, { erro: "Sessão ausente ou expirada." });
  const ouvinte = vi.fn();
  window.addEventListener(SESSAO_EXPIRADA, ouvinte);
  await expect(chamar("/api/investigacoes")).rejects.toBeInstanceOf(ErroApi);
  expect(ouvinte).toHaveBeenCalledOnce();
  window.removeEventListener(SESSAO_EXPIRADA, ouvinte);
});
