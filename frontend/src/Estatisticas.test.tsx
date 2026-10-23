import { render, screen } from "@testing-library/react";
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

const MINHAS = {
  total: 5,
  por_veredito: { sem_evidencia: 3, malicioso: 1, suspeito: 1 },
  mais_pesquisados: [{ tipo: "dominio", valor: "exemplo.com", vezes: 3, veredito: "sem_evidencia" }],
  ameacas: [{ id: "a1", tipo: "url", valor: "https://mal.exemplo/x", veredito: "malicioso", nota: 85, deteccoes: 8 }],
};

const GERAL = {
  contas: 5,
  situacoes: { ativa: 4, desativada: 1, aguardando: 0, recusada: 0 },
  usaram_30_dias: 2,
  sem_uso_30_dias: ["beto", "parado"],
  investigacoes: 4,
  sites_distintos: 2,
  indicadores_distintos: 3,
  ameacas_distintas: 1,
  top_usuarios: [
    { nome: "ana", investigacoes: 3 },
    { nome: "beto", investigacoes: 1 },
  ],
};

function servidor(papel: string, pedidos: string[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      pedidos.push(caminho);
      if (caminho === "/api/sessao") return json({ usuario: { nome: "ana", papel }, csrf: "t" });
      if (caminho === "/api/estatisticas") return json(MINHAS);
      if (caminho === "/api/estatisticas/geral") return json(GERAL);
      return json([]);
    }),
  );
}

test("o painel mostra os mais pesquisados e as ameaças encontradas", async () => {
  servidor("analista");
  navegar("/inicio");
  render(<App />);
  expect(await screen.findByText("Seus 10 mais pesquisados")).toBeInTheDocument();
  expect(screen.getByText("3× · Domínio")).toBeInTheDocument();
  expect(screen.getByText("8 antivírus detectaram · nota 85")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "https://mal.exemplo/x" })).toHaveAttribute("href", "/investigacoes/a1");
});

test("a visão geral do admin mostra as contas por situação, quem não usou e o ranking", async () => {
  servidor("admin");
  navegar("/visao-geral");
  render(<App />);
  expect(await screen.findByText("Os 10 que mais pesquisam")).toBeInTheDocument();
  expect(screen.getByText("Contas por situação (5 no total)")).toBeInTheDocument();
  expect(screen.getByText("desativadas").previousElementSibling).toHaveTextContent("1");
  expect(screen.getByText(/de 4 contas ativas entraram/)).toBeInTheDocument();
  expect(screen.getByText("parado")).toBeInTheDocument();
  expect(screen.getByText("3 investigações")).toBeInTheDocument();
  expect(screen.getByText("1 investigação")).toBeInTheDocument();
});

test("analista não tem a visão geral nem pede os números de todos", async () => {
  const pedidos: string[] = [];
  servidor("analista", pedidos);
  navegar("/visao-geral");
  render(<App />);
  expect(await screen.findByText("Página não encontrada")).toBeInTheDocument();
  expect(pedidos).not.toContain("/api/estatisticas/geral");
});
