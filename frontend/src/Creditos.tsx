import type { Creditos } from "./tipos";

// A resposta só vale se tiver o formato esperado; fora dele, a tela segue sem créditos.
export function ehCreditos(dados: unknown): dados is Creditos {
  return typeof dados === "object" && dados !== null && typeof (dados as Creditos).usados === "number";
}

export function textoCreditos(creditos: Creditos): string {
  return creditos.cota === null
    ? "Sem limite de créditos"
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

export function CreditosLateral({ creditos }: { creditos: Creditos }) {
  return (
    <div className="creditos-lateral">
      <div className="numero-nota">Créditos de hoje</div>
      {creditos.cota === null ? (
        <>
          <div className="numero-valor">Sem limite</div>
          <div className="numero-nota">{creditos.usados} usados hoje.</div>
        </>
      ) : (
        <>
          <div className="numero-valor">
            {creditos.restantes} <span className="numero-de">de {creditos.cota} restantes</span>
          </div>
          <div className="trilho">
            <BarraCheia fracao={fracaoRestante(creditos)} />
          </div>
          <div className="numero-nota espaco-topo">Voltam à meia-noite, horário de Brasília.</div>
        </>
      )}
    </div>
  );
}

export function NumeroCreditos({ creditos }: { creditos: Creditos }) {
  if (creditos.cota === null) {
    return (
      <>
        <div className="numero-valor">Sem limite</div>
        <div className="numero-nota">{creditos.usados} usados hoje</div>
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
