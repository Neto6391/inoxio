import { Alert, Button, Card, Empty, Flex, Input, Skeleton, Tag, Timeline, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, ErroApi, mensagemDeErro } from "./api";
import { nomeDoEvento } from "./Auditoria";
import { type Filtros, FiltrosUsuarios, parametros, SEM_FILTRO } from "./FiltrosUsuarios";
import { quando } from "./formato";
import { Janela } from "./Janela";
import { Carregando } from "./Carregando";
import { ehPagina, FORA_DO_FORMATO, Paginacao, usePagina } from "./Paginacao";
import type { Pagina } from "./tipos";

type Situacao = "ativa" | "desativada" | "aguardando" | "recusada";
type Linha = {
  nome: string;
  papel: string;
  situacao: Situacao;
  ultimo_acesso: string | null;
  sessoes: number;
  abertas: number;
  falhas_de_login: number;
  investigacoes: number;
};
type EventoDaSessao = { quando: string; tipo: string; ip: string; detalhe: string };
type SessaoAuditada = {
  id: string;
  aproximada: boolean;
  inicio_registrado: boolean;
  inicio: string;
  fim: string | null;
  motivo_fim: string | null;
  aberta: boolean;
  expira_em?: string;
  ip: string;
  acoes: number;
  eventos: EventoDaSessao[];
};
// As sessões e os eventos de fora de sessão vêm em páginas próprias, de 5 em 5.
type Sessoes = { sessoes: Pagina<SessaoAuditada>; fora_de_sessao: Pagina<EventoDaSessao> };
// Qual parte da janela espera a página pedida: a lista de sessões, a de fora, ou as duas.
type Espera = "sessoes" | "fora" | "tudo" | null;

export const SITUACOES: Record<Situacao, { texto: string; cor: string }> = {
  ativa: { texto: "ativa", cor: "green" },
  desativada: { texto: "desativada", cor: "red" },
  aguardando: { texto: "aguardando e-mail", cor: "orange" },
  recusada: { texto: "recusada", cor: "red" },
};

export function AuditoriaPorUsuario() {
  const [numero, setNumero] = useState(1);
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTRO);
  const [aberto, setAberto] = useState<string | null>(null);
  const { pagina, erro, carregando } = usePagina<Linha>(`/api/auditoria/usuarios?${parametros(filtros, numero)}`);

  const linhas = pagina?.itens ?? null;
  return (
    <Card title="Usuários">
      <FiltrosUsuarios
        filtros={filtros}
        aoMudar={(novos) => {
          setFiltros(novos);
          setNumero(1);
        }}
      />
      {erro ? (
        <Alert type="error" showIcon title={erro} className="espaco-topo" />
      ) : linhas === null ? (
        <Skeleton active />
      ) : carregando ? (
        <Carregando solto titulo={`Carregando a página ${numero}`} linhas={5} />
      ) : linhas.length === 0 ? (
        <Empty description="Nenhum usuário com esses filtros." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        // Tabela própria em vez da <Table> do antd: ela injeta um <style> sem nonce.
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Situação</th>
                <th>Último acesso</th>
                <th className="numero">Sessões</th>
                <th className="numero">Abertas agora</th>
                <th className="numero">Senha errada</th>
                <th className="numero">Investigações</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.nome}>
                  <td>
                    <Flex gap="small" align="center" wrap>
                      <Typography.Text strong>{linha.nome}</Typography.Text>
                      <Tag color={linha.papel === "admin" ? "gold" : "default"}>{linha.papel}</Tag>
                    </Flex>
                  </td>
                  <td>
                    <Tag color={SITUACOES[linha.situacao].cor}>{SITUACOES[linha.situacao].texto}</Tag>
                  </td>
                  <td>{linha.ultimo_acesso ? quando(linha.ultimo_acesso) : "nunca, nos últimos 90 dias"}</td>
                  <td className="numero">{linha.sessoes}</td>
                  <td className="numero">{linha.abertas}</td>
                  <td className="numero">{linha.falhas_de_login}</td>
                  <td className="numero">{linha.investigacoes}</td>
                  <td className="numero">
                    <Button size="small" onClick={() => setAberto(linha.nome)}>
                      Visualizar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagina && <Paginacao pagina={pagina} aoMudar={setNumero} rotulo={["usuário", "usuários"]} />}
      {aberto && (
        <Janela titulo={`Sessões de ${aberto}`} aoFechar={() => setAberto(null)}>
          <SessoesDoUsuario nome={aberto} />
        </Janela>
      )}
    </Card>
  );
}

function hora(iso: string): string {
  return quando(iso).slice(11);
}

function fimDaSessao(sessao: SessaoAuditada): string {
  if (sessao.aberta) return sessao.expira_em ? `aberta, vence às ${hora(sessao.expira_em)}` : "aberta";
  if (sessao.fim === null) return "fim não registrado";
  return `${sessao.motivo_fim} às ${hora(sessao.fim)}`;
}

function ItemDaLinha({ evento }: { evento: EventoDaSessao }) {
  const nome = nomeDoEvento(evento.tipo);
  return (
    <Flex vertical gap={2}>
      <Flex gap="small" align="center" wrap>
        <Typography.Text type="secondary">{hora(evento.quando)}</Typography.Text>
        <Tag color={nome.cor}>{nome.texto}</Tag>
        <span className="indicador evento-ip">{evento.ip}</span>
      </Flex>
      {evento.detalhe && <span className="indicador evento-detalhe">{evento.detalhe}</span>}
    </Flex>
  );
}

