import { useEffect, useState } from "react";

// O token dos links do e-mail vem depois do "#", que o navegador não manda ao servidor.
// Lido sem apagar, porque o StrictMode chama o inicializador duas vezes; a barra é limpa
// depois. Colar outro link na mesma página só troca o "#", sem recarregar: o token novo
// vale, e `aoTrocar` avisa quem precisa esquecer o resultado do anterior.
export function useTokenDaBarra(aoTrocar?: () => void): string {
  const [token, setToken] = useState(() => window.location.hash.slice(1));

  useEffect(() => {
    function lerDaBarra() {
      const novo = window.location.hash.slice(1);
      if (!novo) return;
      setToken(novo);
      aoTrocar?.();
      window.history.replaceState(null, "", window.location.pathname);
    }
    lerDaBarra();
    window.addEventListener("hashchange", lerDaBarra);
    return () => window.removeEventListener("hashchange", lerDaBarra);
    // Só na montagem: quem chama passa um setter de estado, que não muda.
  }, []);

  return token;
}
