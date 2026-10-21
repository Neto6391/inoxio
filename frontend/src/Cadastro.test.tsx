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

type Pedido = { caminho: string; corpo: unknown };

function servidor(pedidos: Pedido[], respostas: Record<string, Response> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (pedido.method && pedido.method !== "GET") {
        pedidos.push({ caminho, corpo: JSON.parse(pedido.body as string) });
      }
      if (caminho in respostas) return respostas[caminho];
      if (caminho === "/api/sessao") return json({ usuario: null, csrf: null });
      return json([]);
    }),
  );
}

test("o cadastro fica ao lado do login e não manda a confirmação da senha", async () => {
  const pedidos: Pedido[] = [];
  servidor(pedidos, {
    "/api/cadastro": json({ mensagem: "Enviamos um link de ativação para o seu e-mail." }, 202),
  });
  navegar("/entrar");
  render(<App />);
  expect(await screen.findByRole("button", { name: "Entrar" })).toBeInTheDocument();
  const ids = [...document.querySelectorAll("input[id]")].map((campo) => campo.id);
  expect(new Set(ids).size).toBe(ids.length);
  fireEvent.change(screen.getByLabelText("Nome de usuário"), { target: { value: "dani" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "dani@exemplo.com" } });
  fireEvent.change(screen.getByLabelText("Crie uma senha"), { target: { value: "senha-bem-longa-1" } });
  fireEvent.change(screen.getByLabelText("Repita a senha"), { target: { value: "senha-bem-longa-1" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
  await waitFor(() => expect(pedidos).toHaveLength(1), { timeout: 3000 });
  expect(await screen.findByText(/Enviamos um link de ativação/)).toBeInTheDocument();
  expect(pedidos).toEqual([
    {
      caminho: "/api/cadastro",
      corpo: { nome: "dani", email: "dani@exemplo.com", senha: "senha-bem-longa-1", aceite_termos: true },
    },
  ]);
});

test("o link de ativação manda o token do # e o tira da barra de endereço", async () => {
  const pedidos: Pedido[] = [];
  servidor(pedidos, { "/api/ativar": json({ mensagem: "Conta ativada. Já pode entrar." }) });
  window.history.pushState(null, "", "/ativar#token-do-email");
  render(<App />);
  expect(await screen.findByText("Conta ativada")).toBeInTheDocument();
  expect(pedidos).toEqual([{ caminho: "/api/ativar", corpo: { token: "token-do-email" } }]);
  expect(window.location.hash).toBe("");
});

test("link vencido mostra o motivo", async () => {
  servidor([], { "/api/ativar": json({ erro: "Link de ativação inválido ou vencido." }, 400) });
  window.history.pushState(null, "", "/ativar#velho");
  render(<App />);
  expect(await screen.findByText("Não foi possível ativar")).toBeInTheDocument();
  expect(screen.getByText(/inválido ou vencido/)).toBeInTheDocument();
});

test("admin vê quem espera o e-mail, ativa e muda a cota", async () => {
  const pedidos: Pedido[] = [];
  const lista = [
    { nome: "chefe", papel: "admin", criado_em: "2026-10-20T12:00:00", ativo: true, email: null, pendente: false, cota_diaria: null },
    { nome: "dani", papel: "analista", criado_em: "2026-10-20T13:00:00", ativo: false, email: "dani@exemplo.com", pendente: true, cota_diaria: 10 },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "chefe", papel: "admin" }, csrf: "t" });
      if (pedido.method === "PATCH") {
        pedidos.push({ caminho, corpo: JSON.parse(pedido.body as string) });
        return json(lista[1]);
      }
      return json(lista);
    }),
  );
  navegar("/usuarios");
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
  const nome = await screen.findByText("dani", { selector: "span" });
  const linha = nome.closest(".ant-list-item") as HTMLElement;
  expect(within(linha).getByText("aguardando e-mail")).toBeInTheDocument();
  expect(within(linha).getByText(/dani@exemplo.com/)).toBeInTheDocument();
  fireEvent.click(within(linha).getByRole("button", { name: "Ativar" }));
  await waitFor(() => expect(pedidos).toHaveLength(1));
  expect(pedidos[0]).toEqual({ caminho: "/api/usuarios/dani", corpo: { ativo: true } });
  fireEvent.click(within(linha).getByRole("button", { name: "Editar" }));
  await screen.findByText("Editar dani");
  fireEvent.change(screen.getByLabelText("Cota diária"), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(pedidos).toHaveLength(2));
  expect(pedidos[1].corpo).toEqual({ cota_diaria: 50 });
});

test("sem marcar o aceite, o cadastro não sai", async () => {
  const pedidos: Pedido[] = [];
  servidor(pedidos);
  navegar("/entrar");
  render(<App />);
  await screen.findByRole("button", { name: "Entrar" });
  fireEvent.change(screen.getByLabelText("Nome de usuário"), { target: { value: "dani" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "dani@exemplo.com" } });
  fireEvent.change(screen.getByLabelText("Crie uma senha"), { target: { value: "senha-bem-longa-1" } });
  fireEvent.change(screen.getByLabelText("Repita a senha"), { target: { value: "senha-bem-longa-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(await screen.findByText("Aceite para criar a conta")).toBeInTheDocument();
  expect(pedidos).toEqual([]);
});
