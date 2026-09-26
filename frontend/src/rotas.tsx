// Roteador mínimo: cinco telas não justificam uma biblioteca de rotas.
import { type ReactNode, useEffect, useState } from "react";

export function navegar(caminho: string): void {
  window.history.pushState(null, "", caminho);
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
