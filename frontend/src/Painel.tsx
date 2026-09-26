import { Alert, Button, Card, Empty, Flex, Form, Input, List, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, ErroApi, mensagemDeErro, SESSAO_TROCADA } from "./api";
import { NOMES_TIPO, quando, TagVeredito } from "./formato";
import { navegar } from "./rotas";
import type { ResumoInvestigacao } from "./tipos";

export function Painel() {
  const [recentes, setRecentes] = useState<ResumoInvestigacao[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    chamar<ResumoInvestigacao[]>("/api/investigacoes")
      .then(setRecentes)
      .catch((falha) => setErroLista(mensagemDeErro(falha)));
  }, []);

  async function investigar({ entrada }: { entrada: string }) {
    setOcupado(true);
    setErro(null);
    try {
      const corpo = { entrada };
      const { id } = await chamar<{ id: string }>("/api/investigacoes", { metodo: "POST", corpo });
      navegar(`/investigacoes/${id}`);
    } catch (falha) {
      if (falha instanceof ErroApi && falha.status === 403) {
        window.dispatchEvent(new Event(SESSAO_TROCADA));
      }
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  function listaDeRecentes() {
    if (erroLista) return <Alert type="error" showIcon title={erroLista} />;
    if (recentes === null) return <Skeleton active paragraph={{ rows: 3 }} />;
    if (recentes.length === 0) {
      return <Empty description="Nenhuma investigação ainda." image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    return (
      <List<ResumoInvestigacao>
        dataSource={recentes}
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

  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Painel</Typography.Title>
        <Typography.Text type="secondary">
          O veredito sai de regras fixas sobre o VirusTotal e o AbuseIPDB. A IA só explica.
        </Typography.Text>
      </div>
      <Card title="Investigar indicador">
        {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
        <Form layout="inline" onFinish={investigar}>
          <Form.Item
            name="entrada"
            className="campo-largo"
            rules={[{ required: true, message: "Informe um indicador" }]}
          >
            <Input
              size="large"
              maxLength={300}
              className="indicador"
              placeholder="8.8.8.8, exemplo.com ou um SHA-256"
            />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" loading={ocupado}>
            Investigar
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" className="espaco-topo">
          Aceita IP público (v4 ou v6), domínio ou hash MD5, SHA-1 ou SHA-256. O mesmo indicador
          investigado nas últimas 24 h volta na hora, sem gastar a cota das fontes.
        </Typography.Paragraph>
      </Card>
      <Card title="Suas investigações recentes">{listaDeRecentes()}</Card>
    </Flex>
  );
}
