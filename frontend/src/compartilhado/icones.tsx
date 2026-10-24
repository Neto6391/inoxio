import type { ReactNode } from "react";

// Ícones de traço, desenhados aqui: sem pacote a mais e sem <style> injetado.
function Icone({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icone"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconePainel = () => (
  <Icone>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </Icone>
);

export const IconeFechar = () => (
  <Icone>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icone>
);

export const IconeVoltar = () => (
  <Icone>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </Icone>
);

export const IconeBusca = () => (
  <Icone>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Icone>
);

export const IconeConta = () => (
  <Icone>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Icone>
);

export const IconeGrafico = () => (
  <Icone>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </Icone>
);

export const IconeUsuarios = () => (
  <Icone>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" />
    <circle cx="17.5" cy="9" r="2.5" />
    <path d="M17 14.5c2.5 0 4 1.7 4.5 4.5" />
  </Icone>
);

export const IconeEscudo = () => (
  <Icone>
    <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </Icone>
);

export const IconeRelogio = () => (
  <Icone>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icone>
);

export const IconeAlerta = () => (
  <Icone>
    <path d="M12 3l9 16H3z" />
    <path d="M12 10v4M12 17h.01" />
  </Icone>
);

export const IconeSol = () => (
  <Icone>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icone>
);

export const IconeLua = () => (
  <Icone>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Icone>
);

export const IconeLampada = () => (
  <Icone>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
  </Icone>
);

export const IconeCheck = () => (
  <Icone>
    <path d="M5 12l4 4 10-10" />
  </Icone>
);
