import { expect, test } from "vitest";
import { CORES_VEREDITO, corDaNota } from "./formato";

test("a cor da nota segue as faixas do backend", () => {
  expect(corDaNota(24)).toBe(CORES_VEREDITO.sem_evidencia);
  expect(corDaNota(25)).toBe(CORES_VEREDITO.suspeito);
  expect(corDaNota(74)).toBe(CORES_VEREDITO.suspeito);
  expect(corDaNota(75)).toBe(CORES_VEREDITO.malicioso);
});
