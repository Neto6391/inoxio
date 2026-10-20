import { Alert, Card, Col, Empty, Flex, List, Progress, Row, Skeleton, Statistic, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { NOMES_TIPO, TagVeredito } from "./formato";
import { Link } from "./rotas";

type MaisPesquisado = { tipo: string; valor: string; vezes: number; veredito: string };
type Ameaca = { id: string; tipo: string; valor: string; veredito: string; nota: number | null; deteccoes: number };
type Minhas = {
  total: number;
  por_veredito: Record<string, number>;
  mais_pesquisados: MaisPesquisado[];
  ameacas: Ameaca[];
};
type Geral = {
  contas: number;
  contas_ativas: number;
  porcentagem_ativas: number;
  usaram_30_dias: number;
  porcentagem_uso_30_dias: number;
  investigacoes: number;
  sites_distintos: number;
  indicadores_distintos: number;
  ameacas_distintas: number;
  top_usuarios: { nome: string; investigacoes: number }[];
};

function useDados<T>(caminho: string) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    chamar<T>(caminho)
      .then(setDados)
      .catch((falha) => setErro(mensagemDeErro(falha)));
  }, [caminho]);
  return { dados, erro };
}

// Barra proporcional ao maior valor da lista: dá para comparar de relance.
function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  return (
    <Progress percent={maximo ? (100 * valor) / maximo : 0} showInfo={false} size="small" status="normal" />
  );
}

export function MinhasEstatisticas() {
  const { dados, erro } = useDados<Minhas>("/api/estatisticas");
  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (!dados) return <Skeleton active />;
  // Sem investigações (ou resposta fora do formato), o painel segue sem esta parte.
  if (!dados.total || !dados.por_veredito) return null;

  const ameacas = (dados.por_veredito.malicioso ?? 0) + (dados.por_veredito.suspeito ?? 0);
  const maximo = Math.max(...dados.mais_pesquisados.map((item) => item.vezes));
  return (
    <Flex vertical gap="large">
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Investigações" value={dados.total} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Ameaças encontradas" value={ameacas} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Maliciosos" value={dados.por_veredito.malicioso ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Sem evidência" value={dados.por_veredito.sem_evidencia ?? 0} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Seus 10 mais pesquisados" className="cartao-estatistica">
            <List<MaisPesquisado>
              dataSource={dados.mais_pesquisados}
              renderItem={(item) => (
                <List.Item>
                  <Flex vertical className="item-barra">
                    <Flex justify="space-between" align="center" gap="small">
                      <span className="indicador texto-cortado">{item.valor}</span>
                      <Flex gap="small" align="center" className="sem-quebra">
                        <Typography.Text type="secondary">
                          {item.vezes}× · {NOMES_TIPO[item.tipo] ?? item.tipo}
                        </Typography.Text>
                        <TagVeredito veredito={item.veredito} />
                      </Flex>
                    </Flex>
                    <Barra valor={item.vezes} maximo={maximo} />
                  </Flex>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Ameaças que você encontrou" className="cartao-estatistica">
            {dados.ameacas.length === 0 ? (
              <Empty description="Nenhuma ameaça até agora." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List<Ameaca>
                dataSource={dados.ameacas}
                renderItem={(item) => (
                  <List.Item extra={<TagVeredito veredito={item.veredito} />}>
                    <List.Item.Meta
                      title={
                        <Link para={`/investigacoes/${item.id}`}>
                          <span className="indicador texto-cortado">{item.valor}</span>
                        </Link>
                      }
                      description={`${item.deteccoes} antivírus detectaram · nota ${item.nota ?? "—"}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}

export function VisaoGeral() {
  const { dados, erro } = useDados<Geral>("/api/estatisticas/geral");
  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (!dados) return <Skeleton active />;

  const maximo = Math.max(0, ...dados.top_usuarios.map((item) => item.investigacoes));
  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Visão geral</Typography.Title>
        <Typography.Text type="secondary">Uso do sistema por todos os usuários.</Typography.Text>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Contas ativas">
            <Flex gap="large" align="center">
              <Progress type="circle" size={96} percent={dados.porcentagem_ativas} status="normal" />
              <Typography.Text>
                {dados.contas_ativas} de {dados.contas} contas estão ativas. O resto foi desativado ou
                ainda espera a confirmação do e-mail.
              </Typography.Text>
            </Flex>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Usaram nos últimos 30 dias">
            <Flex gap="large" align="center">
              <Progress type="circle" size={96} percent={dados.porcentagem_uso_30_dias} status="normal" />
              <Typography.Text>
                {dados.usaram_30_dias} das contas ativas entraram ou investigaram pelo menos uma vez.
              </Typography.Text>
            </Flex>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Investigações" value={dados.investigacoes} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Sites pesquisados" value={dados.sites_distintos} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Indicadores diferentes" value={dados.indicadores_distintos} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Ameaças encontradas" value={dados.ameacas_distintas} />
          </Card>
        </Col>
      </Row>
      <Card title="Os 10 que mais pesquisam">
        {dados.top_usuarios.length === 0 ? (
          <Empty description="Ninguém investigou ainda." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={dados.top_usuarios}
            renderItem={(item) => (
              <List.Item>
                <Flex vertical className="item-barra">
                  <Flex justify="space-between">
                    <Typography.Text strong>{item.nome}</Typography.Text>
                    <Typography.Text type="secondary">{item.investigacoes} investigações</Typography.Text>
                  </Flex>
                  <Barra valor={item.investigacoes} maximo={maximo} />
                </Flex>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Flex>
  );
}
