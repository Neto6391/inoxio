import { Alert, Button, Card, Empty, Flex, Input, Skeleton, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, ErroApi, mensagemDeErro } from "../../compartilhado/api";
import { Carregando } from "../../compartilhado/Carregando";
import { quando } from "../../compartilhado/formato";
import { ehPagina, FORA_DO_FORMATO, Paginacao } from "../../compartilhado/Paginacao";
import type { Pagina } from "../../compartilhado/tipos";
import { etiquetaDoEvento, type EventoDaSessao, type SessaoAuditada } from "./eventos";
import { fimDaSessao, LinhaDoTempo } from "./LinhaDoTempo";

// As sessões e os eventos de fora de sessão vêm em páginas próprias, de 5 em 5.
type Sessoes = { sessoes: Pagina<SessaoAuditada>; fora_de_sessao: Pagina<EventoDaSessao> };
// Qual parte da janela espera a página pedida: a lista de sessões, a de fora, ou as duas.
type Espera = "sessoes" | "fora" | "tudo" | null;
type Periodo = { de: string; ate: string };

function enderecoDasSessoes(nome: string, periodo: Periodo, numero: number, numeroFora: number): string {
  const parametros = new URLSearchParams();
  if (periodo.de) parametros.set("de", periodo.de);
  if (periodo.ate) parametros.set("ate", periodo.ate);
  if (numero > 1) parametros.set("pagina", String(numero));
  if (numeroFora > 1) parametros.set("pagina_fora", String(numeroFora));
  const busca = parametros.size ? `?${parametros}` : "";
  return `/api/auditoria/usuarios/${encodeURIComponent(nome)}/sessoes${busca}`;
}

function useSessoes(nome: string) {
  const [dados, setDados] = useState<Sessoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>({ de: "", ate: "" });
  const [numero, setNumero] = useState(1);
  const [numeroFora, setNumeroFora] = useState(1);
  const [espera, setEspera] = useState<Espera>("tudo");

  useEffect(() => {
    let vigente = true;
    chamar<Sessoes>(enderecoDasSessoes(nome, periodo, numero, numeroFora))
      .then((novos) => {
        if (!vigente) return;
        if (!ehPagina(novos?.sessoes) || !ehPagina(novos?.fora_de_sessao)) {
          throw new ErroApi(200, FORA_DO_FORMATO);
        }
        setDados(novos);
        setErro(null);
      })
      .catch((falha) => {
        if (vigente) setErro(mensagemDeErro(falha));
      })
      .finally(() => {
        if (vigente) setEspera(null);
      });
    return () => {
      vigente = false;
    };
  }, [nome, periodo, numero, numeroFora]);

  return {
    dados,
    erro,
    periodo,
    numero,
    numeroFora,
    esperaSessoes: espera === "sessoes" || espera === "tudo",
    esperaFora: espera === "fora" || espera === "tudo",
    filtrar(novo: Periodo) {
      setEspera("tudo");
      setPeriodo(novo);
      setNumero(1);
      setNumeroFora(1);
    },
    irParaSessoes(novo: number) {
      setEspera("sessoes");
      setNumero(novo);
    },
    irParaFora(novo: number) {
      setEspera("fora");
      setNumeroFora(novo);
    },
  };
}

function FiltroDePeriodo({ aoFiltrar }: { aoFiltrar: (periodo: Periodo) => void }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const invertido = de && ate && de > ate;
  return (
    <>
      <Flex gap="small" align="end" wrap>
        <label className="campo-data">
          <span>De</span>
          <Input type="date" value={de} onChange={(evento) => setDe(evento.target.value)} />
        </label>
        <label className="campo-data">
          <span>Até</span>
          <Input type="date" value={ate} onChange={(evento) => setAte(evento.target.value)} />
        </label>
        <Button type="primary" disabled={Boolean(invertido)} onClick={() => aoFiltrar({ de, ate })}>
          Filtrar
        </Button>
        <Button
          onClick={() => {
            setDe("");
            setAte("");
            aoFiltrar({ de: "", ate: "" });
          }}
        >
          Limpar
        </Button>
      </Flex>
      {invertido && <Alert type="warning" showIcon title="A data inicial vem depois da final." />}
    </>
  );
}

