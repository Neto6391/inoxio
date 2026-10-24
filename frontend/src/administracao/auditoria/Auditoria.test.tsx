import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "../../app/App";
import { navegar } from "../../app/rotas";
import { pagina } from "../../testes/pagina";

afterEach(() => {
  vi.unstubAllGlobals();
  navegar("/");
});

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

function servidor(papel: string, pedidos: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "chefe", papel }, csrf: "t" });
      if (caminho.startsWith("/api/auditoria/usuarios?")) return json(pagina(LINHAS));
      if (caminho.startsWith("/api/auditoria/usuarios/")) {
        pedidos.push(caminho);
        return json(SESSOES);
      }
      // A lista de todos os eventos saiu; o pedido fica registrado para o teste saber se voltou.
      if (caminho.startsWith("/api/auditoria")) {
        pedidos.push(caminho);
        return json(pagina([]));
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
  sessoes: pagina([
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
        { quando: "2026-10-23T13:00:00", tipo: "login", nome: "entrou", ip: "1.2.3.4", detalhe: "" },
        { quando: "2026-10-23T13:05:00", tipo: "investigacao", nome: "investigação", ip: "1.2.3.4", detalhe: "ip 8.8.8.8 → sem_evidencia" },
        { quando: "2026-10-23T13:40:00", tipo: "logout", nome: "saiu", ip: "1.2.3.4", detalhe: "" },
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
      eventos: [{ quando: "2026-10-20T12:00:00", tipo: "login", nome: "entrou", ip: "1.2.3.4", detalhe: "" }],
    },
  ], 5),
  fora_de_sessao: pagina([{ quando: "2026-10-22T10:00:00", tipo: "login_falhou", nome: "senha errada", ip: "9.9.9.9", detalhe: "" }], 5),
};

test("analista não tem a auditoria", async () => {
  const pedidos: string[] = [];
  servidor("analista", pedidos);
  navegar("/auditoria");
  render(<App />);
  expect(await screen.findByText("Página não encontrada")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Auditoria" })).toBeNull();
  expect(pedidos).toEqual([]);
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

test("a Auditoria não tem mais a lista de todos os eventos", async () => {
  const pedidos: string[] = [];
  servidor("admin", pedidos);
  navegar("/auditoria");
  render(<App />);
  await screen.findByText("ana");
  expect(screen.queryByText("Todos os eventos")).toBeNull();
  expect(pedidos.some((caminho) => caminho.startsWith("/api/auditoria?"))).toBe(false);
});
