import { Alert, Button, Card, Flex, Form, Input, List, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, ErroApi, mensagemDeErro, SESSAO_TROCADA } from "./api";
import { quando, TagVeredito } from "./formato";
import { Link, navegar } from "./rotas";
import type { ResumoInvestigacao } from "./tipos";

export function Painel() {
  const [recentes, setRecentes] = useState<ResumoInvestigacao[]>([]);
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

  return (
    <Flex vertical gap="large">
      <Typography.Title level={2}>Painel</Typography.Title>
      <Card title="Investigar indicador">
        <Typography.Paragraph type="secondary">
          Cole um IP, um domínio ou o hash (MD5, SHA-1 ou SHA-256) de um arquivo suspeito.
        </Typography.Paragraph>
        {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
        <Form layout="inline" onFinish={investigar}>
          <Form.Item
            name="entrada"
            className="campo-largo"
            rules={[{ required: true, message: "Informe um indicador" }]}
          >
            <Input maxLength={300} placeholder="8.8.8.8, exemplo.com ou um SHA-256" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={ocupado}>
            Investigar
          </Button>
        </Form>
      </Card>
      <Card title="Suas investigações recentes">
        {erroLista ? (
          <Alert type="error" showIcon title={erroLista} />
        ) : (
          <List<ResumoInvestigacao>
            dataSource={recentes}
            locale={{ emptyText: "Nenhuma investigação ainda." }}
            renderItem={(item) => (
              <List.Item extra={<TagVeredito veredito={item.veredito} />}>
                <List.Item.Meta
                  title={<Link para={`/investigacoes/${item.id}`}>{item.valor}</Link>}
                  description={`${item.tipo} · ${quando(item.criada_em)}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Flex>
  );
}
