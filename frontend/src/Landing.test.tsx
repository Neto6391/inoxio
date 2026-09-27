import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { navegar } from "./rotas";

afterEach(() => {
  vi.unstubAllGlobals();
  navegar("/");
});

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

function servidor(logado: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (caminho === "/api/sessao") {
        return json(logado ? { usuario: { nome: "ana", papel: "analista" }, csrf: "t" } : { usuario: null, csrf: null });
      }
      if (caminho === "/api/login" && pedido.method === "POST") {
        return json({ usuario: { nome: "ana", papel: "analista" }, csrf: "t" });
      }
      return json([]);
    }),
  );
}

test("a raiz é pública: mostra o produto e os planos, marcados como ilustrativos", async () => {
  servidor(false);
  navegar("/");
  render(<App />);
  expect(await screen.findByText(/Descubra em segundos/)).toBeInTheDocument();
  expect(screen.getByText("Profissional")).toBeInTheDocument();
  expect(screen.getByText(/planos e valores são ilustrativos, e nada é vendido/)).toBeInTheDocument();
  expect(screen.queryByText("Usuário")).toBeNull();
});

test("Entrar leva ao login, e o login leva ao painel", async () => {
  servidor(false);
  navegar("/");
  render(<App />);
  fireEvent.click((await screen.findAllByRole("button", { name: "Entrar" }))[0]);
  expect(await screen.findByLabelText("Usuário")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/entrar");
  fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: "ana" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-de-teste" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("Painel")).toBeInTheDocument();
});

test("com sessão, a raiz oferece abrir o painel", async () => {
  servidor(true);
  navegar("/");
  render(<App />);
  fireEvent.click((await screen.findAllByRole("button", { name: "Abrir painel" }))[0]);
  expect(await screen.findByText("Painel")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/painel");
});

test("rota interna sem sessão pede login, não mostra o painel", async () => {
  servidor(false);
  navegar("/painel");
  render(<App />);
  expect(await screen.findByLabelText("Usuário")).toBeInTheDocument();
  expect(screen.queryByText("Painel")).toBeNull();
});
