import { Alert, Card, Col, Descriptions, Flex, Progress, Result, Row, Skeleton, Tag, Typography } from "antd";
import { type CSSProperties, useEffect, useState } from "react";
import { AnaliseIA } from "./AnaliseIA";
import { Carregando } from "./Carregando";
import { chamar, mensagemDeErro } from "./api";
import { CORES_VEREDITO, comoTexto, corDaNota, NOMES_TIPO, quando } from "./formato";
import { provedoresDe } from "./provedores";
import { Link } from "./rotas";
import type { DetalheInvestigacao, Evidencia, IpDoDominio } from "./tipos";

const NOMES_FONTE: Record<string, string> = {
  abuseipdb: "AbuseIPDB",
  virustotal: "VirusTotal",
  virustotal_url: "VirusTotal (URL)",
};

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
// Números que só dão contexto a outro campo; não viram linha própria.
const CAMPOS_DE_CONTEXTO = new Set(["votos_positivos", "votos_negativos", "motores", "nao_acusaram"]);

function quantos(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

// A reputação do VirusTotal é a soma dos votos da comunidade: sem votos, o 0 não diz nada.
function reputacaoComContexto(dados: Record<string, unknown>): string | null {
  const { reputacao, votos_positivos: positivos, votos_negativos: negativos } = dados;
  if (typeof reputacao !== "number" || typeof positivos !== "number" || typeof negativos !== "number") {
    return null;
  }
  if (positivos + negativos === 0) return `${reputacao} (ninguém votou neste endereço)`;
  return `${reputacao} (${quantos(positivos, "voto positivo", "votos positivos")}, ${quantos(negativos, "negativo", "negativos")})`;
}

function itensDaFonte(dados: Record<string, unknown>) {
  const itens = [];
  for (const [chave, valor] of Object.entries(dados)) {
    if (CAMPOS_DE_CONTEXTO.has(chave)) continue;
    const texto = chave === "reputacao" ? (reputacaoComContexto(dados) ?? comoTexto(valor)) : comoTexto(valor);
    itens.push({ key: chave, label: ROTULOS_CAMPO[chave] ?? chave, children: texto });
    if (chave === "suspeito" && typeof dados.motores === "number" && dados.motores > 0) {
      itens.push({
        key: "motores",
        label: "Motores que analisaram",
        children: `${dados.motores} (${comoTexto(dados.nao_acusaram ?? 0)} não acusaram nada)`,
      });
    }
  }
  return itens;
}

function Fonte({ evidencia }: { evidencia: Evidencia }) {
  const status = STATUS[evidencia.status] ?? { texto: evidencia.status, cor: "default" };
  const itens = itensDaFonte(evidencia.dados);
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
    <Card size="small" title="IPs do site (DNS)" extra={<Tag color={status.cor}>{status.texto}</Tag>}>
      {ips.length === 0 ? (
        <Typography.Text type="secondary">
          {evidencia.status === "falha"
            ? "O DNS não respondeu a tempo."
            : "O domínio não aponta para nenhum IP público."}
        </Typography.Text>
      ) : (
        <div className="tabela-rolagem">
          <div className="tabela-ips">
            <div className="linha-ip cabecalho">
              <span>IP</span>
              <span>Nota no AbuseIPDB</span>
              <span>Relatos</span>
              <span>Quem opera</span>
            </div>
            {ips.map((item) => (
              <div key={item.ip} className="linha-ip">
                <span className="indicador">{item.ip}</span>
                {item.abuseipdb === "ok" ? (
                  <>
                    <span>
                      <Tag color={corDaNota(item.score ?? 0)}>{item.score} de 100</Tag>
                    </span>
                    <span>{comoTexto(item.relatos)}</span>
                    <span>
                      {comoTexto(item.isp)} · {comoTexto(item.pais)}
                    </span>
                  </>
                ) : (
                  <Typography.Text type="secondary">AbuseIPDB indisponível</Typography.Text>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// O servidor desiste da explicação em 90 s mais 30 de folga; a tela pergunta por 2 min.
const INTERVALO_MS = 3000;
const CONSULTAS = 40;

type PropsInvestigacao = { id: string; intervalo?: number; consultas?: number };

// O ISP vem do AbuseIPDB: dos IPs do site (contexto) e, numa investigação de IP, da própria fonte.
function ispsDe(evidencias: Evidencia[]): string[] {
  return evidencias.flatMap((evidencia) => {
    const dados = evidencia.dados ?? {};
    const ips = (dados.ips as IpDoDominio[] | undefined) ?? [];
    return [...ips.map((ip) => ip.isp ?? ""), typeof dados.isp === "string" ? dados.isp : ""];
  });
}

function QuemOpera({ evidencias }: { evidencias: Evidencia[] }) {
  const provedores = provedoresDe(ispsDe(evidencias));
  if (provedores.length === 0) return null;
  return (
    <Card title="Quem opera estes IPs" size="small">
      <Flex vertical gap="middle">
        {provedores.map((provedor) => (
          <div key={provedor.nome}>
            <Typography.Text strong>{provedor.nome}</Typography.Text>
            <Typography.Paragraph type="secondary" className="sem-margem">
              {provedor.texto}
            </Typography.Paragraph>
          </div>
        ))}
      </Flex>
    </Card>
  );
}

export function Investigacao({ id, intervalo = INTERVALO_MS, consultas = CONSULTAS }: PropsInvestigacao) {
  const [detalhe, setDetalhe] = useState<DetalheInvestigacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feitas, setFeitas] = useState(0);
  const [tentando, setTentando] = useState(false);
  const [erroTentativa, setErroTentativa] = useState<string | null>(null);

  // Não gasta crédito: as fontes já foram consultadas, só a IA escreve de novo.
  async function tentarDeNovo() {
    setTentando(true);
    setErroTentativa(null);
    try {
      await chamar(`/api/investigacoes/${id}/explicar`, { metodo: "POST" });
      setDetalhe((atual) => atual && { ...atual, analise: null, analise_estado: "pendente" });
      setFeitas(0);
    } catch (falha) {
      setErroTentativa(mensagemDeErro(falha));
    } finally {
      setTentando(false);
    }
  }

  useEffect(() => {
    chamar<DetalheInvestigacao>(`/api/investigacoes/${id}`)
      .then(setDetalhe)
      .catch((falha) => setErro(mensagemDeErro(falha)));
  }, [id]);

  // Enquanto a IA escreve, pergunta de novo de tempos em tempos.
  const esperando = detalhe?.analise_estado === "pendente" && feitas < consultas;
  useEffect(() => {
    if (!esperando) return;
    const espera = window.setTimeout(() => {
      chamar<DetalheInvestigacao>(`/api/investigacoes/${id}`)
        .then(setDetalhe)
        .catch(() => undefined)
        .finally(() => setFeitas((n) => n + 1));
    }, intervalo);
    return () => window.clearTimeout(espera);
  }, [esperando, feitas, id, intervalo]);

  if (erro) {
    return <Result status="warning" title={erro} extra={<Link para="/painel">Voltar ao painel</Link>} />;
  }
  if (!detalhe) return <Skeleton active paragraph={{ rows: 6 }} />;

  const nota = detalhe.veredito in SEM_NOTA ? null : detalhe.nota;
  const fontes = detalhe.evidencias.filter((evidencia) => !evidencia.contexto);
  const contexto = detalhe.evidencias.filter((evidencia) => evidencia.contexto);
  return (
    <Flex vertical gap="large">
      <Link para="/investigacoes">← Investigações</Link>
      <Flex vertical gap={4}>
        <Typography.Title level={2} className="titulo-indicador indicador">
          {detalhe.valor}
        </Typography.Title>
        <Flex gap="small" align="center" wrap>
          <Tag>{NOMES_TIPO[detalhe.tipo] ?? detalhe.tipo}</Tag>
          <Typography.Text type="secondary">
            Investigada em {quando(detalhe.criada_em)} · horário de Brasília
          </Typography.Text>
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

      {esperando ? (
        <Carregando
          titulo="Escrevendo a explicação em linguagem simples"
          descricao="A IA está lendo as evidências. O veredito acima já está pronto; a explicação aparece aqui em instantes."
        />
      ) : (
        <Flex vertical gap="small">
          {erroTentativa && <Alert type="error" showIcon title={erroTentativa} />}
          <AnaliseIA
            analise={detalhe.analise}
            // Indisponível, ou a página desistiu de esperar: dá para pedir de novo.
            aoTentarDeNovo={detalhe.analise_estado !== "pronta" ? tentarDeNovo : undefined}
            tentando={tentando}
          />
        </Flex>
      )}

      <QuemOpera evidencias={detalhe.evidencias} />

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

    </Flex>
  );
}
