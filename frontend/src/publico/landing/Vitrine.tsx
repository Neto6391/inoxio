import { Traco } from "./Traco";

// A vitrine mostra um resultado real: google.com, investigado em produção em 23/10/2026,
// com o resumo que a IA escreveu. Nada aqui é inventado.
export function Vitrine() {
  return (
    <figure className="vitrine" aria-label="Exemplo real de resultado: investigação de google.com">
      <div className="vitrine-barra">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span className="vitrine-caminho">Início / Investigações / resultado</span>
      </div>
      <div className="vitrine-corpo">
        <div>
          <div className="vitrine-indicador">google.com</div>
          <div className="vitrine-meta">
            <span className="vitrine-etiqueta">Domínio</span>
            exemplo real, investigado em 23/10/2026
          </div>
        </div>
        <div className="vitrine-veredito">
          <svg width="88" height="56" viewBox="0 0 88 56" role="img" aria-label="Nota de risco 0 de 100">
            <path d="M8 50 A36 36 0 0 1 80 50" fill="none" stroke="var(--borda)" strokeWidth="8" strokeLinecap="round" />
            <text x="44" y="48" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--texto)">
              0
            </text>
          </svg>
          <div>
            <div className="vitrine-rotulo">Veredito</div>
            <div className="vitrine-resultado">Sem evidência de atividade maliciosa</div>
            <div className="vitrine-rotulo">nota de risco 0 de 100, por regra fixa</div>
          </div>
        </div>
        <div className="vitrine-explicacao">
          <div className="vitrine-explicacao-titulo">
            <Traco tamanho={18}>
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
            </Traco>
            Em linguagem simples
          </div>
          <p>
            O domínio google.com não tem evidências de ser malicioso. Os registros DNS mostram IPs pertencentes
            ao Google, que é um provedor de serviços de internet. Não há sinais de abuso ou atividade suspeita.
          </p>
        </div>
        <div className="vitrine-fatos">
          <span>VirusTotal respondeu</span>
          <span>10 IPs do site, quem opera cada um</span>
          <span>3 recomendações</span>
        </div>
      </div>
    </figure>
  );
}
