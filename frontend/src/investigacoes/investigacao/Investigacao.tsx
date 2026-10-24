import { Alert, Card, Col, Flex, Result, Row, Skeleton, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { INICIO } from "../../app/navegacao";
import { Link } from "../../app/rotas";
import { chamar, mensagemDeErro } from "../../compartilhado/api";
import { Carregando } from "../../compartilhado/Carregando";
import { NOMES_TIPO, quando } from "../../compartilhado/formato";
import type { DetalheInvestigacao, Evidencia } from "../../compartilhado/tipos";
import { AnaliseIA } from "./AnaliseIA";
import { Fonte } from "./Fonte";
import { IpsDoDominio } from "./IpsDoDominio";
import { QuemOpera } from "./QuemOpera";
import { Veredito } from "./Veredito";

// O servidor desiste da explicação em 90 s mais 30 de folga; a tela pergunta por 2 min.
const INTERVALO_MS = 3000;
const CONSULTAS = 40;

type PropsInvestigacao = { id: string; intervalo?: number; consultas?: number };

// O resultado da investigação e, enquanto a IA escreve, novas perguntas de tempos em tempos.
function useInvestigacao({ id, intervalo = INTERVALO_MS, consultas = CONSULTAS }: PropsInvestigacao) {
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

  return { detalhe, erro, esperando, tentando, erroTentativa, tentarDeNovo };
}

function Cabecalho({ detalhe }: { detalhe: DetalheInvestigacao }) {
  return (
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
  );
}

function EvidenciasPorFonte({ fontes }: { fontes: Evidencia[] }) {
  return (
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
  );
}

function Contexto({ contexto }: { contexto: Evidencia[] }) {
  return (
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
  );
}

export function Investigacao(props: PropsInvestigacao) {
  const { detalhe, erro, esperando, tentando, erroTentativa, tentarDeNovo } = useInvestigacao(props);

  if (erro) {
    return <Result status="warning" title={erro} extra={<Link para={INICIO}>Voltar ao início</Link>} />;
  }
  if (!detalhe) return <Skeleton active paragraph={{ rows: 6 }} />;

  const contexto = detalhe.evidencias.filter((evidencia) => evidencia.contexto);
  return (
    <Flex vertical gap="large">
      <Cabecalho detalhe={detalhe} />
      <Veredito detalhe={detalhe} />
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
            // Indisponível, ou a página desistiu de esperar: a dona pode pedir de novo.
            aoTentarDeNovo={detalhe.analise_estado !== "pronta" && detalhe.minha ? tentarDeNovo : undefined}
            tentando={tentando}
          />
        </Flex>
      )}
      <QuemOpera evidencias={detalhe.evidencias} />
      <EvidenciasPorFonte fontes={detalhe.evidencias.filter((evidencia) => !evidencia.contexto)} />
      {contexto.length > 0 && <Contexto contexto={contexto} />}
    </Flex>
  );
}
