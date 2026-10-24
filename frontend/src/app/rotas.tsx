// Roteador mínimo: cinco telas não justificam uma biblioteca de rotas.
import { type ReactNode, useEffect, useState } from "react";
import { paginaDesatualizada } from "../compartilhado/api";

export function navegar(caminho: string): void {
  // Depois de um deploy, a troca de tela carrega a página inteira: vem o JavaScript novo.
  if (paginaDesatualizada()) {
    window.location.assign(caminho);
    return;
  }
  // O índice conta as telas abertas nesta aba: o Voltar só usa o histórico se houver
  // uma tela do próprio app antes desta.
  window.history.pushState({ indice: indiceAtual() + 1 }, "", caminho);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function indiceAtual(): number {
  const estado = window.history.state as { indice?: number } | null;
  return typeof estado?.indice === "number" ? estado.indice : 0;
}

export function temAnterior(): boolean {
  return indiceAtual() > 0;
}

// Troca o endereço sem criar uma entrada nova no histórico.
export function substituir(caminho: string): void {
  window.history.replaceState({ indice: indiceAtual() }, "", caminho);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useCaminho(): string {
  const [caminho, setCaminho] = useState(window.location.pathname);
  useEffect(() => {
    const atualizar = () => setCaminho(window.location.pathname);
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  return caminho;
}

type PropsLink = { para: string; children: ReactNode; className?: string };

export function Link({ para, children, className }: PropsLink) {
  return (
    <a
      href={para}
      className={className}
      onClick={(evento) => {
        evento.preventDefault();
        navegar(para);
      }}
    >
      {children}
    </a>
  );
}
