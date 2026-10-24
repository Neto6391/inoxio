import { Button, Flex, List, Popconfirm, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { quando } from "../../compartilhado/formato";
import type { UsuarioListado } from "../../compartilhado/tipos";
import { textoCota } from "./campos";

type Props = {
  usuarios: UsuarioListado[];
  eu: string;
  aoEditar: (usuario: UsuarioListado) => void;
  aoMudarSituacao: (usuario: UsuarioListado, ativo: boolean) => void;
};

function Confirmar({ titulo, descricao, ok, aoConfirmar }: { titulo: string; descricao: string; ok: string; aoConfirmar: () => void }) {
  return (
    <Popconfirm title={titulo} description={descricao} okText={ok} cancelText="Cancelar" onConfirm={aoConfirmar}>
      <Button size="small" danger>
        {ok}
      </Button>
    </Popconfirm>
  );
}

// Editar sempre; ativar, recusar, desativar ou reativar conforme a situação, nunca na própria conta.
function acoes(usuario: UsuarioListado, { eu, aoEditar, aoMudarSituacao }: Omit<Props, "usuarios">): ReactNode[] {
  const botoes: ReactNode[] = [
    <Button key="editar" size="small" onClick={() => aoEditar(usuario)}>
      Editar
    </Button>,
  ];
  if (usuario.nome === eu) return botoes;
  if (usuario.pendente) {
    botoes.push(
      <Button key="ativar" size="small" onClick={() => aoMudarSituacao(usuario, true)}>
        Ativar
      </Button>,
      <Confirmar
        key="recusar"
        titulo={`Recusar ${usuario.nome}?`}
        descricao="O link do e-mail deixa de valer. Dá para reativar depois."
        ok="Recusar"
        aoConfirmar={() => aoMudarSituacao(usuario, false)}
      />,
    );
  } else if (usuario.ativo) {
    botoes.push(
      <Confirmar
        key="desativar"
        titulo={`Desativar ${usuario.nome}?`}
        descricao="Ele não entra mais, e as sessões abertas dele caem na hora."
        ok="Desativar"
        aoConfirmar={() => aoMudarSituacao(usuario, false)}
      />,
    );
  } else {
    botoes.push(
      <Button key="reativar" size="small" onClick={() => aoMudarSituacao(usuario, true)}>
        Reativar
      </Button>,
    );
  }
  return botoes;
}

function Titulo({ usuario, eu }: { usuario: UsuarioListado; eu: string }) {
  return (
    <Flex gap="small" align="center" wrap>
      <span className={usuario.ativo ? undefined : "inativo"}>{usuario.nome}</span>
      {usuario.nome_exibicao && <Typography.Text type="secondary">({usuario.nome_exibicao})</Typography.Text>}
      <Tag color={usuario.papel === "admin" ? "gold" : "default"}>{usuario.papel}</Tag>
      {usuario.pendente && <Tag color="orange">aguardando e-mail</Tag>}
      {!usuario.ativo && !usuario.pendente && <Tag color="red">desativado</Tag>}
      {usuario.nome === eu && <Tag color="blue">você</Tag>}
    </Flex>
  );
}

export function ListaDeUsuarios({ usuarios, ...props }: Props) {
  return (
    <List<UsuarioListado>
      dataSource={usuarios}
      renderItem={(usuario) => (
        <List.Item actions={acoes(usuario, props)}>
          <List.Item.Meta
            title={<Titulo usuario={usuario} eu={props.eu} />}
            description={[usuario.email, textoCota(usuario.cota_diaria), `desde ${quando(usuario.criado_em)}`]
              .filter(Boolean)
              .join(" · ")}
          />
        </List.Item>
      )}
    />
  );
}
