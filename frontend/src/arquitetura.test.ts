import { expect, test } from "vitest";

// O código das telas, como texto, sem os testes (que carregam texto hostil de propósito).
const FONTES = import.meta.glob(["./**/*.{ts,tsx}", "!./**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

test("as telas são lidas", () => {
  expect(Object.keys(FONTES).length).toBeGreaterThan(50);
});

test("o React nunca injeta HTML", () => {
  const injetam = Object.entries(FONTES)
    .filter(([, texto]) => texto.includes("dangerouslySetInnerHTML") || texto.includes("innerHTML"))
    .map(([arquivo]) => arquivo);
  expect(injetam).toEqual([]);
});

test("a interface nunca diz que algo é seguro ou limpo", () => {
  // Sem evidência não é garantia: nenhuma tela promete segurança.
  const dizem = Object.entries(FONTES)
    .filter(([, texto]) => /seguro|limpo/.test(texto.toLowerCase()))
    .map(([arquivo]) => arquivo);
  expect(dizem).toEqual([]);
});
