import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
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

function servidor(papel: "admin" | "analista", pedidos: RequestInit[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "chefe", papel }, csrf: "token" });
      if (caminho === "/api/usuarios" && pedido.method === "POST") {
        pedidos.push(pedido);
        return json({ nome: "dani", papel: "analista", criado_em: "2026-09-26T20:00:00" }, 201);
      }
      if (caminho === "/api/usuarios") return json([{ nome: "chefe", papel: "admin", criado_em: "2026-09-26T12:00:00" }]);
      return json([]);
    }),
  );
}

test("o menu Usuários só aparece para o admin", async () => {
  servidor("analista");
  render(<App />);
  await screen.findByText("Painel");
  expect(screen.queryByRole("link", { name: "Usuários" })).toBeNull();
});

test("analista que abre /usuarios vê página não encontrada", async () => {
  servidor("analista");
  navegar("/usuarios");
  render(<App />);
  expect(await screen.findByText("Página não encontrada")).toBeInTheDocument();
});

test("admin cadastra usuário sem mandar a confirmação da senha", async () => {
  const pedidos: RequestInit[] = [];
  servidor("admin", pedidos);
  navegar("/usuarios");
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
  await screen.findByText("Usuários cadastrados");
  fireEvent.change(screen.getByLabelText("Nome de usuário"), { target: { value: "dani" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-bem-longa-1" } });
  fireEvent.change(screen.getByLabelText("Repita a senha"), { target: { value: "senha-bem-longa-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));
  await waitFor(() => expect(pedidos).toHaveLength(1));
  expect(JSON.parse(pedidos[0].body as string)).toEqual({
    nome: "dani",
    senha: "senha-bem-longa-1",
    papel: "analista",
  });
  expect((pedidos[0].headers as Record<string, string>)["X-CSRF-Token"]).toBe("token");
});
