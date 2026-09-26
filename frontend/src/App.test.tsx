import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.unstubAllGlobals());

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
