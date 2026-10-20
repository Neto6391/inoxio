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
  contas_ativas: 4,
  porcentagem_ativas: 80,
  usaram_30_dias: 2,
  porcentagem_uso_30_dias: 50,
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
  navegar("/painel");
  render(<App />);
  expect(await screen.findByText("Seus 10 mais pesquisados")).toBeInTheDocument();
  expect(screen.getByText("3× · Domínio")).toBeInTheDocument();
  expect(screen.getByText("8 antivírus detectaram · nota 85")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "https://mal.exemplo/x" })).toHaveAttribute("href", "/investigacoes/a1");
});

test("a visão geral do admin mostra as porcentagens e o ranking", async () => {
  servidor("admin");
  navegar("/visao-geral");
  render(<App />);
  expect(await screen.findByText("Os 10 que mais pesquisam")).toBeInTheDocument();
  expect(screen.getByText(/4 de 5 contas estão ativas/)).toBeInTheDocument();
  expect(screen.getByText("80%")).toBeInTheDocument();
  expect(screen.getByText("3 investigações")).toBeInTheDocument();
});

test("analista não tem a visão geral nem pede os números de todos", async () => {
  const pedidos: string[] = [];
  servidor("analista", pedidos);
  navegar("/visao-geral");
  render(<App />);
  expect(await screen.findByText("Página não encontrada")).toBeInTheDocument();
  expect(pedidos).not.toContain("/api/estatisticas/geral");
});
