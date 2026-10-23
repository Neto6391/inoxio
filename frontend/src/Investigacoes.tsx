import { Alert, Card, Empty, Flex, Input, List, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, ErroApi, mensagemDeErro } from "./api";
import { NOMES_TIPO, quando, TagVeredito } from "./formato";
import { ehPagina, FORA_DO_FORMATO, Paginacao } from "./Paginacao";
import { navegar } from "./rotas";
import type { Pagina, ResumoInvestigacao } from "./tipos";

type PropsLista = { limite?: number; busca?: string; paginar?: boolean };

export function ListaInvestigacoes({ limite, busca = "", paginar = false }: PropsLista) {
  const [pagina, setPagina] = useState<Pagina<ResumoInvestigacao> | null>(null);
  const [numero, setNumero] = useState(1);
  const [erro, setErro] = useState<string | null>(null);

  // Busca nova volta para a página 1.
  useEffect(() => setNumero(1), [busca]);

  useEffect(() => {
    let vigente = true;
    const parametros = new URLSearchParams({ pagina: String(numero) });
    if (busca.trim()) parametros.set("busca", busca.trim());
    chamar<Pagina<ResumoInvestigacao>>(`/api/investigacoes?${parametros}`)
      .then((nova) => {
        if (!vigente) return;
        if (!ehPagina<ResumoInvestigacao>(nova)) throw new ErroApi(200, FORA_DO_FORMATO);
        setPagina(nova);
        setErro(null);
      })
      .catch((falha) => {
        if (vigente) setErro(mensagemDeErro(falha));
      });
    return () => {
      vigente = false;
    };
  }, [numero, busca]);

  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (pagina === null) return <Skeleton active paragraph={{ rows: 3 }} />;
  if (pagina.itens.length === 0) {
    const texto = busca.trim() ? "Nenhuma investigação com essa busca." : "Nenhuma investigação ainda.";
    return <Empty description={texto} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  const itens = limite ? pagina.itens.slice(0, limite) : pagina.itens;
  return (
    <>
    <List<ResumoInvestigacao>
      dataSource={itens}
      renderItem={(item) => (
        <List.Item
          className="item-recente"
          onClick={() => navegar(`/investigacoes/${item.id}`)}
          extra={<TagVeredito veredito={item.veredito} />}
        >
          <List.Item.Meta
            title={<span className="indicador">{item.valor}</span>}
            description={`${NOMES_TIPO[item.tipo] ?? item.tipo} · ${quando(item.criada_em)}`}
          />
        </List.Item>
      )}
    />
    {paginar && <Paginacao pagina={pagina} aoMudar={setNumero} rotulo="investigações" />}
    </>
  );
}

export function Investigacoes() {
  const [busca, setBusca] = useState("");
  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Investigações</Typography.Title>
        <Typography.Text type="secondary">
          Todas as suas investigações, da mais nova para a mais antiga, 20 por página. Horários de
          Brasília.
        </Typography.Text>
      </div>
      <Card>
        <Input.Search
          allowClear
          placeholder="Buscar pelo indicador (domínio, IP, endereço ou hash)"
          aria-label="Buscar investigação"
          onSearch={setBusca}
          onChange={(evento) => {
            if (!evento.target.value) setBusca("");
          }}
          className="filtro-busca espaco"
        />
        <ListaInvestigacoes busca={busca} paginar />
      </Card>
    </Flex>
  );
}
