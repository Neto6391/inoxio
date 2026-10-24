import { Alert, Card, Empty, Flex, Input, List, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { Carregando } from "../compartilhado/Carregando";
import { NOMES_TIPO, quando, TagVeredito } from "../compartilhado/formato";
import { Paginacao, usePagina } from "../compartilhado/Paginacao";
import { navegar } from "../app/rotas";
import type { ResumoInvestigacao } from "../compartilhado/tipos";

type PropsLista = { limite?: number; busca?: string; paginar?: boolean };

export function ListaInvestigacoes({ limite, busca = "", paginar = false }: PropsLista) {
  const [numero, setNumero] = useState(1);

  // Busca nova volta para a página 1.
  useEffect(() => setNumero(1), [busca]);

  const parametros = new URLSearchParams({ pagina: String(numero) });
  if (busca.trim()) parametros.set("busca", busca.trim());
  const { pagina, erro, carregando } = usePagina<ResumoInvestigacao>(`/api/investigacoes?${parametros}`);

  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (pagina === null) return <Skeleton active paragraph={{ rows: 3 }} />;
  const rodape = paginar && <Paginacao pagina={pagina} aoMudar={setNumero} rotulo={["investigação", "investigações"]} />;
  if (carregando) {
    return (
      <>
        <Carregando solto titulo={`Carregando a página ${numero}`} linhas={5} />
        {rodape}
      </>
    );
  }
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
      {rodape}
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
          {/* Sem o tamanho da página aqui: quem decide é o servidor, e a paginação mostra o total. */}
          Todas as suas investigações, da mais nova para a mais antiga. Horários de Brasília.
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
