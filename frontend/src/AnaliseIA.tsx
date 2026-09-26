import { Alert, Card, Typography } from "antd";
import type { Analise } from "./tipos";

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
    <Card title="Análise da IA">
      <Typography.Paragraph>{analise.resumo}</Typography.Paragraph>
      {analise.tecnicas_mitre.length > 0 && (
        <Typography.Paragraph>
          {"MITRE ATT&CK: "}
          {analise.tecnicas_mitre.join(", ")}
        </Typography.Paragraph>
      )}
      <ul>
        {analise.recomendacoes.map((recomendacao) => (
          <li key={recomendacao}>{recomendacao}</li>
        ))}
      </ul>
      <Typography.Text type="secondary">
        Confiança declarada: {analise.confianca}. A IA explica; o veredito é calculado por regra
        fixa.
      </Typography.Text>
    </Card>
  );
}
