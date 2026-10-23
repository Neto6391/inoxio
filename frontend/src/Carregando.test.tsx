import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { Investigacao } from "./Investigacao";
import { navegar } from "./rotas";

afterEach(() => {
  vi.unstubAllGlobals();
  navegar("/");
});

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

const BASE = {
  id: "1",
  tipo: "ip",
  valor: "8.8.8.8",
  veredito: "sem_evidencia",
  criada_em: "2026-10-23T12:00:00",
  nota: 0,
  rotulo: "Sem evidência de atividade maliciosa nas fontes consultadas",
  evidencias: [],
  reaproveitada: false,
};

const PRONTA = {
  resumo: "O IP é do Google.",
  tecnicas_mitre: [],
  recomendacoes: ["Confira o endereço."],
  confianca: "media",
  termos: [],
};

test("enquanto a IA escreve, a página mostra o carregamento e depois a explicação", async () => {
  const respostas = [
    { ...BASE, analise: null, analise_estado: "pendente" },
    { ...BASE, analise: null, analise_estado: "pendente" },
    { ...BASE, analise: PRONTA, analise_estado: "pronta" },
  ];
  const fetch = vi.fn(async () => json(respostas.length > 1 ? respostas.shift() : respostas[0]));
  vi.stubGlobal("fetch", fetch);
  render(<Investigacao id="1" intervalo={10} />);
  const aviso = await screen.findByRole("status");
  expect(aviso).toHaveTextContent("Escrevendo a explicação em linguagem simples");
  // O veredito já aparece enquanto a explicação não chega.
  expect(screen.getByText(/Sem evidência de atividade maliciosa/)).toBeInTheDocument();
  expect(await screen.findByText("O IP é do Google.")).toBeInTheDocument();
  expect(screen.queryByText("Escrevendo a explicação em linguagem simples")).toBeNull();
  const chamadas = fetch.mock.calls.length;
  await new Promise((pronto) => setTimeout(pronto, 50));
  // Pronta, a página para de perguntar.
  expect(fetch.mock.calls.length).toBe(chamadas);
});

test("se a explicação não chega, a página desiste e diz que está indisponível", async () => {
  const fetch = vi.fn(async () => json({ ...BASE, analise: null, analise_estado: "pendente" }));
  vi.stubGlobal("fetch", fetch);
  render(<Investigacao id="1" intervalo={5} consultas={3} />);
  expect(await screen.findByText(/Explicação indisponível/)).toBeInTheDocument();
  // A primeira leitura e mais as 3 consultas, nenhuma a mais.
  expect(fetch).toHaveBeenCalledTimes(4);
});

test("investigação já pronta não fica perguntando", async () => {
  const fetch = vi.fn(async () => json({ ...BASE, analise: PRONTA, analise_estado: "pronta" }));
  vi.stubGlobal("fetch", fetch);
  render(<Investigacao id="1" intervalo={5} />);
  expect(await screen.findByText("O IP é do Google.")).toBeInTheDocument();
  await new Promise((pronto) => setTimeout(pronto, 40));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
});

test("ao investigar, o painel mostra o carregamento enquanto as fontes respondem", async () => {
  let responder: (resposta: Response) => void = () => undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "ana", papel: "analista" }, csrf: "t" });
      if (caminho === "/api/investigacoes" && pedido.method === "POST") {
        return new Promise<Response>((resolver) => {
          responder = resolver;
        });
      }
      return json([]);
    }),
  );
  navegar("/painel");
  render(<App />);
  fireEvent.change(await screen.findByPlaceholderText(/exemplo.com/), { target: { value: "8.8.8.8" } });
  fireEvent.click(screen.getByRole("button", { name: "Investigar" }));
  expect(await screen.findByText("Consultando as fontes")).toBeInTheDocument();
  responder(json({ erro: "Entrada não reconhecida." }, 400));
  await waitFor(() => expect(screen.queryByText("Consultando as fontes")).toBeNull());
});

test("explicação indisponível oferece tentar de novo, e a nova chega", async () => {
  const pedidos: string[] = [];
  const leituras = [
    { ...BASE, analise: null, analise_estado: "indisponivel" },
    { ...BASE, analise: null, analise_estado: "pendente" },
    { ...BASE, analise: PRONTA, analise_estado: "pronta" },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      if (pedido.method === "POST") {
        pedidos.push(caminho);
        return json({ analise_estado: "pendente" }, 202);
      }
      return json(leituras.length > 1 ? leituras.shift() : leituras[0]);
    }),
  );
  render(<Investigacao id="1" intervalo={10} />);
  fireEvent.click(await screen.findByRole("button", { name: "Tentar explicar de novo" }));
  expect(await screen.findByText("O IP é do Google.")).toBeInTheDocument();
  expect(pedidos).toEqual(["/api/investigacoes/1/explicar"]);
});

test("explicação pronta não mostra o botão de tentar de novo", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => json({ ...BASE, analise: PRONTA, analise_estado: "pronta" })));
  render(<Investigacao id="1" />);
  expect(await screen.findByText("O IP é do Google.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tentar explicar de novo" })).toBeNull();
});

test("quando a página desiste de esperar, ainda dá para pedir de novo", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => json({ ...BASE, analise: null, analise_estado: "pendente" })));
  render(<Investigacao id="1" intervalo={5} consultas={2} />);
  expect(await screen.findByRole("button", { name: "Tentar explicar de novo" })).toBeInTheDocument();
});

test("explicação pronta que o filtro esvaziou não oferece pedir de novo", async () => {
  // O servidor diria que já está pronta; o botão só levaria a um erro.
  vi.stubGlobal("fetch", vi.fn(async () => json({ ...BASE, analise: null, analise_estado: "pronta" })));
  render(<Investigacao id="1" />);
  expect(await screen.findByText(/Explicação indisponível/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tentar explicar de novo" })).toBeNull();
});
