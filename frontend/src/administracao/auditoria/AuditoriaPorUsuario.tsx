import { Alert, Button, Card, Empty, Flex, Skeleton, Tag, Typography } from "antd";
import { useState } from "react";
import { Carregando } from "../../compartilhado/Carregando";
import { quando } from "../../compartilhado/formato";
import { Janela } from "../../compartilhado/Janela";
import { Paginacao, usePagina } from "../../compartilhado/Paginacao";
import { type Filtros, FiltrosUsuarios, parametros, SEM_FILTRO } from "../FiltrosUsuarios";
import { type Situacao, SITUACOES } from "../situacoes";
import { SessoesDoUsuario } from "./SessoesDoUsuario";

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

function TabelaDeUsuarios({ linhas, aoVisualizar }: { linhas: Linha[]; aoVisualizar: (nome: string) => void }) {
  return (
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
                <Button size="small" onClick={() => aoVisualizar(linha.nome)}>
                  Visualizar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
        <TabelaDeUsuarios linhas={linhas} aoVisualizar={setAberto} />
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
