import { Alert, Card, Col, Empty, Flex, List, Row, Skeleton, Statistic, Tag, Typography } from "antd";
import { Link } from "../app/rotas";
import { Barra } from "../compartilhado/Barra";
import { IconeEscudo, IconeUsuarios } from "../compartilhado/icones";
import { useDados } from "../compartilhado/useDados";
import { type Situacao, SITUACOES } from "./situacoes";

// No plural: aqui cada número conta várias contas.
const PLURAL: Record<Situacao, string> = {
  ativa: "ativas",
  desativada: "desativadas",
  aguardando: "aguardando e-mail",
  recusada: "recusadas",
};
type Geral = {
  contas: number;
  situacoes: Record<Situacao, number>;
  usaram_30_dias: number;
  sem_uso_30_dias: string[];
  investigacoes: number;
  sites_distintos: number;
  indicadores_distintos: number;
  ameacas_distintas: number;
  top_usuarios: { nome: string; investigacoes: number }[];
};

function Atalhos() {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Link para="/usuarios" className="atalho">
          <IconeUsuarios />
          <span>
            <strong>Usuários</strong>
            <span className="atalho-nota">Cadastrar, editar, zerar o uso, encerrar sessões, desativar.</span>
          </span>
        </Link>
      </Col>
      <Col xs={24} md={12}>
        <Link para="/auditoria" className="atalho">
          <IconeEscudo />
          <span>
            <strong>Auditoria</strong>
            <span className="atalho-nota">Sessões de cada usuário, com a linha do tempo.</span>
          </span>
        </Link>
      </Col>
    </Row>
  );
}

function ContasPorSituacao({ dados }: { dados: Geral }) {
  return (
    <Card title={`Contas por situação (${dados.contas} no total)`}>
      <Row gutter={[12, 12]}>
        {(Object.keys(SITUACOES) as Situacao[]).map((situacao) => (
          <Col xs={12} key={situacao}>
            <div className="situacao-conta">
              <div className="numero-valor">{dados.situacoes[situacao] ?? 0}</div>
              <Tag color={SITUACOES[situacao].cor}>{PLURAL[situacao]}</Tag>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

function UsoEm30Dias({ dados }: { dados: Geral }) {
  return (
    <Card title="Uso nos últimos 30 dias">
      <Typography.Paragraph>
        <Typography.Text strong>{dados.usaram_30_dias}</Typography.Text> de{" "}
        {dados.situacoes.ativa ?? 0} contas ativas entraram ou investigaram pelo menos uma vez.
      </Typography.Paragraph>
      {dados.sem_uso_30_dias.length === 0 ? (
        <Typography.Text type="secondary">Todas as contas ativas usaram.</Typography.Text>
      ) : (
        <>
          <Typography.Text type="secondary">Ativas que não usaram:</Typography.Text>
          <Flex gap={6} wrap className="espaco-topo">
            {dados.sem_uso_30_dias.map((nome) => (
              <Tag key={nome}>{nome}</Tag>
            ))}
          </Flex>
        </>
      )}
    </Card>
  );
}

function Totais({ dados }: { dados: Geral }) {
  const totais = [
    ["Investigações", dados.investigacoes],
    ["Sites pesquisados", dados.sites_distintos],
    ["Indicadores diferentes", dados.indicadores_distintos],
    ["Ameaças encontradas", dados.ameacas_distintas],
  ] as const;
  return (
    <Row gutter={[16, 16]}>
      {totais.map(([titulo, valor]) => (
        <Col xs={12} md={6} key={titulo}>
          <Card>
            <Statistic title={titulo} value={valor} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function QuemMaisPesquisa({ usuarios }: { usuarios: Geral["top_usuarios"] }) {
  const maximo = Math.max(0, ...usuarios.map((item) => item.investigacoes));
  return (
    <Card title="Os 10 que mais pesquisam">
      {usuarios.length === 0 ? (
        <Empty description="Ninguém investigou ainda." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={usuarios}
          renderItem={(item) => (
            <List.Item>
              <Flex vertical className="item-barra">
                <Flex justify="space-between">
                  <Typography.Text strong>{item.nome}</Typography.Text>
                  <Typography.Text type="secondary">
                    {item.investigacoes} {item.investigacoes === 1 ? "investigação" : "investigações"}
                  </Typography.Text>
                </Flex>
                <Barra valor={item.investigacoes} maximo={maximo} />
              </Flex>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

export function VisaoGeral() {
  const { dados, erro } = useDados<Geral>("/api/estatisticas/geral");
  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (!dados) return <Skeleton active />;

  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Visão geral</Typography.Title>
        <Typography.Text type="secondary">
          A casa da administração: o uso do sistema por todos e o caminho para as outras telas.
        </Typography.Text>
      </div>
      <Atalhos />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <ContasPorSituacao dados={dados} />
        </Col>
        <Col xs={24} md={12}>
          <UsoEm30Dias dados={dados} />
        </Col>
      </Row>
      <Totais dados={dados} />
      <QuemMaisPesquisa usuarios={dados.top_usuarios} />
    </Flex>
  );
}
