import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AnaliseIA } from "./AnaliseIA";
import { App } from "./App";
import { navegar } from "./rotas";
import { definirTema } from "./tema";

afterEach(() => {
  vi.unstubAllGlobals();
  navegar("/");
  definirTema("escuro");
});

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

function dias() {
  return Array.from({ length: 14 }, (_, n) => ({
    dia: `2026-10-${String(10 + n).padStart(2, "0")}`,
    vereditos: n === 13 ? { malicioso: 1, sem_evidencia: 2 } : n === 12 ? { suspeito: 1 } : {},
  }));
}

const ESTATISTICAS = {
  total: 4,
  por_veredito: { sem_evidencia: 2, malicioso: 1, suspeito: 1 },
  por_tipo: { url: 3, ip: 1 },
  por_dia: dias(),
  mais_pesquisados: [],
  ameacas: [],
};

const CREDITOS = { cota: 10, usados: 3, restantes: 7, renova_em: "2026-10-24T03:00:00" };

function servidor(papel = "analista", extras: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string) => {
      if (caminho === "/api/sessao") return json({ usuario: { nome: "ana", papel }, csrf: "t" });
      if (caminho in extras) return json(extras[caminho]);
      if (caminho === "/api/estatisticas") return json(ESTATISTICAS);
      if (caminho === "/api/creditos") return json(CREDITOS);
      if (caminho === "/api/investigacoes") {
        return json([{ id: "a1", tipo: "ip", valor: "8.8.8.8", veredito: "sem_evidencia", criada_em: "2026-10-23T02:22:15.5" }]);
      }
      return json([]);
    }),
  );
}

test("os créditos aparecem no topo, com a explicação na dica, e no painel", async () => {
  servidor();
  navegar("/painel");
  render(<App />);
  const pilula = await screen.findByText("7 de 10 créditos");
  // O cartão da lateral saiu: a explicação mora na dica da pílula.
  expect(screen.queryByText("Créditos de hoje")).toBeNull();
  fireEvent.mouseEnter(pilula);
  expect(
    await screen.findByText("3 de 10 créditos usados hoje. Voltam à meia-noite, horário de Brasília."),
  ).toBeInTheDocument();
  const cartao = (await screen.findByText("Créditos restantes")).closest(".ant-card") as HTMLElement;
  expect(within(cartao).getByText("de 10")).toBeInTheDocument();
});

test("sem cota, os créditos aparecem como sem limite", async () => {
  servidor("admin", { "/api/creditos": { cota: null, usados: 2, restantes: null, renova_em: "x", por_hora: 20 } });
  navegar("/painel");
  render(<App />);
  expect(await screen.findByText("Sem cota diária · até 20 por hora")).toBeInTheDocument();
});

test("créditos esgotados avisam e travam o botão de investigar", async () => {
  servidor("analista", { "/api/creditos": { cota: 10, usados: 10, restantes: 0, renova_em: "x" } });
  navegar("/painel");
  render(<App />);
  expect(await screen.findByText(/Seus créditos de hoje acabaram/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Investigar" })).toBeDisabled();
});

test("os gráficos mostram os 14 dias por veredito, a rosca e os tipos", async () => {
  servidor();
  navegar("/painel");
  const { container } = render(<App />);
  expect(await screen.findByRole("img", { name: /4 no total, no máximo 3 num dia/ })).toBeInTheDocument();
  const barras = container.querySelectorAll(".barra-dia");
  expect(barras).toHaveLength(14);
  const hoje = [...barras[13].querySelectorAll(".fatia")].map((fatia) => fatia.getAttribute("data-veredito"));
  expect(hoje).toEqual(["sem_evidencia", "malicioso"]);
  // O dia mais cheio (3) ocupa a altura toda: 2 sem evidência são dois terços dela.
  const alturas = [...barras[13].querySelectorAll<HTMLElement>(".fatia")].map((fatia) =>
    parseFloat(fatia.style.getPropertyValue("--altura")),
  );
  expect(alturas[0]).toBeCloseTo(66.67, 1);
  expect(alturas[0] + alturas[1]).toBeCloseTo(100, 5);
  expect(barras[0].querySelectorAll(".fatia")).toHaveLength(0);
  expect(screen.getByText("1 maliciosa, 1 suspeita")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "2 Sem evidência, 1 Suspeito, 1 Malicioso" })).toBeInTheDocument();
  const tipos = screen.getByText("Por tipo de indicador").closest(".ant-card") as HTMLElement;
  expect(within(tipos).getByText("URL")).toBeInTheDocument();
  expect(within(tipos).getByText("3")).toBeInTheDocument();
});

test("o botão do tema troca entre escuro e claro e lembra a escolha", async () => {
  servidor();
  navegar("/painel");
  render(<App />);
  const botao = await screen.findByRole("button", { name: "Mudar para o modo claro" });
  expect(document.documentElement.dataset.tema).toBe("escuro");
  fireEvent.click(botao);
  expect(document.documentElement.dataset.tema).toBe("claro");
  expect(window.localStorage.getItem("inoxio-tema")).toBe("claro");
  fireEvent.click(screen.getByRole("button", { name: "Mudar para o modo escuro" }));
  expect(document.documentElement.dataset.tema).toBe("escuro");
  expect(window.localStorage.getItem("inoxio-tema")).toBe("escuro");
});

