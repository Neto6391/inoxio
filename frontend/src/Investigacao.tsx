import { Card, Descriptions, Flex, Result, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { AnaliseIA } from "./AnaliseIA";
import { chamar, mensagemDeErro } from "./api";
import { comoTexto, quando, TagVeredito } from "./formato";
import { Link } from "./rotas";
import type { DetalheInvestigacao, Evidencia } from "./tipos";

// Sem <Table>: ela injeta um <style> sem nonce para medir a barra de rolagem, e a
// CSP bloqueia. Descriptions e List não fazem essa medição.
function Fonte({ evidencia }: { evidencia: Evidencia }) {
  const itens = [
    { key: "status", label: "Resultado", children: evidencia.status },
    ...Object.entries(evidencia.dados).map(([chave, valor]) => ({
      key: chave,
      label: chave,
      children: comoTexto(valor),
    })),
  ];
  return <Descriptions title={evidencia.fonte} size="small" bordered column={1} items={itens} />;
}

export function Investigacao({ id }: { id: string }) {
  const [detalhe, setDetalhe] = useState<DetalheInvestigacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    chamar<DetalheInvestigacao>(`/api/investigacoes/${id}`)
      .then(setDetalhe)
      .catch((falha) => setErro(mensagemDeErro(falha)));
  }, [id]);

  if (erro) {
    return <Result status="warning" title={erro} extra={<Link para="/">Voltar ao painel</Link>} />;
  }
  if (!detalhe) return <Spin />;

  return (
    <Flex vertical gap="large">
      <Typography.Title level={2}>
        {detalhe.valor} <Typography.Text type="secondary">({detalhe.tipo})</Typography.Text>
      </Typography.Title>
      <Card>
        <Flex gap="middle" align="center" wrap>
          <TagVeredito veredito={detalhe.veredito} texto={detalhe.rotulo} />
          <Typography.Text>Nota de risco: {detalhe.nota ?? "—"}</Typography.Text>
          <Typography.Text type="secondary">{quando(detalhe.criada_em)}</Typography.Text>
          {detalhe.reaproveitada && <Tag>reaproveitado de consulta com menos de 24 h</Tag>}
        </Flex>
      </Card>
      <Card title="Evidências por fonte" extra="texto de terceiros">
        {detalhe.evidencias.length === 0 ? (
          <Typography.Text type="secondary">Nenhuma fonte respondeu.</Typography.Text>
        ) : (
          <Flex vertical gap="middle">
            {detalhe.evidencias.map((evidencia) => (
              <Fonte key={evidencia.fonte} evidencia={evidencia} />
            ))}
          </Flex>
        )}
      </Card>
      <AnaliseIA analise={detalhe.analise} />
      <Link para="/">Voltar ao painel</Link>
    </Flex>
  );
}
