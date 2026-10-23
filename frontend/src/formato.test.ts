import { expect, test } from "vitest";
import { CORES_VEREDITO, corDaNota, diaCurto, quando } from "./formato";

test("a cor da nota segue as faixas do backend", () => {
  expect(corDaNota(24)).toBe(CORES_VEREDITO.sem_evidencia);
  expect(corDaNota(25)).toBe(CORES_VEREDITO.suspeito);
  expect(corDaNota(74)).toBe(CORES_VEREDITO.suspeito);
  expect(corDaNota(75)).toBe(CORES_VEREDITO.malicioso);
});

test("a data do banco (UTC) aparece no horário de Brasília, no formato brasileiro", () => {
  // 02:22 UTC do dia 23 ainda é 23:22 do dia 22 em Brasília.
  expect(quando("2026-10-23T02:22:15.123456")).toBe("22/10/2026 23:22:15");
  expect(quando("2026-10-23T15:04:05")).toBe("23/10/2026 12:04:05");
  expect(quando("2026-10-23T15:04:05+00:00")).toBe("23/10/2026 12:04:05");
  expect(quando("2026-01-05T03:00:00Z")).toBe("05/01/2026 00:00:00");
  expect(quando("não é data")).toBe("não é data");
});

test("o dia do gráfico vira dia e mês", () => {
  expect(diaCurto("2026-10-03")).toBe("03/10");
});
