import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { navegar } from "./rotas";

beforeEach(() => navegar("/painel"));
afterEach(() => {
  vi.unstubAllGlobals();
  navegar("/");
});

function servidor(respostas: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => new Response(JSON.stringify(respostas[caminho] ?? {}), { status: 200 })),
  );
}

test("sem sessão (usuário nulo) mostra o login, sem quebrar", async () => {
  servidor({ "/api/sessao": { usuario: null, csrf: null } });
  render(<App />);
  expect(await screen.findByRole("button", { name: "Entrar" })).toBeInTheDocument();
});

test("com sessão mostra o painel com o nome do usuário", async () => {
  servidor({
    "/api/sessao": { usuario: { nome: "ana", papel: "analista" }, csrf: "token" },
    "/api/investigacoes": [],
  });
  render(<App />);
  expect(await screen.findByText("Painel")).toBeInTheDocument();
  expect(screen.getByText(/ana · analista/)).toBeInTheDocument();
});

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

test("Sair com token velho, porque outra aba entrou de novo, encerra a sessão que vale", async () => {
  let csrfAtual = "velho";
  const tokensDoLogout: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "ana", papel: "analista" }, csrf: csrfAtual });
      if (caminho === "/api/investigacoes") return json([]);
      const token = (pedido.headers as Record<string, string>)["X-CSRF-Token"];
      tokensDoLogout.push(token);
      return token === "novo" ? new Response(null, { status: 204 }) : json({ erro: "Acesso negado." }, 403);
    }),
  );
  render(<App />);
  await screen.findByText("Painel");
  csrfAtual = "novo";
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  // Depois de sair, a pessoa volta para a página inicial.
  expect(await screen.findByText(/Descubra em segundos/)).toBeInTheDocument();
  expect(tokensDoLogout).toEqual(["velho", "novo"]);
});

test("falha ao listar as investigações aparece como erro, não como lista vazia", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) =>
      caminho === "/api/sessao"
        ? json({ usuario: { nome: "ana", papel: "analista" }, csrf: "token" })
        : json({ erro: "Erro interno. O detalhe ficou registrado no servidor." }, 500),
    ),
  );
  render(<App />);
  expect(await screen.findByText("Erro interno. O detalhe ficou registrado no servidor.")).toBeInTheDocument();
  expect(screen.queryByText("Nenhuma investigação ainda.")).toBeNull();
});

test("investigar com token velho faz o app perguntar de novo quem está logado", async () => {
  let quem = "ana";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: quem, papel: "analista" }, csrf: quem });
      if (pedido.method === "POST") return json({ erro: "Acesso negado." }, 403);
      return json([]);
    }),
  );
  render(<App />);
  await screen.findByText(/ana · analista/);
  quem = "beto";
  fireEvent.change(screen.getByPlaceholderText(/8\.8\.8\.8/), { target: { value: "8.8.8.8" } });
  fireEvent.click(screen.getByRole("button", { name: "Investigar" }));
  expect(await screen.findByText(/beto · analista/)).toBeInTheDocument();
});
