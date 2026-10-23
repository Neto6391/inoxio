import { Alert, Button, Card, Flex, Form, Input, Typography } from "antd";
import { useState } from "react";
import { chamar, ErroApi, mensagemDeErro, SESSAO_TROCADA } from "./api";
import { acabaram } from "./Creditos";
import { MinhasEstatisticas } from "./Estatisticas";
import { ListaInvestigacoes } from "./Investigacoes";
import { Link, navegar } from "./rotas";
import type { Creditos } from "./tipos";

export function Painel({ creditos }: { creditos: Creditos | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const semCreditos = acabaram(creditos);

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
      <div>
        <Typography.Title level={2}>Painel</Typography.Title>
        <Typography.Text type="secondary">
          Suas investigações e o que elas encontraram. O veredito sai de regras fixas sobre o
          VirusTotal e o AbuseIPDB.
        </Typography.Text>
      </div>
      <Card title="Investigar indicador">
        {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
        {semCreditos && (
          <Alert
            type="warning"
            showIcon
            className="espaco"
            title="Seus créditos de hoje acabaram. Eles voltam à meia-noite, horário de Brasília."
          />
        )}
        <Form layout="inline" onFinish={investigar}>
          <Form.Item
            name="entrada"
            className="campo-largo"
            rules={[{ required: true, message: "Informe um indicador" }]}
          >
            <Input
              size="large"
              maxLength={2048}
              className="indicador"
              placeholder="https://site.com/pagina, exemplo.com, 8.8.8.8 ou um hash"
            />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" loading={ocupado} disabled={semCreditos}>
            Investigar
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" className="espaco-topo">
          Cole o endereço de um site, um domínio, um IP ou o hash (MD5, SHA-1 ou SHA-256) de um
          arquivo. De um endereço, o VirusTotal avalia a página e o domínio dela; o formato
          desarmado (hxxps://site[.]com) também funciona. Cada investigação usa 1 crédito, e o
          mesmo indicador investigado nas últimas 24 h volta na hora, com o resultado já consultado.
        </Typography.Paragraph>
      </Card>
      <MinhasEstatisticas creditos={creditos} />
      <Card title="Investigações recentes" extra={<Link para="/investigacoes">Ver todas</Link>}>
        <ListaInvestigacoes limite={5} />
      </Card>
    </Flex>
  );
}
