import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

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
