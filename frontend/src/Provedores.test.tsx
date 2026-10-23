import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Investigacao } from "./Investigacao";
import { provedoresDe } from "./provedores";

afterEach(() => vi.unstubAllGlobals());

const BASE = {
  id: "1",
  veredito: "sem_evidencia",
  rotulo: "Sem evidência",
  nota: 0,
  criada_em: "2026-10-23T12:00:00",
  reaproveitada: false,
  analise: null,
  analise_estado: "indisponivel",
};

function dns(...isps: string[]) {
  return {
    fonte: "dns",
    status: "ok",
    contexto: true,
    dados: { ips: isps.map((isp, n) => ({ ip: `104.18.0.${n}`, abuseipdb: "ok", score: 0, relatos: 1, pais: "US", isp })) },
  };
}

function abrir(detalhe: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(detalhe), { status: 200 })));
  render(<Investigacao id="1" />);
}

test("site atrás da Cloudflare explica, sem IA, por que os IPs são dela", async () => {
  abrir({ ...BASE, tipo: "url", valor: "https://www.crunchyroll.com/", evidencias: [dns("Cloudflare, Inc.", "Cloudflare, Inc.")] });
  const cartao = (await screen.findByText("Quem opera estes IPs")).closest(".ant-card") as HTMLElement;
  // Dois IPs da mesma empresa: uma explicação só.
  expect(within(cartao).getAllByText("Cloudflare")).toHaveLength(1);
  expect(within(cartao).getByText(/fica na frente de milhões de sites/)).toBeInTheDocument();
  expect(within(cartao).getByText(/não diz nada sobre este site em particular/)).toBeInTheDocument();
});

test("investigação de IP usa o provedor que o AbuseIPDB informou", async () => {
  abrir({
    ...BASE,
    tipo: "ip",
    valor: "8.8.8.8",
    evidencias: [{ fonte: "abuseipdb", status: "ok", dados: { score: 0, relatos: 0, pais: "US", isp: "Google LLC" } }],
  });
  const cartao = (await screen.findByText("Quem opera estes IPs")).closest(".ant-card") as HTMLElement;
  expect(within(cartao).getByText("Google")).toBeInTheDocument();
});

test("provedor desconhecido não ganha explicação inventada", async () => {
  abrir({ ...BASE, tipo: "url", valor: "https://exemplo.com/", evidencias: [dns("Provedor Pequeno Ltda")] });
  expect(await screen.findByText("IPs do site (DNS)")).toBeInTheDocument();
  expect(screen.queryByText("Quem opera estes IPs")).toBeNull();
});

test("o mapa reconhece os nomes como o AbuseIPDB escreve", () => {
  const nomes = (isps: string[]) => provedoresDe(isps).map((p) => p.nome);
  expect(nomes(["Cloudflare, Inc."])).toEqual(["Cloudflare"]);
  expect(nomes(["Akamai Technologies, Inc.", "Akamai International B.V."])).toEqual(["Akamai"]);
  expect(nomes(["Fastly, Inc."])).toEqual(["Fastly"]);
  expect(nomes(["Amazon.com, Inc.", "Amazon Technologies Inc."])).toEqual(["Amazon"]);
  expect(nomes(["Microsoft Corporation"])).toEqual(["Microsoft"]);
  expect(nomes(["Google LLC", "Cloudflare, Inc."])).toEqual(["Google", "Cloudflare"]);
  expect(nomes(["", "Artikel10 e.V."])).toEqual([]);
});
