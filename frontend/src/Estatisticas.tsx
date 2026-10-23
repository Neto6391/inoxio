import { Alert, Card, Col, Empty, Flex, List, Progress, Row, Skeleton, Statistic, Tag, Typography } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { NumeroCreditos } from "./Creditos";
import { NOMES_TIPO, TagVeredito } from "./formato";
import { type Dia, GraficoDias, PorTipo, Rosca } from "./Graficos";
import { IconeAlerta, IconeBusca, IconeEscudo, IconeRelogio, IconeUsuarios } from "./icones";
import { Link } from "./rotas";
import { SITUACOES } from "./AuditoriaPorUsuario";
import type { Creditos } from "./tipos";

type MaisPesquisado = { tipo: string; valor: string; vezes: number; veredito: string };
type Ameaca = { id: string; tipo: string; valor: string; veredito: string; nota: number | null; deteccoes: number };
type Minhas = {
  total: number;
  por_veredito: Record<string, number>;
  mais_pesquisados: MaisPesquisado[];
  ameacas: Ameaca[];
  por_tipo?: Record<string, number>;
  por_dia?: Dia[];
};
type Situacao = "ativa" | "desativada" | "aguardando" | "recusada";
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

function Numero({ titulo, icone, children }: { titulo: string; icone: ReactNode; children: ReactNode }) {
  return (
    <Card className="cartao-numero">
      <div className="numero-titulo">
        {titulo}
        {icone}
      </div>
      {children}
    </Card>
  );
}

function porcentagem(parte: number, todo: number): number {
  return todo ? Math.round((100 * parte) / todo) : 0;
}

export function MinhasEstatisticas({ creditos }: { creditos: Creditos | null }) {
  const { dados, erro } = useDados<Minhas>("/api/estatisticas");
  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (!dados) return <Skeleton active />;
  // Resposta fora do formato: o painel segue sem esta parte.
  if (!dados.por_veredito) return null;

  const total = dados.total ?? 0;
  const maliciosos = dados.por_veredito.malicioso ?? 0;
  const suspeitos = dados.por_veredito.suspeito ?? 0;
  const semEvidencia = dados.por_veredito.sem_evidencia ?? 0;
  const dias = dados.por_dia ?? [];
  const ultimaSemana = dias.slice(-7).reduce((soma, dia) => soma + Object.values(dia.vereditos).reduce((a, b) => a + b, 0), 0);
  const maximo = Math.max(1, ...dados.mais_pesquisados.map((item) => item.vezes));
  return (
    <Flex vertical gap="large">
      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <Numero titulo="Investigações" icone={<IconeBusca />}>
            <div className="numero-valor">{total}</div>
            <div className="numero-nota">{ultimaSemana} nos últimos 7 dias</div>
          </Numero>
        </Col>
        <Col xs={12} lg={6}>
          <Numero titulo="Ameaças encontradas" icone={<IconeAlerta />}>
            <div className="numero-valor">{maliciosos + suspeitos}</div>
            <div className="numero-nota">
              {maliciosos} {maliciosos === 1 ? "maliciosa" : "maliciosas"}, {suspeitos}{" "}
              {suspeitos === 1 ? "suspeita" : "suspeitas"}
            </div>
          </Numero>
        </Col>
        <Col xs={12} lg={6}>
          <Numero titulo="Sem evidência" icone={<IconeEscudo />}>
            <div className="numero-valor">{semEvidencia}</div>
            <div className="numero-nota">{porcentagem(semEvidencia, total)}% das investigações</div>
          </Numero>
        </Col>
        <Col xs={12} lg={6}>
          <Numero titulo="Créditos restantes" icone={<IconeRelogio />}>
            {creditos ? <NumeroCreditos creditos={creditos} /> : <div className="numero-valor">—</div>}
          </Numero>
        </Col>
      </Row>
      {total === 0 ? (
        <Card>
          <Empty
            description="Nenhuma investigação ainda. Os gráficos aparecem depois da primeira."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Investigações nos últimos 14 dias" className="cartao-estatistica">
                <GraficoDias dias={dias} />
              </Card>
            </Col>
            <Col xs={24} md={12} lg={6}>
              <Card title="Por veredito" className="cartao-estatistica">
                <Rosca porVeredito={dados.por_veredito} />
              </Card>
            </Col>
            <Col xs={24} md={12} lg={6}>
              <Card title="Por tipo de indicador" className="cartao-estatistica">
                <PorTipo porTipo={dados.por_tipo ?? {}} />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
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
          </Row>
        </>
      )}
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
        <Typography.Text type="secondary">
          A casa da administração: o uso do sistema por todos e o caminho para as outras telas.
        </Typography.Text>
      </div>
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
              <span className="atalho-nota">Sessões de cada usuário, com a linha do tempo, e todos os eventos.</span>
            </span>
          </Link>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
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
        </Col>
        <Col xs={24} md={12}>
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
    </Flex>
  );
}
