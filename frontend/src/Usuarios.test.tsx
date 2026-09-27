import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      if (caminho.startsWith("/api/usuarios/") && pedido.method === "PATCH") {
        pedidos.push({ ...pedido, caminho } as RequestInit);
        return json({ nome: "dani", papel: "admin", criado_em: "2026-09-26T20:00:00", ativo: true });
      }
      if (caminho === "/api/usuarios") {
        return json([
          { nome: "chefe", papel: "admin", criado_em: "2026-09-26T12:00:00", ativo: true },
          { nome: "dani", papel: "analista", criado_em: "2026-09-26T13:00:00", ativo: true },
        ]);
      }
      return json([]);
    }),
  );
}

test("o menu Usuários só aparece para o admin", async () => {
  servidor("analista");
  navegar("/painel");
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

function abrirUsuarios(pedidos: RequestInit[]) {
  servidor("admin", pedidos);
  navegar("/usuarios");
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
}

function linhaDe(nome: string): HTMLElement {
  return screen.getByText(nome, { selector: "span" }).closest(".ant-list-item") as HTMLElement;
}

test("o admin não tem como desativar a própria conta", async () => {
  abrirUsuarios([]);
  await screen.findByText("dani", { selector: "span" });
  expect(within(linhaDe("chefe")).queryByRole("button", { name: "Desativar" })).toBeNull();
  expect(within(linhaDe("dani")).getByRole("button", { name: "Desativar" })).toBeInTheDocument();
});

test("editar manda só o que mudou", async () => {
  const pedidos: RequestInit[] = [];
  abrirUsuarios(pedidos);
  await screen.findByText("dani", { selector: "span" });
  fireEvent.click(within(linhaDe("dani")).getByRole("button", { name: "Editar" }));
  await screen.findByText("Editar dani");
  fireEvent.click(screen.getAllByText("Admin").at(-1) as HTMLElement);
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(pedidos).toHaveLength(1));
  expect((pedidos[0] as { caminho?: string }).caminho).toBe("/api/usuarios/dani");
  expect(JSON.parse(pedidos[0].body as string)).toEqual({ papel: "admin" });
});

test("desativar pede confirmação e manda ativo falso", async () => {
  const pedidos: RequestInit[] = [];
  abrirUsuarios(pedidos);
  await screen.findByText("dani", { selector: "span" });
  fireEvent.click(within(linhaDe("dani")).getByRole("button", { name: "Desativar" }));
  expect(pedidos).toHaveLength(0);
  const confirmar = await screen.findByText("Desativar dani?");
  const caixa = confirmar.closest(".ant-popover") as HTMLElement;
  fireEvent.click(within(caixa).getByRole("button", { name: "Desativar" }));
  await waitFor(() => expect(pedidos).toHaveLength(1));
  expect(JSON.parse(pedidos[0].body as string)).toEqual({ ativo: false });
});

test("trocar só a senha não manda o papel", async () => {
  const pedidos: RequestInit[] = [];
  abrirUsuarios(pedidos);
  await screen.findByText("dani", { selector: "span" });
  fireEvent.click(within(linhaDe("dani")).getByRole("button", { name: "Editar" }));
  await screen.findByText("Editar dani");
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senha-nova-bem-longa" } });
  fireEvent.change(screen.getByLabelText("Repita a nova senha"), { target: { value: "senha-nova-bem-longa" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(pedidos).toHaveLength(1));
  expect(JSON.parse(pedidos[0].body as string)).toEqual({ senha: "senha-nova-bem-longa" });
});
