import { Alert, Button, Card, Flex, Tag, Typography } from "antd";
import { IconeCheck, IconeLampada } from "../../compartilhado/icones";
import type { Analise, Termo } from "../../compartilhado/tipos";

const CONFIANCA: Record<string, string> = { baixa: "baixa", media: "média", alta: "alta" };

// O backend só aceita IDs no formato T1234 ou T1234.001, então o link é montado
// com um valor já validado, nunca com texto livre da IA.
function linkMitre(tecnica: string): string {
  return `https://attack.mitre.org/techniques/${tecnica.replace(".", "/")}/`;
}

type Props = {
  analise: Analise | null;
  // Presente quando a explicação pode ser pedida de novo (ficou indisponível).
  aoTentarDeNovo?: () => void;
  tentando?: boolean;
};

function PorFonte({ paragrafos }: { paragrafos: string[] }) {
  return (
    <div>
      <Typography.Text strong>O que cada fonte mostrou</Typography.Text>
      <div className="espaco-topo">
        {paragrafos.map((paragrafo, posicao) => (
          <Typography.Paragraph key={`${posicao}-${paragrafo.slice(0, 20)}`}>{paragrafo}</Typography.Paragraph>
        ))}
      </div>
    </div>
  );
}

function Glossario({ termos }: { termos: Termo[] }) {
  return (
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
  );
}

function OQueFazer({ recomendacoes }: { recomendacoes: string[] }) {
  return (
    <div>
      <Typography.Text strong>O que fazer</Typography.Text>
      <ul className="o-que-fazer espaco-topo">
        {recomendacoes.map((recomendacao, posicao) => (
          <li key={`${posicao}-${recomendacao}`}>
            <IconeCheck />
            <span>{recomendacao}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParaAnalistas({ analise }: { analise: Analise }) {
  return (
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
        <span>
          Confiança da análise:{" "}
          {analise.confianca ? (CONFIANCA[analise.confianca] ?? analise.confianca) : "não informada"}.
        </span>
      </Flex>
    </details>
  );
}

export function AnaliseIA({ analise, aoTentarDeNovo, tentando = false }: Props) {
  if (!analise) {
    return (
      <Alert
        type="info"
        showIcon
        title="Explicação indisponível. O resultado acima vem só das regras fixas."
        action={
          aoTentarDeNovo && (
            <Button size="small" onClick={aoTentarDeNovo} loading={tentando}>
              Tentar explicar de novo
            </Button>
          )
        }
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
        {porFonte.length > 0 && <PorFonte paragrafos={porFonte} />}
        {termos.length > 0 && <Glossario termos={termos} />}
        {analise.recomendacoes.length > 0 && <OQueFazer recomendacoes={analise.recomendacoes} />}
        <ParaAnalistas analise={analise} />
      </Flex>
    </Card>
  );
}
