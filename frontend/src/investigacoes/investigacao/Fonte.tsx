import { Card, Descriptions, Tag, Typography } from "antd";
import { comoTexto } from "../../compartilhado/formato";
import type { Evidencia } from "../../compartilhado/tipos";

const NOMES_FONTE: Record<string, string> = {
  abuseipdb: "AbuseIPDB",
  virustotal: "VirusTotal",
  virustotal_url: "VirusTotal (URL)",
};

const ROTULOS_CAMPO: Record<string, string> = {
  score: "Score de abuso",
  relatos: "Relatos",
  pais: "País",
  isp: "Provedor",
  malicioso: "Motores: malicioso",
  suspeito: "Motores: suspeito",
  reputacao: "Reputação na comunidade",
  tags: "Tags",
};

const STATUS: Record<string, { texto: string; cor: string }> = {
  ok: { texto: "respondeu", cor: "green" },
  falha: { texto: "falhou", cor: "red" },
  nao_encontrado: { texto: "não conhece o indicador", cor: "default" },
};

// Como a fonte respondeu, na etiqueta do canto do cartão.
export function statusDe(evidencia: Evidencia) {
  return STATUS[evidencia.status] ?? { texto: evidencia.status, cor: "default" };
}

// Números que só dão contexto a outro campo; não viram linha própria.
const CAMPOS_DE_CONTEXTO = new Set(["votos_positivos", "votos_negativos", "motores", "nao_acusaram"]);

function quantos(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

// A reputação do VirusTotal é a soma dos votos da comunidade: sem votos, o 0 não diz nada.
function reputacaoComContexto(dados: Record<string, unknown>): string | null {
  const { reputacao, votos_positivos: positivos, votos_negativos: negativos } = dados;
  if (typeof reputacao !== "number" || typeof positivos !== "number" || typeof negativos !== "number") {
    return null;
  }
  if (positivos + negativos === 0) return `${reputacao} (ninguém votou neste endereço)`;
  return `${reputacao} (${quantos(positivos, "voto positivo", "votos positivos")}, ${quantos(negativos, "negativo", "negativos")})`;
}

function itensDaFonte(dados: Record<string, unknown>) {
  const itens = [];
  for (const [chave, valor] of Object.entries(dados)) {
    if (CAMPOS_DE_CONTEXTO.has(chave)) continue;
    const texto = chave === "reputacao" ? (reputacaoComContexto(dados) ?? comoTexto(valor)) : comoTexto(valor);
    itens.push({ key: chave, label: ROTULOS_CAMPO[chave] ?? chave, children: texto });
    if (chave === "suspeito" && typeof dados.motores === "number" && dados.motores > 0) {
      itens.push({
        key: "motores",
        label: "Motores que analisaram",
        children: `${dados.motores} (${comoTexto(dados.nao_acusaram ?? 0)} não acusaram nada)`,
      });
    }
  }
  return itens;
}

// Sem <Table>: ela injeta um <style> sem nonce para medir a barra de rolagem, e a
// CSP bloqueia. Descriptions e List não fazem essa medição.
export function Fonte({ evidencia }: { evidencia: Evidencia }) {
  const status = statusDe(evidencia);
  const itens = itensDaFonte(evidencia.dados);
  return (
    <Card
      size="small"
      title={NOMES_FONTE[evidencia.fonte] ?? evidencia.fonte}
      extra={<Tag color={status.cor}>{status.texto}</Tag>}
    >
      {itens.length === 0 ? (
        <Typography.Text type="secondary">Sem dados desta fonte.</Typography.Text>
      ) : (
        <Descriptions size="small" column={1} items={itens} />
      )}
    </Card>
  );
}
