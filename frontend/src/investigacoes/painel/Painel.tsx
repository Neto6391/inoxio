import { Alert, Button, Card, Flex, Form, Input, Typography } from "antd";
import { useState } from "react";
import { chamar, ErroApi, mensagemDeErro, SESSAO_TROCADA } from "../../compartilhado/api";
import { Carregando } from "../../compartilhado/Carregando";
import { acabaram } from "../Creditos";
import { MinhasEstatisticas } from "./Estatisticas";
import { ListaInvestigacoes } from "../Investigacoes";
import { Link, navegar } from "../../app/rotas";
import type { Creditos } from "../../compartilhado/tipos";

function saudacao(agora = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(agora),
  );
  if (hora < 12) return "Bom dia";
  return hora < 18 ? "Boa tarde" : "Boa noite";
}

export function Painel({ creditos, nome }: { creditos: Creditos | null; nome: string }) {
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
        <Typography.Title level={2}>
          {saudacao()}, {nome}!
        </Typography.Title>
        <Typography.Text type="secondary">
          Boas-vindas ao Inóxio. Aqui estão as suas investigações e o que elas encontraram; o
          veredito sai de regras fixas sobre o VirusTotal e o AbuseIPDB.
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
      {ocupado && (
        <Carregando
          titulo="Consultando as fontes"
          descricao="VirusTotal e AbuseIPDB costumam responder em poucos segundos. A explicação da IA vem logo depois, na página do resultado."
          linhas={2}
        />
      )}
      <MinhasEstatisticas creditos={creditos} />
      <Card title="Investigações recentes" extra={<Link para="/investigacoes">Ver todas</Link>}>
        <ListaInvestigacoes limite={5} />
      </Card>
    </Flex>
  );
}