function Sessao({ sessao, aberta, aoAlternar }: { sessao: SessaoAuditada; aberta: boolean; aoAlternar: () => void }) {
  return (
    <div className={aberta ? "sessao sessao-escolhida" : "sessao"}>
      <button type="button" className="sessao-cabecalho" aria-expanded={aberta} onClick={aoAlternar}>
        <Flex gap="small" align="center" wrap>
          <Typography.Text strong>{quando(sessao.inicio)}</Typography.Text>
          <Typography.Text type="secondary">{fimDaSessao(sessao)}</Typography.Text>
          <span className="indicador evento-ip">{sessao.ip}</span>
          <Tag>{sessao.acoes === 1 ? "1 ação" : `${sessao.acoes} ações`}</Tag>
          {sessao.aberta && <Tag color="green">aberta</Tag>}
          {sessao.aproximada && <Tag color="default">aproximada</Tag>}
        </Flex>
      </button>
      {aberta && (
        <div className="sessao-corpo">
          {sessao.aproximada && (
            <Alert
              type="info"
              showIcon
              className="espaco"
              title="Sessão de antes do registro por sessão: reconstruída de um login até o seguinte."
            />
          )}
          <LinhaDoTempo sessao={sessao} />
        </div>
      )}
    </div>
  );
}

type PropsDaLista<T> = { pagina: Pagina<T>; esperando: boolean; numero: number; aoMudar: (numero: number) => void };

function ListaDeSessoes({ pagina, esperando, numero, aoMudar }: PropsDaLista<SessaoAuditada>) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  return (
    <>
      {esperando ? (
        <Carregando solto titulo={`Carregando a página ${numero} das sessões`} linhas={5} />
      ) : pagina.itens.length === 0 ? (
        <Empty description="Nenhuma sessão no período." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Flex vertical gap={8}>
          {pagina.itens.map((sessao) => (
            <Sessao
              key={sessao.id}
              sessao={sessao}
              aberta={escolhida === sessao.id}
              aoAlternar={() => setEscolhida(escolhida === sessao.id ? null : sessao.id)}
            />
          ))}
        </Flex>
      )}
      <Paginacao pagina={pagina} aoMudar={aoMudar} rotulo={["sessão", "sessões"]} />
    </>
  );
}

function ForaDeSessao({ pagina, esperando, numero, aoMudar }: PropsDaLista<EventoDaSessao>) {
  return (
    <Card size="small" title="Fora de sessão (senha errada, cadastro, link de senha)">
      {esperando ? (
        <Carregando solto titulo={`Carregando a página ${numero}`} linhas={3} />
      ) : (
        <Flex vertical gap={8}>
          {pagina.itens.map((evento, indice) => (
            <Flex key={`${evento.quando}-${indice}`} gap="small" align="center" wrap>
              <Typography.Text type="secondary">{quando(evento.quando)}</Typography.Text>
              <Tag color={etiquetaDoEvento(evento).cor}>{etiquetaDoEvento(evento).texto}</Tag>
              <span className="indicador evento-ip">{evento.ip}</span>
              {evento.detalhe && <span className="indicador evento-detalhe">{evento.detalhe}</span>}
            </Flex>
          ))}
        </Flex>
      )}
      <Paginacao
        pagina={pagina}
        aoMudar={aoMudar}
        rotulo={["evento fora de sessão", "eventos fora de sessão"]}
      />
    </Card>
  );
}

export function SessoesDoUsuario({ nome }: { nome: string }) {
  const sessoes = useSessoes(nome);
  const { dados, periodo } = sessoes;
  return (
    <Flex vertical gap="middle">
      <FiltroDePeriodo aoFiltrar={sessoes.filtrar} />
      {sessoes.erro ? (
        <Alert type="error" showIcon title={sessoes.erro} />
      ) : dados === null ? (
        <Skeleton active />
      ) : (
        <>
          <Typography.Text type="secondary">
            {dados.sessoes.total} {dados.sessoes.total === 1 ? "sessão" : "sessões"}
            {periodo.de || periodo.ate ? " no período" : " nos últimos 90 dias"}. Clique numa sessão para ver
            a linha do tempo.
          </Typography.Text>
          <ListaDeSessoes
            pagina={dados.sessoes}
            esperando={sessoes.esperaSessoes}
            numero={sessoes.numero}
            aoMudar={sessoes.irParaSessoes}
          />
          {dados.fora_de_sessao.total > 0 && (
            <ForaDeSessao
              pagina={dados.fora_de_sessao}
              esperando={sessoes.esperaFora}
              numero={sessoes.numeroFora}
              aoMudar={sessoes.irParaFora}
            />
          )}
        </>
      )}
    </Flex>
  );
}
