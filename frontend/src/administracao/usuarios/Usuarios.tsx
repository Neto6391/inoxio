import { Alert, App, Button, Card, Empty, Flex, Skeleton, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../../compartilhado/api";
import { Carregando } from "../../compartilhado/Carregando";
import { Janela } from "../../compartilhado/Janela";
import { Paginacao, usePagina } from "../../compartilhado/Paginacao";
import type { UsuarioListado } from "../../compartilhado/tipos";
import { type Filtros, FiltrosUsuarios, parametros, SEM_FILTRO } from "../FiltrosUsuarios";
import { FormCadastro } from "./FormCadastro";
import { FormEdicao } from "./FormEdicao";
import { ListaDeUsuarios } from "./ListaDeUsuarios";

export function Usuarios({ eu }: { eu: string }) {
  const [numero, setNumero] = useState(1);
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTRO);
  // Sobe para ler a lista de novo depois de uma mudança.
  const [releitura, setReleitura] = useState(0);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [editando, setEditando] = useState<UsuarioListado | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const { message } = App.useApp();
  const {
    pagina,
    erro: erroLista,
    carregando,
  } = usePagina<UsuarioListado>(`/api/usuarios?${parametros(filtros, numero)}`, releitura);

  function carregar() {
    setReleitura((n) => n + 1);
  }

  async function mudarSituacao(usuario: UsuarioListado, ativo: boolean) {
    setErroAcao(null);
    try {
      const caminho = `/api/usuarios/${encodeURIComponent(usuario.nome)}`;
      await chamar(caminho, { metodo: "PATCH", corpo: { ativo } });
      const feito = ativo ? "ativado" : usuario.pendente ? "recusado" : "desativado";
      message.success(`Usuário ${usuario.nome} ${feito}.`);
      carregar();
    } catch (falha) {
      setErroAcao(mensagemDeErro(falha));
    }
  }

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="end" gap="middle" wrap>
        <div>
          <Typography.Title level={2}>Usuários</Typography.Title>
          <Typography.Text type="secondary">
            Só o admin vê esta tela. Cada usuário vê apenas as próprias investigações; o admin abre
            qualquer uma.
          </Typography.Text>
        </div>
        <Button type="primary" onClick={() => setCadastrando(true)}>
          Novo usuário
        </Button>
      </Flex>
      <Card>
        <FiltrosUsuarios
          filtros={filtros}
          aoMudar={(novos) => {
            setFiltros(novos);
            setNumero(1);
          }}
        />
        {erroAcao && <Alert type="error" showIcon title={erroAcao} className="espaco-topo" />}
        {erroLista ? (
          <Alert type="error" showIcon title={erroLista} className="espaco-topo" />
        ) : pagina === null ? (
          <Skeleton active />
        ) : pagina.itens.length === 0 && !carregando ? (
          <Empty description="Nenhum usuário com esses filtros." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            {carregando ? (
              <Carregando solto titulo={`Carregando a página ${numero}`} linhas={5} />
            ) : (
              <ListaDeUsuarios
                usuarios={pagina.itens}
                eu={eu}
                aoEditar={setEditando}
                aoMudarSituacao={mudarSituacao}
              />
            )}
            <Paginacao pagina={pagina} aoMudar={setNumero} rotulo={["usuário", "usuários"]} />
          </>
        )}
      </Card>
      {cadastrando && (
        <Janela titulo="Novo usuário" larga={false} aoFechar={() => setCadastrando(false)}>
          <FormCadastro
            aoCadastrar={() => {
              setCadastrando(false);
              carregar();
            }}
          />
        </Janela>
      )}
      {editando && (
        <Janela titulo={`Editar ${editando.nome}`} larga={false} aoFechar={() => setEditando(null)}>
          <FormEdicao
            key={editando.nome}
            alvo={editando}
            eu={eu}
            aoTerminar={(salvou) => {
              setEditando(null);
              if (salvou) carregar();
            }}
          />
        </Janela>
      )}
    </Flex>
  );
}
