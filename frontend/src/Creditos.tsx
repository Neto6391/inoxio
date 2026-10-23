import type { Creditos } from "./tipos";

// A resposta só vale se tiver o formato esperado; fora dele, a tela segue sem créditos.
export function ehCreditos(dados: unknown): dados is Creditos {
  return typeof dados === "object" && dados !== null && typeof (dados as Creditos).usados === "number";
}

export function textoCreditos(creditos: Creditos): string {
  return creditos.cota === null
    ? `Sem cota diária · até ${creditos.por_hora} por hora`
    : `${creditos.restantes} de ${creditos.cota} créditos`;
}

export function acabaram(creditos: Creditos | null): boolean {
  return creditos !== null && creditos.restantes === 0;
}

// A largura vai pelo DOM (style do React), o que a CSP permite.
export function BarraCheia({ fracao }: { fracao: number }) {
  const largura = `${Math.round(Math.min(Math.max(fracao, 0), 1) * 100)}%`;
  return <div className="trilho-cheio" style={{ width: largura }} />;
}

function fracaoRestante(creditos: Creditos): number {
  return creditos.cota ? (creditos.restantes ?? 0) / creditos.cota : 0;
}

// O que a pílula do topo resume, por extenso, na dica.
export function dicaCreditos(creditos: Creditos): string {
  if (creditos.cota === null) {
    return `Sem cota diária: ${creditos.usados} usados hoje. Vale o limite de ${creditos.por_hora} investigações por hora.`;
  }
  return `${creditos.usados} de ${creditos.cota} créditos usados hoje. Voltam à meia-noite, horário de Brasília.`;
}

export function NumeroCreditos({ creditos }: { creditos: Creditos }) {
  if (creditos.cota === null) {
    return (
      <>
        <div className="numero-valor">Sem cota diária</div>
        <div className="numero-nota">
          {creditos.usados} usados hoje · até {creditos.por_hora} por hora
        </div>
      </>
    );
  }
  return (
    <>
      <div className="numero-valor">
        {creditos.restantes} <span className="numero-de">de {creditos.cota}</span>
      </div>
      <div className="trilho">
        <BarraCheia fracao={fracaoRestante(creditos)} />
      </div>
    </>
  );
}
