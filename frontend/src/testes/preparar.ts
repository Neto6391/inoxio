import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach } from "vitest";

afterEach(() => cleanup());

// O Form do antd atualiza a lista de erros num setTimeout de até 10 ms. Se o arquivo
// acaba antes, o setState cai depois que o jsdom foi desmontado, e o vitest conta um
// erro não tratado ("window is not defined") e falha a rodada, com todos os testes
// verdes. Medido num Linux com 2 CPUs: 8 de 20 rodadas. A espera deixa esses
// temporizadores dispararem com o jsdom ainda de pé.
afterAll(() => new Promise((pronto) => setTimeout(pronto, 50)));

// Com os arquivos rodando em paralelo, o primeiro render do App inteiro passa de 2 s;
// o padrão de 1 s dos findBy* fazia o painel falhar uma vez a cada três rodadas.
configure({ asyncUtilTimeout: 5000 });

// O antd consulta matchMedia; o jsdom não implementa.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// O jsdom não tem ResizeObserver, e o posicionamento dos popovers do antd usa.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
