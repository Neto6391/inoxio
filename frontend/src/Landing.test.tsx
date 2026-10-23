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

test("a raiz é pública: mostra o produto, a vitrine real e os planos", async () => {
  servidor(false);
  navegar("/");
  render(<App />);
  expect(await screen.findByText(/Descubra em segundos/)).toBeInTheDocument();
  const vitrine = screen.getByRole("figure", { name: /Exemplo real de resultado/ });
  expect(vitrine).toHaveTextContent("google.com");
  expect(vitrine).toHaveTextContent("Sem evidência de atividade maliciosa");
  expect(screen.getByText("Profissional")).toBeInTheDocument();
  expect(screen.queryByText("Usuário")).toBeNull();
});

test("pedir demonstração abre um e-mail para o contato do servidor, com o plano no assunto", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: null, csrf: null });
      if (caminho === "/api/publico") return json({ contato_privacidade: "contato@exemplo.com", versao_termos: "2026-10-23" });
      return json([]);
    }),
  );
  navegar("/");
  render(<App />);
  const pedidos = await screen.findAllByRole("link", { name: "Pedir demonstração" });
  expect(pedidos).toHaveLength(2);
  expect(pedidos[0]).toHaveAttribute(
    "href",
    `mailto:contato@exemplo.com?subject=${encodeURIComponent("Demonstração do Inóxio — plano Profissional")}`,
  );
  expect(pedidos[1].getAttribute("href")).toContain(encodeURIComponent("plano Empresarial"));
});

test("sem contato configurado, os planos pagos ficam como em breve", async () => {
  servidor(false);
  navegar("/");
  render(<App />);
  const breves = await screen.findAllByRole("button", { name: "Em breve" });
  expect(breves).toHaveLength(2);
  for (const botao of breves) expect(botao).toBeDisabled();
});

test("criar conta grátis leva à tela de entrar e cadastrar", async () => {
  servidor(false);
  navegar("/");
  render(<App />);
  fireEvent.click((await screen.findAllByRole("button", { name: "Criar conta grátis" }))[0]);
  expect(await screen.findByLabelText("Usuário")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/entrar");
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
  expect(await screen.findByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), / })).toBeInTheDocument();
});

test("com sessão, a raiz vai direto ao Início, sem a página pública", async () => {
  servidor(true);
  navegar("/");
  render(<App />);
  expect(await screen.findByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), / })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/inicio");
  expect(screen.queryByRole("button", { name: "Abrir painel" })).toBeNull();
});

test("rota interna sem sessão pede login, não mostra o painel", async () => {
  servidor(false);
  navegar("/inicio");
  render(<App />);
  expect(await screen.findByLabelText("Usuário")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), / })).toBeNull();
});
