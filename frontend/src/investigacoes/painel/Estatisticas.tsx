import { Alert, Card, Col, Empty, Flex, List, Row, Skeleton, Typography } from "antd";
import type { ReactNode } from "react";
import { Link } from "../../app/rotas";
import { Barra } from "../../compartilhado/Barra";
import { NOMES_TIPO, TagVeredito } from "../../compartilhado/formato";
import { IconeAlerta, IconeBusca, IconeEscudo, IconeRelogio } from "../../compartilhado/icones";
import type { Creditos } from "../../compartilhado/tipos";
import { useDados } from "../../compartilhado/useDados";
import { NumeroCreditos } from "../Creditos";
import { type Dia, GraficoDias, PorTipo, Rosca } from "./Graficos";

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

function Numeros({ dados, creditos }: { dados: Minhas; creditos: Creditos | null }) {
  const total = dados.total ?? 0;
  const maliciosos = dados.por_veredito.malicioso ?? 0;
  const suspeitos = dados.por_veredito.suspeito ?? 0;
  const semEvidencia = dados.por_veredito.sem_evidencia ?? 0;
  const ultimaSemana = (dados.por_dia ?? [])
    .slice(-7)
    .reduce((soma, dia) => soma + Object.values(dia.vereditos).reduce((a, b) => a + b, 0), 0);
  return (
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
  );
}

function Graficos({ dados }: { dados: Minhas }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card title="Investigações nos últimos 14 dias" className="cartao-estatistica">
          <GraficoDias dias={dados.por_dia ?? []} />
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
  );
}

function AmeacasEncontradas({ ameacas }: { ameacas: Ameaca[] }) {
  return (
    <Card title="Ameaças que você encontrou" className="cartao-estatistica">
      {ameacas.length === 0 ? (
        <Empty description="Nenhuma ameaça até agora." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List<Ameaca>
          dataSource={ameacas}
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
  );
}

function MaisPesquisados({ itens }: { itens: MaisPesquisado[] }) {
  const maximo = Math.max(1, ...itens.map((item) => item.vezes));
  return (
    <Card title="Seus 10 mais pesquisados" className="cartao-estatistica">
      <List<MaisPesquisado>
        dataSource={itens}
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
  );
}

export function MinhasEstatisticas({ creditos }: { creditos: Creditos | null }) {
  const { dados, erro } = useDados<Minhas>("/api/estatisticas");
  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (!dados) return <Skeleton active />;
  // Resposta fora do formato: o painel segue sem esta parte.
  if (!dados.por_veredito) return null;

  return (
    <Flex vertical gap="large">
      <Numeros dados={dados} creditos={creditos} />
      {(dados.total ?? 0) === 0 ? (
        <Card>
          <Empty
            description="Nenhuma investigação ainda. Os gráficos aparecem depois da primeira."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <>
          <Graficos dados={dados} />
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <AmeacasEncontradas ameacas={dados.ameacas} />
            </Col>
            <Col xs={24} lg={12}>
              <MaisPesquisados itens={dados.mais_pesquisados} />
            </Col>
          </Row>
        </>
      )}
    </Flex>
  );
}
