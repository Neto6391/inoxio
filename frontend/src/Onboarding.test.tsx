import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function servidor(visto: boolean, pedidos: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (pedido.method === "POST") pedidos.push(caminho);
      if (caminho === "/api/sessao") {
        return json({ usuario: { nome: "ana", papel: "analista", onboarding_visto: visto }, csrf: "t" });
      }
      if (caminho === "/api/sessao/onboarding") return new Response(null, { status: 204 });
      return json([]);
    }),
  );
}

test("primeiro acesso mostra a apresentação, e Começar a marca como vista", async () => {
  const pedidos: string[] = [];
  servidor(false, pedidos);
  navegar("/painel");
  render(<App />);
  expect(await screen.findByText("Bem-vindo ao Inóxio")).toBeInTheDocument();
  for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
  expect(screen.getByText("A IA explica, não decide")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Começar" }));
  await waitFor(() => expect(pedidos).toEqual(["/api/sessao/onboarding"]));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("Pular também marca como vista", async () => {
  const pedidos: string[] = [];
  servidor(false, pedidos);
  navegar("/painel");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Pular" }));
  await waitFor(() => expect(pedidos).toEqual(["/api/sessao/onboarding"]));
});

test("quem já viu não vê de novo", async () => {
  const pedidos: string[] = [];
  servidor(true, pedidos);
  navegar("/painel");
  render(<App />);
  expect(await screen.findByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), / })).toBeInTheDocument();
  expect(screen.queryByText("Bem-vindo ao Inóxio")).toBeNull();
});

test("Esc fecha e marca como vista; a rolagem da página volta", async () => {
  const pedidos: string[] = [];
  servidor(false, pedidos);
  navegar("/painel");
  render(<App />);
  const janela = await screen.findByRole("dialog");
  expect(document.body.classList.contains("sem-rolagem")).toBe(true);
  fireEvent.keyDown(janela, { key: "Escape" });
  await waitFor(() => expect(pedidos).toEqual(["/api/sessao/onboarding"]));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.classList.contains("sem-rolagem")).toBe(false);
});
