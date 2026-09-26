import { render, screen } from "@testing-library/react";
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