function LinhaDoTempo({ sessao }: { sessao: SessaoAuditada }) {
  const itens = sessao.eventos.map((evento, indice) => ({
    key: `${evento.quando}-${indice}`,
    content: <ItemDaLinha evento={evento} />,
  }));
  if (!sessao.inicio_registrado) {
    itens.unshift({ key: "inicio", content: <Typography.Text type="secondary">Começo fora da trilha</Typography.Text> });
  }
  if (sessao.aberta) {
    itens.push({ key: "aberta", content: <Typography.Text>{fimDaSessao(sessao)}</Typography.Text> });
  } else if (sessao.fim === null) {
    itens.push({ key: "fim", content: <Typography.Text type="secondary">Fim não registrado</Typography.Text> });
  } else if (!sessao.eventos.some((evento) => ["logout", "sessao_encerrada"].includes(evento.tipo))) {
    // Venceu sem o navegador voltar: o fim é calculado, não veio de um evento.
    itens.push({ key: "fim", content: <Typography.Text>{fimDaSessao(sessao)}</Typography.Text> });
  }
  return <Timeline className="linha-do-tempo" items={itens} />;
}

function SessoesDoUsuario({ nome }: { nome: string }) {
  const [dados, setDados] = useState<Sessoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [periodo, setPeriodo] = useState({ de: "", ate: "" });
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [numero, setNumero] = useState(1);
  const [numeroFora, setNumeroFora] = useState(1);
  const [espera, setEspera] = useState<Espera>("tudo");

  function filtrar(novo: { de: string; ate: string }) {
    setEspera("tudo");
    setPeriodo(novo);
    setNumero(1);
    setNumeroFora(1);
  }

  function irParaSessoes(novo: number) {
    setEspera("sessoes");
    setNumero(novo);
  }

  function irParaFora(novo: number) {
    setEspera("fora");
    setNumeroFora(novo);
  }

  useEffect(() => {
    let vigente = true;
    const parametros = new URLSearchParams();
    if (periodo.de) parametros.set("de", periodo.de);
    if (periodo.ate) parametros.set("ate", periodo.ate);
    if (numero > 1) parametros.set("pagina", String(numero));
    if (numeroFora > 1) parametros.set("pagina_fora", String(numeroFora));
    const busca = parametros.size ? `?${parametros}` : "";
    chamar<Sessoes>(`/api/auditoria/usuarios/${encodeURIComponent(nome)}/sessoes${busca}`)
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

  const esperaSessoes = espera === "sessoes" || espera === "tudo";
  const esperaFora = espera === "fora" || espera === "tudo";

  const invertido = de && ate && de > ate;
  return (
    <Flex vertical gap="middle">
      <Flex gap="small" align="end" wrap>
        <label className="campo-data">
          <span>De</span>
          <Input type="date" value={de} onChange={(evento) => setDe(evento.target.value)} />
        </label>
        <label className="campo-data">
          <span>Até</span>
          <Input type="date" value={ate} onChange={(evento) => setAte(evento.target.value)} />
        </label>
        <Button type="primary" disabled={Boolean(invertido)} onClick={() => filtrar({ de, ate })}>
          Filtrar
        </Button>
        <Button
          onClick={() => {
            setDe("");
            setAte("");
            filtrar({ de: "", ate: "" });
          }}
        >
          Limpar
        </Button>
      </Flex>
      {invertido && <Alert type="warning" showIcon title="A data inicial vem depois da final." />}
      {erro ? (
        <Alert type="error" showIcon title={erro} />
      ) : dados === null ? (
        <Skeleton active />
      ) : (
        <>
          <Typography.Text type="secondary">
            {dados.sessoes.total} {dados.sessoes.total === 1 ? "sessão" : "sessões"}
            {periodo.de || periodo.ate ? " no período" : " nos últimos 90 dias"}. Clique numa sessão para ver
            a linha do tempo.
          </Typography.Text>
          {esperaSessoes ? (
            <Carregando solto titulo={`Carregando a página ${numero} das sessões`} linhas={5} />
          ) : dados.sessoes.itens.length === 0 ? (
            <Empty description="Nenhuma sessão no período." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Flex vertical gap={8}>
              {dados.sessoes.itens.map((sessao) => {
                const aberta = escolhida === sessao.id;
                return (
                  <div key={sessao.id} className={aberta ? "sessao sessao-escolhida" : "sessao"}>
                    <button
                      type="button"
                      className="sessao-cabecalho"
                      aria-expanded={aberta}
                      onClick={() => setEscolhida(aberta ? null : sessao.id)}
                    >
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
              })}
            </Flex>
          )}
          <Paginacao pagina={dados.sessoes} aoMudar={irParaSessoes} rotulo={["sessão", "sessões"]} />
          {dados.fora_de_sessao.total > 0 && (
            <Card size="small" title="Fora de sessão (senha errada, cadastro, link de senha)">
              {esperaFora ? (
                <Carregando solto titulo={`Carregando a página ${numeroFora}`} linhas={3} />
              ) : (
              <Flex vertical gap={8}>
                {dados.fora_de_sessao.itens.map((evento, indice) => (
                  <Flex key={`${evento.quando}-${indice}`} gap="small" align="center" wrap>
                    <Typography.Text type="secondary">{quando(evento.quando)}</Typography.Text>
                    <Tag color={nomeDoEvento(evento.tipo).cor}>{nomeDoEvento(evento.tipo).texto}</Tag>
                    <span className="indicador evento-ip">{evento.ip}</span>
                    {evento.detalhe && <span className="indicador evento-detalhe">{evento.detalhe}</span>}
                  </Flex>
                ))}
              </Flex>
              )}
              <Paginacao pagina={dados.fora_de_sessao} aoMudar={irParaFora} rotulo={["evento fora de sessão", "eventos fora de sessão"]} />
            </Card>
          )}
        </>
      )}
    </Flex>
  );
}
