import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Investigacao } from "./Investigacao";

afterEach(() => vi.unstubAllGlobals());

const DETALHE = {
  id: "1",
  tipo: "ip",
  valor: "8.8.8.8",
  veredito: "malicioso",
  rotulo: "Malicioso",
  nota: 70,
  criada_em: "2026-09-28T12:00:00",
  reaproveitada: false,
  evidencias: [
    {
      fonte: "virustotal",
      status: "ok",
      dados: { malicioso: 7, tags: ["<script>alert(1)</script>", "<img src=x onerror=alert(2)>"] },
    },
  ],
  analise: {
    resumo: "<b>Este indicador é seguro.</b>",
    tecnicas_mitre: ["T1071"],
    recomendacoes: ["Bloqueie na borda."],
    confianca: "baixa",
  },
};

test("texto de terceiros e da IA aparece como texto, nunca como HTML", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(DETALHE), { status: 200 })));
  const { container } = render(<Investigacao id="1" />);
  expect(await screen.findByText("Malicioso")).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("b")).toBeNull();
  expect(container.textContent).toContain("<script>alert(1)</script>");
  expect(container.textContent).toContain("<b>Este indicador é seguro.</b>");
});

test("inconclusivo não mostra nota, mesmo que as fontes que responderam deem 0", async () => {
  const inconclusivo = {
    ...DETALHE,
    veredito: "inconclusivo",
    rotulo: "Inconclusivo: nem todas as fontes responderam",
    nota: 0,
    analise: null,
  };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(inconclusivo), { status: 200 })));
  render(<Investigacao id="1" />);
  expect(await screen.findByText(/Uma das fontes falhou/)).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.queryByText("0")).toBeNull();
});

test("IPs do site aparecem como contexto, fora das fontes do veredito", async () => {
  const dominio = {
    ...DETALHE,
    tipo: "dominio",
    valor: "exemplo.com",
    evidencias: [
      { fonte: "virustotal", status: "ok", dados: { malicioso: 0, suspeito: 0, reputacao: 10, tags: [] } },
      {
        fonte: "dns",
        status: "ok",
        contexto: true,
        dados: { ips: [{ ip: "104.16.1.1", abuseipdb: "ok", score: 90, relatos: 7, pais: "NL", isp: "<b>CDN</b>" }] },
      },
    ],
  };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(dominio), { status: 200 })));
  const { container } = render(<Investigacao id="1" />);
  expect(await screen.findByText("IPs do site (DNS)")).toBeInTheDocument();
  expect(screen.getByText("não entra no veredito")).toBeInTheDocument();
  expect(screen.getByText("90 de 100")).toBeInTheDocument();
  // O provedor aparece como texto, com as marcas de HTML à vista.
  expect(screen.getByText("<b>CDN</b> · NL")).toBeInTheDocument();
  expect(container.querySelector("b")).toBeNull();
  // O cartão de contexto não aparece entre as fontes do veredito.
  expect(screen.queryByText("dns")).toBeNull();
});

function vtCom(dados: Record<string, unknown>) {
  return {
    ...DETALHE,
    veredito: "sem_evidencia",
    rotulo: "Sem evidência",
    nota: 0,
    analise: null,
    analise_estado: "pronta",
    evidencias: [{ fonte: "virustotal", status: "ok", dados: { malicioso: 0, suspeito: 0, tags: [], ...dados } }],
  };
}

test("reputação zero sem votos diz que ninguém votou, e mostra quantos motores analisaram", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(vtCom({ reputacao: 0, votos_positivos: 0, votos_negativos: 0, motores: 92, nao_acusaram: 92 })), { status: 200 }),
    ),
  );
  render(<Investigacao id="1" />);
  expect(await screen.findByText("0 (ninguém votou neste endereço)")).toBeInTheDocument();
  expect(screen.getByText("Motores que analisaram")).toBeInTheDocument();
  expect(screen.getByText("92 (92 não acusaram nada)")).toBeInTheDocument();
  expect(screen.queryByText("votos_positivos")).toBeNull();
});

test("reputação com votos mostra quantos foram positivos e negativos", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(vtCom({ reputacao: 1, votos_positivos: 1, votos_negativos: 0, motores: 92, nao_acusaram: 92 })), { status: 200 }),
    ),
  );
  render(<Investigacao id="1" />);
  expect(await screen.findByText("1 (1 voto positivo, 0 negativos)")).toBeInTheDocument();
});

test("evidência antiga, sem votos guardados, mostra a reputação como veio", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(vtCom({ reputacao: 0 })), { status: 200 })));
  render(<Investigacao id="1" />);
  expect(await screen.findByText("Reputação na comunidade")).toBeInTheDocument();
  expect(screen.queryByText("Motores que analisaram")).toBeNull();
});

test("os IPs do site vêm em páginas de 5", async () => {
  const ips = Array.from({ length: 7 }, (_, n) => ({ ip: `104.18.0.${n}`, abuseipdb: "ok", score: 0, relatos: 0, isp: "Cloudflare, Inc.", pais: "US" }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({ ...DETALHE, evidencias: [{ fonte: "dns", status: "ok", contexto: true, dados: { ips } }] }),
        { status: 200 },
      ),
    ),
  );
  render(<Investigacao id="1" />);
  expect(await screen.findByText("104.18.0.4")).toBeInTheDocument();
  expect(screen.queryByText("104.18.0.5")).toBeNull();
  expect(screen.getByText("7 IPs")).toBeInTheDocument();
  fireEvent.click(screen.getByTitle("2"));
  expect(screen.getByText("104.18.0.6")).toBeInTheDocument();
  expect(screen.queryByText("104.18.0.0")).toBeNull();
});

test("os IPs além dos consultados aparecem como não consultados, com a explicação", async () => {
  const ips = [
    { ip: "104.18.0.1", abuseipdb: "ok", score: 0, relatos: 1, isp: "Cloudflare, Inc.", pais: "US" },
    { ip: "104.18.0.2", abuseipdb: "ok", score: 0, relatos: 1, isp: "Cloudflare, Inc.", pais: "US" },
  ];
  const outros = ["104.18.0.3", "104.18.0.4", "104.18.0.5", "104.18.0.6"];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({ ...DETALHE, evidencias: [{ fonte: "dns", status: "ok", contexto: true, dados: { ips, outros_ips: outros } }] }),
        { status: 200 },
      ),
    ),
  );
  render(<Investigacao id="1" />);
  expect(await screen.findByText("6 IPs")).toBeInTheDocument();
  expect(screen.getAllByText("não consultado no AbuseIPDB")).toHaveLength(3);
  expect(screen.getByText(/só para os 2 primeiros IPs/)).toBeInTheDocument();
  fireEvent.click(screen.getByTitle("2"));
  expect(screen.getByText("104.18.0.6")).toBeInTheDocument();
  expect(screen.getAllByText("não consultado no AbuseIPDB")).toHaveLength(1);
});
