import type { CSSProperties } from "react";
import { CORES_VEREDITO, diaCurto, NOMES_TIPO, NOMES_VEREDITO } from "../compartilhado/formato";

export type Dia = { dia: string; vereditos: Record<string, number> };

// De baixo para cima na barra; também a ordem da legenda.
const ORDEM = ["sem_evidencia", "inconclusivo", "desconhecido", "suspeito", "malicioso"];

// Cor e tamanho vão por variáveis CSS no style do React, que a CSP permite.
function variaveis(valores: Record<string, string>): CSSProperties {
  return valores as CSSProperties;
}

function total(contagens: Record<string, number>): number {
  return Object.values(contagens).reduce((soma, n) => soma + n, 0);
}

function Legenda({ vereditos }: { vereditos: string[] }) {
  return (
    <div className="legenda">
      {vereditos.map((veredito) => (
        <span key={veredito} className="legenda-item">
          <span className="amostra" style={variaveis({ "--cor": CORES_VEREDITO[veredito] })} />
          {NOMES_VEREDITO[veredito] ?? veredito}
        </span>
      ))}
    </div>
  );
}

export function GraficoDias({ dias }: { dias: Dia[] }) {
  const totais = dias.map((dia) => total(dia.vereditos));
  const maiorDia = Math.max(0, ...totais);
  // A escala nunca é zero, para a altura não dividir por zero num período vazio.
  const maximo = Math.max(1, maiorDia);
  const soma = totais.reduce((a, b) => a + b, 0);
  const presentes = ORDEM.filter((veredito) => dias.some((dia) => dia.vereditos[veredito]));
  const descricao = `Investigações por dia nos últimos ${dias.length} dias: ${soma} no total, no máximo ${maiorDia} num dia.`;
  return (
    <div>
      <div className="barras" role="img" aria-label={descricao}>
        {dias.map((dia, posicao) => (
          <div key={dia.dia} className="barra-dia" title={`${diaCurto(dia.dia)}: ${totais[posicao]}`}>
            {ORDEM.filter((veredito) => dia.vereditos[veredito]).map((veredito) => (
              <div
                key={veredito}
                className="fatia"
                data-veredito={veredito}
                style={variaveis({
                  "--altura": `${(100 * dia.vereditos[veredito]) / maximo}%`,
                  "--cor": CORES_VEREDITO[veredito],
                })}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="dias" aria-hidden="true">
        {dias.map((dia, posicao) => (
          // Um rótulo sim, outro não, terminando em hoje.
          <span key={dia.dia}>{(dias.length - 1 - posicao) % 2 === 0 ? diaCurto(dia.dia) : ""}</span>
        ))}
      </div>
      {presentes.length > 0 && (
        <div className="espaco-topo">
          <Legenda vereditos={presentes} />
        </div>
      )}
    </div>
  );
}

const RAIO = 15.9;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export function Rosca({ porVeredito }: { porVeredito: Record<string, number> }) {
  const soma = total(porVeredito);
  const vereditos = ORDEM.filter((veredito) => porVeredito[veredito]).sort(
    (a, b) => porVeredito[b] - porVeredito[a],
  );
  let andado = 0;
  const descricao = vereditos.map((v) => `${porVeredito[v]} ${NOMES_VEREDITO[v] ?? v}`).join(", ");
  return (
    <div>
      <svg className="rosca" width="170" height="170" viewBox="0 0 42 42" role="img" aria-label={descricao}>
        <circle className="rosca-trilho" cx="21" cy="21" r={RAIO} fill="none" strokeWidth="5" />
        {vereditos.map((veredito) => {
          const comprimento = (CIRCUNFERENCIA * porVeredito[veredito]) / soma;
          // Começa no topo (um quarto de volta) e segue no sentido horário.
          const deslocamento = CIRCUNFERENCIA / 4 - andado;
          andado += comprimento;
          return (
            <circle
              key={veredito}
              cx="21"
              cy="21"
              r={RAIO}
              fill="none"
              stroke={CORES_VEREDITO[veredito]}
              strokeWidth="5"
              strokeDasharray={`${comprimento} ${CIRCUNFERENCIA - comprimento}`}
              strokeDashoffset={deslocamento}
            />
          );
        })}
        <text className="rosca-total" x="21" y="22" textAnchor="middle" fontSize="7">
          {soma}
        </text>
        <text className="rosca-rotulo" x="21" y="27.5" textAnchor="middle" fontSize="3">
          investigações
        </text>
      </svg>
      <div className="espaco-topo">
        {vereditos.map((veredito) => (
          <div key={veredito} className="linha-legenda">
            <span className="amostra" style={variaveis({ "--cor": CORES_VEREDITO[veredito] })} />
            {NOMES_VEREDITO[veredito] ?? veredito}
            <b>{porVeredito[veredito]}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PorTipo({ porTipo }: { porTipo: Record<string, number> }) {
  const itens = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
  const maximo = Math.max(1, ...itens.map(([, n]) => n));
  return (
    <div>
      {itens.map(([tipo, quantas]) => (
        <div key={tipo} className="espaco">
          <div className="linha-legenda">
            {NOMES_TIPO[tipo] ?? tipo}
            <b>{quantas}</b>
          </div>
          <div className="barra-tipo">
            <div style={variaveis({ "--largura": `${(100 * quantas) / maximo}%` })} />
          </div>
        </div>
      ))}
    </div>
  );
}
