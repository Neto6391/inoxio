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

const ADMIN = { nome: "chefe", nome_exibicao: "Chefe da Silva", papel: "admin", onboarding_visto: true, termos_pendentes: false };

function investigacoes(total: number, pagina: number) {
  const itens = Array.from({ length: Math.min(20, total - (pagina - 1) * 20) }, (_, n) => ({
    id: `i${pagina}-${n}`,
    tipo: "ip",
    valor: `10.0.${pagina}.${n}`,
    veredito: "sem_evidencia",
    criada_em: "2026-10-23T12:00:00",
  }));
  return { total, pagina, por_pagina: 20, itens };
}

function usuario(nome: string) {
  return { nome, nome_exibicao: null, papel: "analista", criado_em: "2026-10-20T12:00:00", ativo: true, email: null, pendente: false, cota_diaria: 10 };
}

function servidor(pedidos: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (caminho === "/api/sessao") return json({ usuario: ADMIN, csrf: "t" });
      if (caminho.startsWith("/api/investigacoes?")) {
        pedidos.push(caminho);
        const numero = Number(new URLSearchParams(caminho.split("?")[1]).get("pagina"));
        return json(investigacoes(45, numero));
      }
      if (caminho.startsWith("/api/usuarios?")) {
        pedidos.push(caminho);
        const numero = Number(new URLSearchParams(caminho.split("?")[1]).get("pagina"));
        return json({ total: 25, pagina: numero, por_pagina: 20, itens: [usuario(`conta${numero}`)] });
      }
      if (caminho === "/api/usuarios" && pedido.method === "POST") {
        pedidos.push("POST /api/usuarios");
        return json(usuario("nova"), 201);
      }
      if (caminho.startsWith("/api/auditoria/usuarios/")) {
        pedidos.push(caminho);
        const numero = Number(new URLSearchParams(caminho.split("?")[1] ?? "").get("pagina") || 1);
        const sessao = (n: number) => ({
          id: `s${numero}-${n}`,
          aproximada: false,
          inicio_registrado: true,
          inicio: `2026-10-2${numero}T12:0${n}:00`,
          fim: null,
          motivo_fim: null,
          aberta: false,
          ip: "1.2.3.4",
          acoes: 0,
          eventos: [],
        });
        return json({
          sessoes: { total: 12, pagina: numero, por_pagina: 10, itens: [sessao(0), sessao(1)] },
          fora_de_sessao: Array.from({ length: 12 }, (_, n) => ({
            quando: `2026-10-22T10:${String(n).padStart(2, "0")}:00`,
            tipo: "login_falhou",
            ip: `9.9.9.${n}`,
            detalhe: "",
          })),
        });
      }
      if (caminho.startsWith("/api/auditoria/usuarios?")) {
        pedidos.push(caminho);
        const linha = {
          nome: "ana",
          papel: "analista",
          situacao: "ativa",
          ultimo_acesso: null,
          sessoes: 12,
          abertas: 0,
          falhas_de_login: 12,
          investigacoes: 0,
        };
        return json({ total: 21, pagina: 1, por_pagina: 20, itens: [linha] });
      }
      return json({});
    }),
  );
}

function abrir(caminho: string, pedidos: string[]) {
  servidor(pedidos);
  navegar(caminho);
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
}

test("o Início dá boas-vindas pelo nome de exibição", async () => {
  abrir("/painel", []);
  expect(await screen.findByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), Chefe da Silva!$/ })).toBeInTheDocument();
});

test("Investigações vem em páginas e busca pelo indicador", async () => {
  const pedidos: string[] = [];
  abrir("/investigacoes", pedidos);
  expect(await screen.findByText("10.0.1.0")).toBeInTheDocument();
  expect(screen.getByText("45 investigações")).toBeInTheDocument();
  fireEvent.click(screen.getByTitle("3"));
  expect(await screen.findByText("10.0.3.0")).toBeInTheDocument();
  expect(pedidos.at(-1)).toBe("/api/investigacoes?pagina=3");
  const busca = screen.getByLabelText("Buscar investigação");
  fireEvent.change(busca, { target: { value: "10.0" } });
  fireEvent.keyDown(busca, { key: "Enter", code: "Enter", keyCode: 13 });
  await waitFor(() => expect(pedidos.at(-1)).toBe("/api/investigacoes?pagina=1&busca=10.0"));
});

test("Usuários filtra, pagina e cadastra numa janela", async () => {
  const pedidos: string[] = [];
  abrir("/usuarios", pedidos);
  expect(await screen.findByText("conta1")).toBeInTheDocument();
  fireEvent.click(screen.getByTitle("2"));
  expect(await screen.findByText("conta2")).toBeInTheDocument();
  expect(pedidos.at(-1)).toBe("/api/usuarios?pagina=2");
  const busca = screen.getByLabelText("Buscar usuário");
  fireEvent.change(busca, { target: { value: "ana" } });
  fireEvent.keyDown(busca, { key: "Enter", code: "Enter", keyCode: 13 });
  // Filtro novo volta para a página 1.
  await waitFor(() => expect(pedidos.at(-1)).toBe("/api/usuarios?pagina=1&busca=ana"));
  fireEvent.mouseDown(screen.getByLabelText("Filtrar por papel"));
  fireEvent.click(await screen.findByTitle("Admin"));
  await waitFor(() => expect(pedidos.at(-1)).toBe("/api/usuarios?pagina=1&busca=ana&papel=admin"));
  // O cadastro abre numa janela, que fecha depois de cadastrar.
  expect(screen.queryByLabelText("Nome de usuário")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
  const janela = await screen.findByRole("dialog", { name: "Novo usuário" });
  fireEvent.change(within(janela).getByLabelText("Nome de usuário"), { target: { value: "nova" } });
  fireEvent.change(within(janela).getByLabelText("Senha"), { target: { value: "senha-bem-longa-1" } });
  fireEvent.change(within(janela).getByLabelText("Repita a senha"), { target: { value: "senha-bem-longa-1" } });
  fireEvent.click(within(janela).getByRole("button", { name: "Cadastrar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(pedidos).toContain("POST /api/usuarios");
});

test("Auditoria pagina a tabela e as sessões da janela", async () => {
  const pedidos: string[] = [];
  abrir("/auditoria", pedidos);
  const linha = (await screen.findByText("ana")).closest("tr") as HTMLElement;
  expect(screen.getByText("21 usuários")).toBeInTheDocument();
  fireEvent.click(within(linha).getByRole("button", { name: "Visualizar" }));
  const janela = await screen.findByRole("dialog", { name: "Sessões de ana" });
  expect(await within(janela).findByText("12 sessões nos últimos 90 dias. Clique numa sessão para ver a linha do tempo.")).toBeInTheDocument();
  fireEvent.click(within(janela).getAllByTitle("2")[0]);
  await waitFor(() => expect(pedidos.at(-1)).toBe("/api/auditoria/usuarios/ana/sessoes?pagina=2"));
  // Fora de sessão: 12 eventos, 10 por página.
  expect(within(janela).getByText("9.9.9.0")).toBeInTheDocument();
  expect(within(janela).queryByText("9.9.9.11")).toBeNull();
  const fora = within(janela).getByText(/Fora de sessão/).closest(".ant-card") as HTMLElement;
  fireEvent.click(within(fora).getByTitle("2"));
  expect(within(janela).getByText("9.9.9.11")).toBeInTheDocument();
});
