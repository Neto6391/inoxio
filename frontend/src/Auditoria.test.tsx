import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      if (caminho === "/api/auditoria/usuarios") return json(LINHAS);
      if (caminho.startsWith("/api/auditoria/usuarios/")) {
        pedidos.push(caminho);
        return json(SESSOES);
      }
      if (caminho.startsWith("/api/auditoria")) {
        pedidos.push(caminho);
        return json(PAGINA);
      }
      return json([]);
    }),
  );
}

const LINHAS = [
  {
    nome: "ana",
    papel: "analista",
    situacao: "ativa",
    ultimo_acesso: "2026-10-23T13:58:04",
    sessoes: 2,
    abertas: 1,
    falhas_de_login: 1,
    investigacoes: 3,
  },
  {
    nome: "beto",
    papel: "analista",
    situacao: "desativada",
    ultimo_acesso: null,
    sessoes: 0,
    abertas: 0,
    falhas_de_login: 0,
    investigacoes: 0,
  },
];

const SESSOES = {
  sessoes: [
    {
      id: "abc123",
      aproximada: false,
      inicio_registrado: true,
      inicio: "2026-10-23T13:00:00",
      fim: "2026-10-23T13:40:00",
      motivo_fim: "saiu",
      aberta: false,
      ip: "1.2.3.4",
      acoes: 1,
      eventos: [
        { quando: "2026-10-23T13:00:00", tipo: "login", ip: "1.2.3.4", detalhe: "" },
        { quando: "2026-10-23T13:05:00", tipo: "investigacao", ip: "1.2.3.4", detalhe: "ip 8.8.8.8 → sem_evidencia" },
        { quando: "2026-10-23T13:40:00", tipo: "logout", ip: "1.2.3.4", detalhe: "" },
      ],
    },
    {
      id: "aprox-7",
      aproximada: true,
      inicio_registrado: true,
      inicio: "2026-10-20T12:00:00",
      fim: null,
      motivo_fim: null,
      aberta: false,
      ip: "1.2.3.4",
      acoes: 0,
      eventos: [{ quando: "2026-10-20T12:00:00", tipo: "login", ip: "1.2.3.4", detalhe: "" }],
    },
  ],
  fora_de_sessao: [{ quando: "2026-10-22T10:00:00", tipo: "login_falhou", ip: "9.9.9.9", detalhe: "" }],
};

async function abrirEventos() {
  fireEvent.click(await screen.findByText("Todos os eventos"));
}

test("admin vê os eventos, e texto vindo de terceiros fica texto", async () => {
  const pedidos: string[] = [];
  servidor("admin", pedidos);
  navegar("/auditoria");
  const { container } = render(<App />);
  await abrirEventos();
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
  await abrirEventos();
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
      if (caminho === "/api/auditoria/usuarios") return json(LINHAS);
      pedidos.push(caminho);
      return json({ ...PAGINA, total: 120 });
    }),
  );
  navegar("/auditoria");
  render(<App />);
  await abrirEventos();
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
  await abrirEventos();
  await screen.findByText("ip 8.8.8.8 → malicioso");
  expect(screen.getByText("conta excluída")).toBeInTheDocument();
  expect(screen.queryByText("backup")).toBeNull();
});

test("o erro some quando a consulta seguinte dá certo", async () => {
  let falhar = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "chefe", papel: "admin" }, csrf: "t" });
      if (caminho === "/api/auditoria/usuarios") return json(LINHAS);
      if (caminho.startsWith("/api/auditoria?")) {
        return falhar ? json({ erro: "Falhou agora." }, 500) : json({ ...PAGINA, total: 120 });
      }
      return json([]);
    }),
  );
  navegar("/auditoria");
  render(<App />);
  await abrirEventos();
  await screen.findByText("ip 8.8.8.8 → malicioso");
  falhar = true;
  fireEvent.click(screen.getByTitle("2"));
  expect(await screen.findByText("Falhou agora.")).toBeInTheDocument();
  falhar = false;
  fireEvent.click(screen.getByText("entrou"));
  await waitFor(() => expect(screen.queryByText("Falhou agora.")).toBeNull());
  expect(screen.getByText("ip 8.8.8.8 → malicioso")).toBeInTheDocument();
});

