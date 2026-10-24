import { useEffect, useState } from "react";
import { chamar } from "../compartilhado/api";
import type { Creditos } from "../compartilhado/tipos";
import { ehCreditos } from "../investigacoes/Creditos";

// Os créditos de quem está logado, lidos de novo a cada tela: depois de investigar, o
// número já mudou.
export function useCreditos(nome: string | undefined, caminho: string) {
  const [creditos, setCreditos] = useState<Creditos | null>(null);
  // Sobe quando os créditos devem ser lidos de novo sem mudar de tela.
  const [releitura, setReleitura] = useState(0);

  useEffect(() => {
    if (!nome) return;
    chamar<unknown>("/api/creditos")
      .then((dados) => setCreditos(ehCreditos(dados) ? dados : null))
      .catch(() => setCreditos(null));
  }, [nome, caminho, releitura]);

  // Créditos esgotados voltam à meia-noite de Brasília; com a tela aberta, lê de novo
  // nessa hora (o servidor manda o instante em UTC, sem fuso).
  useEffect(() => {
    if (!creditos || creditos.restantes !== 0) return;
    const renova = Date.parse(/[zZ]$/.test(creditos.renova_em) ? creditos.renova_em : `${creditos.renova_em}Z`);
    if (Number.isNaN(renova)) return;
    const espera = window.setTimeout(() => setReleitura((n) => n + 1), Math.max(0, renova - Date.now()) + 1000);
    return () => window.clearTimeout(espera);
  }, [creditos]);

  return creditos;
}
