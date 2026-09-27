import { Card, Col, Descriptions, Flex, Progress, Result, Row, Skeleton, Tag, Typography } from "antd";
import { type CSSProperties, useEffect, useState } from "react";
import { AnaliseIA } from "./AnaliseIA";
import { chamar, mensagemDeErro } from "./api";
import { CORES_VEREDITO, comoTexto, corDaNota, NOMES_TIPO, quando } from "./formato";
import { Link } from "./rotas";
import type { DetalheInvestigacao, Evidencia, IpDoDominio } from "./tipos";

const NOMES_FONTE: Record<string, string> = { abuseipdb: "AbuseIPDB", virustotal: "VirusTotal" };

const ROTULOS_CAMPO: Record<string, string> = {
  score: "Score de abuso",
  relatos: "Relatos",
  pais: "País",
  isp: "Provedor",
  malicioso: "Motores: malicioso",
  suspeito: "Motores: suspeito",
  reputacao: "Reputação na comunidade",
  tags: "Tags",
};

const STATUS: Record<string, { texto: string; cor: string }> = {
  ok: { texto: "respondeu", cor: "green" },
  falha: { texto: "falhou", cor: "red" },
  nao_encontrado: { texto: "não conhece o indicador", cor: "default" },
};

// A cor vem de CORES_VEREDITO por uma variável CSS: o React a aplica pelo DOM, o
// que a CSP permite, e a cor fica definida num lugar só.
function corDoVeredito(veredito: string): CSSProperties {
  return { "--cor-veredito": CORES_VEREDITO[veredito] ?? "#64748b" } as CSSProperties;
}

// Sem <Table>: ela injeta um <style> sem nonce para medir a barra de rolagem, e a
// CSP bloqueia. Descriptions e List não fazem essa medição.
function Fonte({ evidencia }: { evidencia: Evidencia }) {
  const status = STATUS[evidencia.status] ?? { texto: evidencia.status, cor: "default" };
  const itens = Object.entries(evidencia.dados).map(([chave, valor]) => ({
    key: chave,
    label: ROTULOS_CAMPO[chave] ?? chave,
    children: comoTexto(valor),
  }));
  return (
    <Card
      size="small"
      title={NOMES_FONTE[evidencia.fonte] ?? evidencia.fonte}
      extra={<Tag color={status.cor}>{status.texto}</Tag>}
    >
      {itens.length === 0 ? (
        <Typography.Text type="secondary">Sem dados desta fonte.</Typography.Text>
      ) : (
        <Descriptions size="small" column={1} items={itens} />
      )}
    </Card>
  );
}

// Sem todas as fontes, ou sem nenhuma que conheça o indicador, a nota das que
// responderam não mede o risco: mostrar 0 sugeriria que o indicador é inofensivo.
const SEM_NOTA: Record<string, string> = {
  inconclusivo: "Uma das fontes falhou. Sem ela, não há nota: investigue de novo mais tarde.",
  desconhecido: "Nenhuma fonte conhece o indicador, então não há nota.",
};

function IpsDoDominio({ evidencia }: { evidencia: Evidencia }) {
  const status = STATUS[evidencia.status] ?? { texto: evidencia.status, cor: "default" };
  const ips = (evidencia.dados.ips as IpDoDominio[] | undefined) ?? [];
  return (
    <Card size="small" title="IPs do domínio (DNS)" extra={<Tag color={status.cor}>{status.texto}</Tag>}>
      {ips.length === 0 ? (
        <Typography.Text type="secondary">
          {evidencia.status === "falha"
            ? "O DNS não respondeu a tempo."
            : "O domínio não aponta para nenhum IP público."}
        </Typography.Text>
      ) : (
        <Flex vertical gap="small">
          {ips.map((item) => (
            <Flex key={item.ip} gap="small" align="center" wrap>
              <span className="indicador">{item.ip}</span>
              {item.abuseipdb === "ok" ? (
                <>
                  <Tag color={corDaNota(item.score ?? 0)}>AbuseIPDB {item.score}</Tag>
                  <Typography.Text type="secondary">
                    {comoTexto(item.relatos)} relatos · {comoTexto(item.pais)} · {comoTexto(item.isp)}
                  </Typography.Text>
                </>
              ) : (
                <Typography.Text type="secondary">AbuseIPDB indisponível</Typography.Text>
              )}
            </Flex>
          ))}
        </Flex>
      )}
    </Card>
  );
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
  if (!detalhe) return <Skeleton active paragraph={{ rows: 6 }} />;

  const nota = detalhe.veredito in SEM_NOTA ? null : detalhe.nota;
  const fontes = detalhe.evidencias.filter((evidencia) => !evidencia.contexto);
  const contexto = detalhe.evidencias.filter((evidencia) => evidencia.contexto);
  return (
    <Flex vertical gap="large">
      <Link para="/">← Investigações</Link>
      <Flex vertical gap={4}>
        <Typography.Title level={2} className="titulo-indicador indicador">
          {detalhe.valor}
        </Typography.Title>
        <Flex gap="small" align="center" wrap>
          <Tag>{NOMES_TIPO[detalhe.tipo] ?? detalhe.tipo}</Tag>
          <Typography.Text type="secondary">{quando(detalhe.criada_em)}</Typography.Text>
          {detalhe.reaproveitada && <Tag color="blue">reaproveitado de consulta com menos de 24 h</Tag>}
        </Flex>
      </Flex>

      <Card className="veredito" style={corDoVeredito(detalhe.veredito)}>
        <Flex gap="large" align="center" wrap>
          <Progress
            type="dashboard"
            size={112}
            // Sem isso, 100% vira status "success" e a nota aparece verde.
            status="normal"
            percent={nota ?? 0}
            strokeColor={nota === null ? "#3b4a5a" : corDaNota(nota)}
            format={() => (nota === null ? "—" : nota)}
          />
          <Flex vertical gap={4}>
            <Typography.Text type="secondary">Veredito</Typography.Text>
            <span className="rotulo-veredito">{detalhe.rotulo}</span>
            <Typography.Text type="secondary">
              {SEM_NOTA[detalhe.veredito] ??
                "Nota de risco de 0 a 100, calculada por regra fixa. A partir de 25 é suspeito; a partir de 75, malicioso."}
            </Typography.Text>
          </Flex>
        </Flex>
      </Card>

      <div>
        <Flex justify="space-between" align="baseline" className="espaco">
          <Typography.Title level={4}>Evidências por fonte</Typography.Title>
          <Typography.Text type="secondary">texto de terceiros, mostrado como texto</Typography.Text>
        </Flex>
        {fontes.length === 0 ? (
          <Card>
            <Typography.Text type="secondary">Nenhuma fonte respondeu.</Typography.Text>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {fontes.map((evidencia) => (
              <Col key={evidencia.fonte} xs={24} md={12}>
                <Fonte evidencia={evidencia} />
              </Col>
            ))}
          </Row>
        )}
      </div>

      {contexto.length > 0 && (
        <div>
          <Flex justify="space-between" align="baseline" className="espaco">
            <Typography.Title level={4}>Contexto</Typography.Title>
            <Typography.Text type="secondary">não entra no veredito</Typography.Text>
          </Flex>
          <Flex vertical gap="middle">
            {contexto.map((evidencia) => (
              <IpsDoDominio key={evidencia.fonte} evidencia={evidencia} />
            ))}
          </Flex>
        </div>
      )}

      <AnaliseIA analise={detalhe.analise} />
    </Flex>
  );
}