test("apagar o texto do filtro de usuário tira o filtro", async () => {
  const pedidos: string[] = [];
  servidor("admin", pedidos);
  navegar("/auditoria");
  render(<App />);
  await abrirEventos();
  await screen.findByText("ip 8.8.8.8 → malicioso");
  const caixa = screen.getByPlaceholderText("Filtrar por usuário");
  fireEvent.change(caixa, { target: { value: "teste" } });
  fireEvent.keyDown(caixa, { key: "Enter", code: "Enter", keyCode: 13 });
  await waitFor(() => expect(pedidos.at(-1)).toBe("/api/auditoria?pagina=1&usuario=teste"));
  fireEvent.change(caixa, { target: { value: "" } });
  await waitFor(() => expect(pedidos.at(-1)).toBe("/api/auditoria?pagina=1"));
  expect(caixa).toHaveValue("");
});

test("a tabela por usuário abre as sessões, com período e linha do tempo", async () => {
  const pedidos: string[] = [];
  servidor("admin", pedidos);
  navegar("/auditoria");
  render(<App />);
  const linhaAna = (await screen.findByText("ana")).closest("tr") as HTMLElement;
  expect(within(linhaAna).getByText("ativa")).toBeInTheDocument();
  const linhaBeto = screen.getByText("beto").closest("tr") as HTMLElement;
  expect(within(linhaBeto).getByText("nunca, nos últimos 90 dias")).toBeInTheDocument();
  fireEvent.click(within(linhaAna).getByRole("button", { name: "Visualizar" }));
  const janela = await screen.findByRole("dialog", { name: "Sessões de ana" });
  expect(pedidos.at(-1)).toBe("/api/auditoria/usuarios/ana/sessoes");
  expect(await within(janela).findByText("saiu às 10:40:00")).toBeInTheDocument();
  expect(within(janela).getByText("aproximada")).toBeInTheDocument();
  expect(within(janela).getByText("senha errada")).toBeInTheDocument();
  // A linha do tempo só aparece ao clicar na sessão.
  expect(within(janela).queryByText("ip 8.8.8.8 → sem_evidencia")).toBeNull();
  fireEvent.click(within(janela).getByText("23/10/2026 10:00:00"));
  expect(within(janela).getByText("ip 8.8.8.8 → sem_evidencia")).toBeInTheDocument();
  fireEvent.change(within(janela).getByLabelText("De"), { target: { value: "2026-10-01" } });
  fireEvent.change(within(janela).getByLabelText("Até"), { target: { value: "2026-10-23" } });
  fireEvent.click(within(janela).getByRole("button", { name: "Filtrar" }));
  await waitFor(() =>
    expect(pedidos.at(-1)).toBe("/api/auditoria/usuarios/ana/sessoes?de=2026-10-01&ate=2026-10-23"),
  );
  fireEvent.keyDown(janela, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("período invertido não filtra", async () => {
  servidor("admin", []);
  navegar("/auditoria");
  render(<App />);
  const linhaAna = (await screen.findByText("ana")).closest("tr") as HTMLElement;
  fireEvent.click(within(linhaAna).getByRole("button", { name: "Visualizar" }));
  const janela = await screen.findByRole("dialog");
  fireEvent.change(within(janela).getByLabelText("De"), { target: { value: "2026-10-23" } });
  fireEvent.change(within(janela).getByLabelText("Até"), { target: { value: "2026-10-01" } });
  expect(within(janela).getByRole("button", { name: "Filtrar" })).toBeDisabled();
  expect(within(janela).getByText("A data inicial vem depois da final.")).toBeInTheDocument();
});
