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

// A resposta de uma página fica presa até o teste soltar: o carregando é visto sem
// depender do relógio.
let soltar: () => void = () => undefined;
let trava: Promise<void> = Promise.resolve();
function prender() {
  trava = new Promise((pronto) => {
    soltar = pronto;
  });
}

function servidor(pedidos: string[]) {
  trava = Promise.resolve();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (caminho === "/api/sessao") return json({ usuario: ADMIN, csrf: "t" });
      if (caminho.startsWith("/api/investigacoes?")) {
        pedidos.push(caminho);
        await trava;
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
        const busca = new URLSearchParams(caminho.split("?")[1] ?? "");
        const numero = Number(busca.get("pagina") || 1);
        const numeroFora = Number(busca.get("pagina_fora") || 1);
        await trava;
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
          sessoes: { total: 12, pagina: numero, por_pagina: 5, itens: [sessao(0), sessao(1)] },
          fora_de_sessao: {
            total: 7,
            pagina: numeroFora,
            por_pagina: 5,
            itens: Array.from({ length: numeroFora === 1 ? 5 : 2 }, (_, n) => ({
              quando: `2026-10-22T10:0${n}:00`,
              tipo: "login_falhou",
              nome: "senha errada",
              ip: `9.9.${numeroFora}.${n}`,
              detalhe: "",
            })),
          },
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
  abrir("/inicio", []);
  expect(await screen.findByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), Chefe da Silva!$/ })).toBeInTheDocument();
});

test("Investigações vem em páginas e busca pelo indicador", async () => {
  const pedidos: string[] = [];
  abrir("/investigacoes", pedidos);
  expect(await screen.findByText("10.0.1.0")).toBeInTheDocument();
  expect(screen.getByText("45 investigações")).toBeInTheDocument();
  // O tamanho da página é do servidor: um número escrito na tela já mentiu uma vez (20 contra 5).
  expect(screen.queryByText(/por página/)).toBeNull();
  prender();
  fireEvent.click(screen.getByTitle("3"));
  expect(await screen.findByText("Carregando a página 3")).toBeInTheDocument();
  soltar();
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
  expect(within(janela).getByText("12 sessões")).toBeInTheDocument();
  // Trocar de página mostra o carregando e depois as sessões da página nova.
  prender();
  fireEvent.click(within(janela).getAllByTitle("2")[0]);
  expect(await within(janela).findByText("Carregando a página 2 das sessões")).toBeInTheDocument();
  soltar();
  expect(await within(janela).findByText("22/10/2026 09:00:00")).toBeInTheDocument();
  expect(within(janela).queryByText(/Carregando a página/)).toBeNull();
  expect(pedidos.at(-1)).toBe("/api/auditoria/usuarios/ana/sessoes?pagina=2");
  // Fora de sessão tem a própria página, também pedida ao servidor.
  expect(within(janela).getByText("9.9.1.0")).toBeInTheDocument();
  const fora = within(janela).getByText(/Fora de sessão/).closest(".ant-card") as HTMLElement;
  prender();
  fireEvent.click(within(fora).getByTitle("2"));
  expect(await within(fora).findByText("Carregando a página 2")).toBeInTheDocument();
  soltar();
  expect(await within(janela).findByText("9.9.2.1")).toBeInTheDocument();
  expect(pedidos.at(-1)).toBe("/api/auditoria/usuarios/ana/sessoes?pagina=2&pagina_fora=2");
});

test("com uma página só, a paginação continua visível", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: ADMIN, csrf: "t" });
      if (caminho.startsWith("/api/investigacoes?")) return json(investigacoes(3, 1));
      return json({});
    }),
  );
  navegar("/investigacoes");
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
  expect(await screen.findByText("3 investigações")).toBeInTheDocument();
  expect(screen.getByTitle("1")).toBeInTheDocument();
});

test("o total vai no singular quando há um item só", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: ADMIN, csrf: "t" });
      if (caminho.startsWith("/api/investigacoes?")) return json(investigacoes(1, 1));
      return json({});
    }),
  );
  navegar("/investigacoes");
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
  expect(await screen.findByText("1 investigação")).toBeInTheDocument();
  expect(screen.getByTitle("1")).toBeInTheDocument();
});
