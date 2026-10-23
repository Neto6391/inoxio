import { Alert, Card, Flex, Tag, Typography } from "antd";
import { IconeCheck, IconeLampada } from "./icones";
import type { Analise } from "./tipos";

const CONFIANCA: Record<string, string> = { baixa: "baixa", media: "média", alta: "alta" };

// O backend só aceita IDs no formato T1234 ou T1234.001, então o link é montado
// com um valor já validado, nunca com texto livre da IA.
function linkMitre(tecnica: string): string {
  return `https://attack.mitre.org/techniques/${tecnica.replace(".", "/")}/`;
}

export function AnaliseIA({ analise }: { analise: Analise | null }) {
  if (!analise) {
    return (
      <Alert
        type="info"
        showIcon
        title="Explicação indisponível. O resultado acima vem só das regras fixas."
      />
    );
  }
  const termos = analise.termos ?? [];
  const porFonte = analise.por_fonte ?? [];
  return (
    <Card
      title={
        <Flex gap="small" align="center">
          <IconeLampada />
          Em linguagem simples
        </Flex>
      }
    >
      <Flex vertical gap="large">
        <Typography.Paragraph className="espaco-topo">{analise.resumo}</Typography.Paragraph>
        {porFonte.length > 0 && (
          <div>
            <Typography.Text strong>O que cada fonte mostrou</Typography.Text>
            <div className="espaco-topo">
              {porFonte.map((paragrafo, posicao) => (
                <Typography.Paragraph key={`${posicao}-${paragrafo.slice(0, 20)}`}>{paragrafo}</Typography.Paragraph>
              ))}
            </div>
          </div>
        )}
        {termos.length > 0 && (
          <div>
            <Typography.Text strong>Termos que aparecem aqui</Typography.Text>
            <div className="glossario espaco-topo">
              {termos.map((item) => (
                <div key={item.termo} className="termo">
                  <strong>{item.termo}</strong>
                  <span>{item.significado}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {analise.recomendacoes.length > 0 && (
          <div>
            <Typography.Text strong>O que fazer</Typography.Text>
            <ul className="o-que-fazer espaco-topo">
              {analise.recomendacoes.map((recomendacao, posicao) => (
                <li key={`${posicao}-${recomendacao}`}>
                  <IconeCheck />
                  <span>{recomendacao}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <details className="para-analistas">
          <summary>Para analistas: técnicas MITRE ATT&amp;CK e confiança</summary>
          <Flex gap="small" align="center" wrap className="espaco-topo">
            {analise.tecnicas_mitre.length === 0 ? (
              <span>Nenhuma técnica indicada.</span>
            ) : (
              analise.tecnicas_mitre.map((tecnica) => (
                <a key={tecnica} href={linkMitre(tecnica)} target="_blank" rel="noopener noreferrer">
                  <Tag>{tecnica}</Tag>
                </a>
              ))
            )}
            <span>Confiança da análise: {CONFIANCA[analise.confianca] ?? analise.confianca}.</span>
          </Flex>
        </details>
      </Flex>
    </Card>
  );
}
