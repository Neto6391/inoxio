import { Alert, Card, Empty, Flex, List, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { NOMES_TIPO, quando, TagVeredito } from "./formato";
import { navegar } from "./rotas";
import type { ResumoInvestigacao } from "./tipos";

export function ListaInvestigacoes({ limite }: { limite?: number }) {
  const [itens, setItens] = useState<ResumoInvestigacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    chamar<ResumoInvestigacao[]>("/api/investigacoes")
      .then(setItens)
      .catch((falha) => setErro(mensagemDeErro(falha)));
  }, []);

  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (itens === null) return <Skeleton active paragraph={{ rows: 3 }} />;
  if (itens.length === 0) {
    return <Empty description="Nenhuma investigação ainda." image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  return (
    <List<ResumoInvestigacao>
      dataSource={limite ? itens.slice(0, limite) : itens}
      renderItem={(item) => (
        <List.Item
          className="item-recente"
          onClick={() => navegar(`/investigacoes/${item.id}`)}
          extra={<TagVeredito veredito={item.veredito} />}
        >
          <List.Item.Meta
            title={<span className="indicador">{item.valor}</span>}
            description={`${NOMES_TIPO[item.tipo] ?? item.tipo} · ${quando(item.criada_em)}`}
          />
        </List.Item>
      )}
    />
  );
}

export function Investigacoes() {
  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Investigações</Typography.Title>
        <Typography.Text type="secondary">
          As suas 50 investigações mais recentes, da mais nova para a mais antiga. Horários de Brasília.
        </Typography.Text>
      </div>
      <Card>
        <ListaInvestigacoes />
      </Card>
    </Flex>
  );
}
