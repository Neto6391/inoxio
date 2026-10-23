import { useSyncExternalStore } from "react";

export type Tema = "escuro" | "claro";

const CHAVE = "inoxio-tema";
const ouvintes = new Set<() => void>();

// A escolha fica só neste navegador. Sem escolha salva, segue o sistema.
function inicial(): Tema {
  try {
    const salvo = window.localStorage.getItem(CHAVE);
    if (salvo === "escuro" || salvo === "claro") return salvo;
  } catch {
    // Armazenamento bloqueado (janela anônima, por exemplo): segue o sistema.
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
}

let atual: Tema = inicial();
// O CSS lê o tema deste atributo; o antd recebe o algoritmo pelo ConfigProvider.
document.documentElement.dataset.tema = atual;

export function definirTema(tema: Tema) {
  atual = tema;
  document.documentElement.dataset.tema = tema;
  try {
    window.localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem armazenamento, vale só até recarregar a página.
  }
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function useTema(): Tema {
  return useSyncExternalStore(assinar, () => atual);
}
