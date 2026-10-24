import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App as AntApp } from "antd";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "../app/App";
import { navegar } from "../app/rotas";

afterEach(() => {
  vi.unstubAllGlobals();
  navegar("/");
});

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

type Pedido = { caminho: string; corpo: unknown };

function servidor(usuario: Record<string, unknown> | null, pedidos: Pedido[] = [], extras: Record<string, Response> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (pedido.method === "POST") pedidos.push({ caminho, corpo: pedido.body ? JSON.parse(pedido.body as string) : null });
      if (caminho in extras) return extras[caminho];
      if (caminho === "/api/sessao") return json({ usuario, csrf: usuario ? "t" : null });
      if (caminho === "/api/publico") return json({ contato_privacidade: "dpo@exemplo.com", versao_termos: "2026-10-21" });
      if (caminho === "/api/sessao/termos" || caminho === "/api/conta/excluir") return new Response(null, { status: 204 });
      return json([]);
    }),
  );
}

const ANA = { nome: "ana", papel: "analista", onboarding_visto: true, termos_pendentes: false };

test("as páginas legais são públicas e mostram a versão e o contato do servidor", async () => {
  servidor(null);
  navegar("/privacidade");
  render(<App />);
  expect(await screen.findByText("Política de Privacidade", { selector: "h1" })).toBeInTheDocument();
  expect(await screen.findByText("Versão de 21 de outubro de 2026.")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "dpo@exemplo.com" })[0]).toHaveAttribute("href", "mailto:dpo@exemplo.com");
  expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", "/termos");
});

test("quem tem termos pendentes não segue sem aceitar", async () => {
  const pedidos: Pedido[] = [];
  servidor({ ...ANA, termos_pendentes: true }, pedidos);
  navegar("/inicio");
  render(<App />);
  const janela = await screen.findByRole("dialog");
  const botao = within(janela).getByRole("button", { name: "Aceitar e continuar" });
  expect(botao).toBeDisabled();
  fireEvent.click(within(janela).getByRole("checkbox"));
  fireEvent.click(botao);
  await waitFor(() => expect(pedidos.map((p) => p.caminho)).toEqual(["/api/sessao/termos"]));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("Minha conta mostra os dados, oferece o download e exclui com a senha", async () => {
  const pedidos: Pedido[] = [];
  servidor(ANA, pedidos, {
    "/api/conta": json({
      nome: "ana", email: "ana@exemplo.com", papel: "analista", criado_em: "2026-10-20T12:00:00",
      email_confirmado_em: null, cota_diaria: 10, termos_versao: "2026-10-21", termos_aceitos_em: "2026-10-21T10:00:00",
    }),
  });
  navegar("/conta");
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
  expect(await screen.findByText("ana@exemplo.com")).toBeInTheDocument();
  expect(screen.getByText("versão de 21 de outubro de 2026, em 21/10/2026 07:00:00")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Baixar meus dados" })).toHaveAttribute("href", "/api/conta/dados");
  const excluir = screen.getByRole("button", { name: "Excluir minha conta" });
  expect(excluir).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText("Sua senha, para confirmar"), { target: { value: "minha-senha-longa" } });
  fireEvent.click(excluir);
  const confirmar = await screen.findByText("Excluir a sua conta?");
  fireEvent.click(within(confirmar.closest(".ant-popover") as HTMLElement).getByRole("button", { name: "Excluir" }));
  await waitFor(() =>
    expect(pedidos).toEqual([{ caminho: "/api/conta/excluir", corpo: { senha: "minha-senha-longa" } }]),
  );
  expect(await screen.findByText(/Descubra em segundos/)).toBeInTheDocument();
});

test("reaceitar os termos na Minha conta atualiza a versão mostrada", async () => {
  let aceitou = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: { ...ANA, termos_pendentes: true }, csrf: "t" });
      if (caminho === "/api/sessao/termos") {
        aceitou = true;
        return new Response(null, { status: 204 });
      }
      if (caminho === "/api/conta") {
        return json({
          nome: "ana", email: null, papel: "analista", criado_em: null, email_confirmado_em: null, cota_diaria: null,
          termos_versao: aceitou ? "2026-11-02" : "2026-10-21",
          termos_aceitos_em: aceitou ? "2026-11-03T09:00:00" : "2026-10-21T10:00:00",
        });
      }
      return json([]);
    }),
  );
  navegar("/conta");
  render(<App />);
  expect(await screen.findByText(/versão de 21 de outubro de 2026/)).toBeInTheDocument();
  const janela = await screen.findByRole("dialog");
  fireEvent.click(within(janela).getByRole("checkbox"));
  fireEvent.click(within(janela).getByRole("button", { name: "Aceitar e continuar" }));
  expect(await screen.findByText(/versão de 2 de novembro de 2026/)).toBeInTheDocument();
});

test("o rodapé com os termos aparece no app", async () => {
  servidor(ANA);
  navegar("/inicio");
  render(<App />);
  await screen.findByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), / });
  expect(screen.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", "/privacidade");
});

test("o X da janela dos termos é sair sem aceitar", async () => {
  const pedidos: Pedido[] = [];
  servidor({ ...ANA, termos_pendentes: true }, pedidos);
  navegar("/inicio");
  render(<App />);
  const janela = await screen.findByRole("dialog");
  fireEvent.click(within(janela).getByRole("button", { name: "Sair sem aceitar" }));
  await waitFor(() => expect(pedidos.map((p) => p.caminho)).toEqual(["/api/logout"]));
  expect(pedidos.map((p) => p.caminho)).not.toContain("/api/sessao/termos");
});
