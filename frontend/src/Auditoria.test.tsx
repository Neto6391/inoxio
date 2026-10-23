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

const PAGINA = {
  total: 2,
  por_pagina: 50,
  tipos: ["login", "login_falhou", "login_bloqueado", "investigacao", "conta_excluida"],
  itens: [
    { quando: "2026-10-20T14:00:00", tipo: "investigacao", usuario: "ana", ip: "1.2.3.4", detalhe: "ip 8.8.8.8 → malicioso" },
    { quando: "2026-10-20T13:00:00", tipo: "login_falhou", usuario: "<b>x</b>", ip: "1.2.3.4", detalhe: "" },
  ],
};

function servidor(papel: string, pedidos: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "chefe", papel }, csrf: "t" });
      if (caminho.startsWith("/api/auditoria")) {
        pedidos.push(caminho);
        return json(PAGINA);
      }
      return json([]);
    }),
  );
}

test("admin vê os eventos, e texto vindo de terceiros fica texto", async () => {
  const pedidos: string[] = [];
  servidor("admin", pedidos);
  navegar("/auditoria");
  const { container } = render(<App />);
  expect(await screen.findByText("ip 8.8.8.8 → malicioso")).toBeInTheDocument();
  // Uma vez no filtro e outra na etiqueta do evento.
  expect(screen.getAllByText("senha errada")).toHaveLength(2);
  expect(container.querySelector(".linha-evento b")).toBeNull();
});

test("filtrar por tipo pede só aquele tipo, da página 1", async () => {
  const pedidos: string[] = [];
  servidor("admin", pedidos);
  navegar("/auditoria");
  render(<App />);
  await screen.findByText("ip 8.8.8.8 → malicioso");
  fireEvent.click(screen.getByText("login bloqueado"));
  await waitFor(() => expect(pedidos.at(-1)).toBe("/api/auditoria?pagina=1&tipo=login_bloqueado"));
});

test("analista não tem a auditoria", async () => {
  const pedidos: string[] = [];
  servidor("analista", pedidos);
  navegar("/auditoria");
  render(<App />);
  expect(await screen.findByText("Página não encontrada")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Auditoria" })).toBeNull();
  expect(pedidos).toEqual([]);
});

test("trocar o filtro volta para a página 1", async () => {
  const pedidos: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "chefe", papel: "admin" }, csrf: "t" });
      pedidos.push(caminho);
      return json({ ...PAGINA, total: 120 });
    }),
  );
  navegar("/auditoria");
  render(<App />);
  await screen.findByText("ip 8.8.8.8 → malicioso");
  fireEvent.click(screen.getByTitle("2"));
  await waitFor(() => expect(pedidos.at(-1)).toBe("/api/auditoria?pagina=2"));
  fireEvent.click(screen.getByText("entrou"));
  await waitFor(() => expect(pedidos.at(-1)).toBe("/api/auditoria?pagina=1&tipo=login"));
});

test("as etiquetas de filtro são os tipos que o servidor lista", async () => {
  servidor("admin", []);
  navegar("/auditoria");
  render(<App />);
  await screen.findByText("ip 8.8.8.8 → malicioso");
  expect(screen.getByText("conta excluída")).toBeInTheDocument();
  expect(screen.queryByText("backup")).toBeNull();
});

test("o erro some quando a consulta seguinte dá certo", async () => {
  let falhar = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "chefe", papel: "admin" }, csrf: "t" });
      if (falhar) {
        falhar = false;
        return json({ ...PAGINA, total: 120 });
      }
      return json({ erro: "Falhou agora." }, 500);
    }),
  );
  navegar("/auditoria");
  render(<App />);
  await screen.findByText("ip 8.8.8.8 → malicioso");
  fireEvent.click(screen.getByTitle("2"));
  expect(await screen.findByText("Falhou agora.")).toBeInTheDocument();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({ ...PAGINA, total: 120 })),
  );
  fireEvent.click(screen.getByText("entrou"));
  await waitFor(() => expect(screen.queryByText("Falhou agora.")).toBeNull());
  expect(screen.getByText("ip 8.8.8.8 → malicioso")).toBeInTheDocument();
});
