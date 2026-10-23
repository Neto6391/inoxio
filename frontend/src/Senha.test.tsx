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

type Pedido = { caminho: string; corpo: unknown };

function servidor(pedidos: Pedido[], respostas: Record<string, Response> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (pedido.method === "POST") pedidos.push({ caminho, corpo: JSON.parse(pedido.body as string) });
      if (caminho in respostas) return respostas[caminho];
      if (caminho === "/api/sessao") return json({ usuario: null, csrf: null });
      return json([]);
    }),
  );
}

test("do login, 'Esqueci minha senha' pede o link pelo e-mail", async () => {
  const pedidos: Pedido[] = [];
  servidor(pedidos, {
    "/api/senha/esqueci": json({ mensagem: "Se houver uma conta ativa com esse e-mail, enviamos um link." }, 202),
  });
  navegar("/entrar");
  render(<App />);
  fireEvent.click(await screen.findByRole("link", { name: "Esqueci minha senha" }));
  fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: "ana@exemplo.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));
  expect(await screen.findByText(/Se houver uma conta ativa/)).toBeInTheDocument();
  expect(pedidos).toEqual([{ caminho: "/api/senha/esqueci", corpo: { email: "ana@exemplo.com" } }]);
});

test("o link do e-mail troca a senha com o token do # e não manda a confirmação", async () => {
  const pedidos: Pedido[] = [];
  servidor(pedidos, { "/api/senha/redefinir": json({ mensagem: "Senha trocada. Já pode entrar com a senha nova." }) });
  window.history.pushState(null, "", "/redefinir#token-do-email");
  render(<App />);
  const senha = await screen.findByLabelText("Senha nova");
  await waitFor(() => expect(window.location.hash).toBe(""));
  fireEvent.change(senha, { target: { value: "senha-nova-bem-longa" } });
  fireEvent.change(screen.getByLabelText("Repita a senha nova"), { target: { value: "outra-coisa-longa" } });
  fireEvent.click(screen.getByRole("button", { name: "Trocar a senha" }));
  expect(await screen.findByText("As senhas não conferem")).toBeInTheDocument();
  expect(pedidos).toEqual([]);
  fireEvent.change(screen.getByLabelText("Repita a senha nova"), { target: { value: "senha-nova-bem-longa" } });
  fireEvent.click(screen.getByRole("button", { name: "Trocar a senha" }));
  expect(await screen.findByText("Senha trocada")).toBeInTheDocument();
  expect(pedidos).toEqual([
    { caminho: "/api/senha/redefinir", corpo: { token: "token-do-email", senha: "senha-nova-bem-longa" } },
  ]);
});

test("link vencido mostra o motivo e o caminho para pedir outro", async () => {
  servidor([], {
    "/api/senha/redefinir": json({ erro: "Link inválido ou vencido. Peça outro em Esqueci minha senha." }, 400),
  });
  window.history.pushState(null, "", "/redefinir#velho");
  render(<App />);
  fireEvent.change(await screen.findByLabelText("Senha nova"), { target: { value: "senha-nova-bem-longa" } });
  fireEvent.change(screen.getByLabelText("Repita a senha nova"), { target: { value: "senha-nova-bem-longa" } });
  fireEvent.click(screen.getByRole("button", { name: "Trocar a senha" }));
  expect(await screen.findByText(/inválido ou vencido/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Pedir outro link" })).toHaveAttribute("href", "/esqueci-senha");
});

test("colar um link novo na mesma aba usa o token novo", async () => {
  const pedidos: Pedido[] = [];
  servidor(pedidos, { "/api/senha/redefinir": json({ mensagem: "Senha trocada. Já pode entrar com a senha nova." }) });
  window.history.pushState(null, "", "/redefinir#velho");
  render(<App />);
  const senha = await screen.findByLabelText("Senha nova");
  // Só o "#" muda: o navegador não recarrega a página.
  window.location.hash = "novo";
  await waitFor(() => expect(window.location.hash).toBe(""));
  fireEvent.change(senha, { target: { value: "senha-nova-bem-longa" } });
  fireEvent.change(screen.getByLabelText("Repita a senha nova"), { target: { value: "senha-nova-bem-longa" } });
  fireEvent.click(screen.getByRole("button", { name: "Trocar a senha" }));
  await waitFor(() => expect(pedidos).toHaveLength(1));
  expect(pedidos[0].corpo).toEqual({ token: "novo", senha: "senha-nova-bem-longa" });
});
