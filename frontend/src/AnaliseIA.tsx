import { Alert, Card, Flex, Tag, Typography } from "antd";
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
        title="Análise da IA indisponível. O resultado acima vem só das regras fixas."
      />
    );
  }
  return (
    <Card
      title="Análise da IA"
      extra={<Tag>confiança {CONFIANCA[analise.confianca] ?? analise.confianca}</Tag>}
    >
      <Typography.Paragraph>{analise.resumo}</Typography.Paragraph>
      {analise.tecnicas_mitre.length > 0 && (
        <Flex gap="small" align="center" wrap className="espaco">
          <Typography.Text type="secondary">MITRE ATT&amp;CK</Typography.Text>
          {analise.tecnicas_mitre.map((tecnica) => (
            <a key={tecnica} href={linkMitre(tecnica)} target="_blank" rel="noopener noreferrer">
              <Tag>{tecnica}</Tag>
            </a>
          ))}
        </Flex>
      )}
      {analise.recomendacoes.length > 0 && (
        <>
          <Typography.Text strong>Recomendações</Typography.Text>
          <ul>
            {analise.recomendacoes.map((recomendacao, posicao) => (
              <li key={`${posicao}-${recomendacao}`}>{recomendacao}</li>
            ))}
          </ul>
        </>
      )}
      <Typography.Text type="secondary">
        A IA explica o resultado; o veredito e a nota vêm das regras fixas.
      </Typography.Text>
    </Card>
  );
}