test("o menu lateral leva às investigações, com a data de Brasília", async () => {
  servidor();
  navegar("/painel");
  render(<App />);
  const menu = await screen.findByRole("navigation", { name: "Menu principal" });
  expect(within(menu).getByRole("link", { name: "Início" })).toHaveAttribute("href", "/painel");
  expect(within(menu).getByRole("link", { name: "Minha conta" })).toHaveAttribute("href", "/conta");
  expect(within(menu).queryByText("Administração")).toBeNull();
  fireEvent.click(within(menu).getByRole("link", { name: "Investigações" }));
  expect(await screen.findByRole("heading", { name: "Investigações" })).toBeInTheDocument();
  expect(await screen.findByText("IP · 22/10/2026 23:22:15")).toBeInTheDocument();
});

test("a explicação da IA vem em linguagem simples, com o glossário", () => {
  render(
    <AnaliseIA
      analise={{
        resumo: "Os IPs são da Cloudflare.",
        tecnicas_mitre: ["T1566"],
        recomendacoes: ["Confira o endereço antes de digitar a senha."],
        confianca: "alta",
        termos: [{ termo: "Cloudflare", significado: "Empresa que fica na frente de muitos sites." }],
      }}
    />,
  );
  expect(screen.getByText("Em linguagem simples")).toBeInTheDocument();
  expect(screen.getByText("Cloudflare")).toBeInTheDocument();
  expect(screen.getByText("Empresa que fica na frente de muitos sites.")).toBeInTheDocument();
  expect(screen.getByText("O que fazer")).toBeInTheDocument();
  expect(screen.getByText("Para analistas: técnicas MITRE ATT&CK e confiança")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "T1566" })).toHaveAttribute("href", "https://attack.mitre.org/techniques/T1566/");
  expect(screen.queryByText(/A IA explica o resultado/)).toBeNull();
});

test("análise antiga, sem glossário, ainda aparece", async () => {
  render(<AnaliseIA analise={{ resumo: "Resumo antigo.", tecnicas_mitre: [], recomendacoes: [], confianca: "baixa" }} />);
  expect(screen.getByText("Resumo antigo.")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("Termos que aparecem aqui")).toBeNull());
});

test("o painel mostra as 5 investigações mais recentes e o caminho para todas", async () => {
  const lista = Array.from({ length: 7 }, (_, n) => ({
    id: `i${n}`,
    tipo: "ip",
    valor: `10.0.0.${n}`,
    veredito: "sem_evidencia",
    criada_em: "2026-10-23T12:00:00",
  }));
  servidor("analista", { "/api/investigacoes": lista });
  navegar("/painel");
  render(<App />);
  const cartao = (await screen.findByText("Investigações recentes")).closest(".ant-card") as HTMLElement;
  await within(cartao).findByText("10.0.0.0");
  expect(within(cartao).getByText("10.0.0.4")).toBeInTheDocument();
  expect(within(cartao).queryByText("10.0.0.5")).toBeNull();
  expect(within(cartao).getByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/investigacoes");
});

test("com a tela aberta, os créditos voltam sozinhos na hora da renovação", async () => {
  // O servidor manda a hora em UTC, sem fuso; aqui, um instante logo à frente.
  const renova = new Date(Date.now() + 300).toISOString().replace("Z", "");
  const respostas = [
    { cota: 10, usados: 10, restantes: 0, renova_em: renova },
    { cota: 10, usados: 0, restantes: 10, renova_em: "2099-01-01T03:00:00" },
  ];
  servidor("analista");
  const fetchBase = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido?: RequestInit) =>
      caminho === "/api/creditos" ? json(respostas.length > 1 ? respostas.shift() : respostas[0]) : fetchBase(caminho, pedido),
    ),
  );
  navegar("/painel");
  render(<App />);
  expect(await screen.findByText(/Seus créditos de hoje acabaram/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Investigar" })).toBeDisabled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Investigar" })).toBeEnabled(), { timeout: 4000 });
  expect(screen.getByText("10 de 10 créditos")).toBeInTheDocument();
});

test("a explicação mostra o que cada fonte mostrou, um parágrafo por fonte", () => {
  render(
    <AnaliseIA
      analise={{
        resumo: "Nenhuma fonte acusou o site.",
        tecnicas_mitre: [],
        recomendacoes: [],
        confianca: "media",
        termos: [],
        por_fonte: [
          "O VirusTotal passa o endereço por dezenas de antivírus. Nenhum acusou nada.",
          "O AbuseIPDB reúne denúncias de abuso. Os IPs do site têm 1 denúncia cada.",
        ],
      }}
    />,
  );
  const secao = screen.getByText("O que cada fonte mostrou").closest("div") as HTMLElement;
  expect(within(secao).getByText(/dezenas de antivírus/)).toBeInTheDocument();
  expect(within(secao).getByText(/1 denúncia cada/)).toBeInTheDocument();
});

test("análise sem explicação por fonte não mostra a seção vazia", () => {
  render(<AnaliseIA analise={{ resumo: "Resumo.", tecnicas_mitre: [], recomendacoes: [], confianca: "baixa" }} />);
  expect(screen.queryByText("O que cada fonte mostrou")).toBeNull();
});

test("sem confiança informada, a tela diz isso em vez de ficar em branco", () => {
  render(<AnaliseIA analise={{ resumo: "Resumo.", tecnicas_mitre: [], recomendacoes: [], confianca: null }} />);
  expect(screen.getByText(/Confiança da análise: não informada/)).toBeInTheDocument();
});
