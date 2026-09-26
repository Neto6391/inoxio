import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  List,
  Popconfirm,
  Row,
  Segmented,
  Skeleton,
  Tag,
  Typography,
} from "antd";
import type { Rule } from "antd/es/form";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { quando } from "./formato";
import type { Papel, UsuarioListado } from "./tipos";

type Cadastro = { nome: string; senha: string; confirmacao: string; papel: Papel };
type Edicao = { papel: Papel; senha?: string; confirmacao?: string };

const OPCOES_PAPEL = [
  { label: "Analista", value: "analista" as Papel },
  { label: "Admin", value: "admin" as Papel },
];

function confirmaSenha(obrigatoria: boolean): Rule[] {
  return [
    { required: obrigatoria, message: "Repita a senha" },
    ({ getFieldValue }) => ({
      validator: (_, valor) =>
        (valor ?? "") === (getFieldValue("senha") ?? "")
          ? Promise.resolve()
          : Promise.reject(new Error("As senhas não conferem")),
    }),
  ];
}

function FormCadastro({ aoCadastrar }: { aoCadastrar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formulario] = Form.useForm<Cadastro>();
  const { message } = App.useApp();

  async function cadastrar({ nome, senha, papel }: Cadastro) {
    setEnviando(true);
    setErro(null);
    try {
      await chamar("/api/usuarios", { metodo: "POST", corpo: { nome, senha, papel } });
      formulario.resetFields();
      message.success(`Usuário ${nome} cadastrado.`);
      aoCadastrar();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card title="Cadastrar usuário">
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Form<Cadastro>
        form={formulario}
        layout="vertical"
        requiredMark={false}
        initialValues={{ papel: "analista" }}
        onFinish={cadastrar}
      >
        <Form.Item
          label="Nome de usuário"
          name="nome"
          extra="De 3 a 32 caracteres: letras minúsculas, dígitos, ponto, hífen ou sublinhado."
          rules={[
            { required: true, message: "Informe o nome" },
            { pattern: /^[a-z0-9._-]{3,32}$/, message: "Nome fora do formato" },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          label="Senha"
          name="senha"
          rules={[
            { required: true, message: "Informe a senha" },
            { min: 12, message: "Pelo menos 12 caracteres" },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="Repita a senha" name="confirmacao" dependencies={["senha"]} rules={confirmaSenha(true)}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="Papel" name="papel">
          <Segmented<Papel> options={OPCOES_PAPEL} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={enviando}>
          Cadastrar
        </Button>
      </Form>
    </Card>
  );
}

type PropsEdicao = { alvo: UsuarioListado; aoTerminar: (salvou: boolean) => void };

function FormEdicao({ alvo, aoTerminar }: PropsEdicao) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { message } = App.useApp();

  async function salvar({ papel, senha }: Edicao) {
    // Só vai o que mudou: senha em branco mantém a atual.
    const corpo: { papel?: Papel; senha?: string } = {};
    if (papel !== alvo.papel) corpo.papel = papel;
    if (senha) corpo.senha = senha;
    if (Object.keys(corpo).length === 0) {
      aoTerminar(false);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await chamar(`/api/usuarios/${encodeURIComponent(alvo.nome)}`, { metodo: "PATCH", corpo });
      message.success(`Usuário ${alvo.nome} atualizado.`);
      aoTerminar(true);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card title={`Editar ${alvo.nome}`}>
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Form<Edicao> layout="vertical" requiredMark={false} initialValues={{ papel: alvo.papel }} onFinish={salvar}>
        <Form.Item label="Papel" name="papel">
          <Segmented<Papel> options={OPCOES_PAPEL} />
        </Form.Item>
        <Form.Item
          label="Nova senha"
          name="senha"
          extra="Deixe em branco para manter a atual. Trocar a senha encerra as sessões abertas dele."
          rules={[{ min: 12, message: "Pelo menos 12 caracteres" }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="Repita a nova senha" name="confirmacao" dependencies={["senha"]} rules={confirmaSenha(false)}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Flex gap="small">
          <Button type="primary" htmlType="submit" loading={enviando}>
            Salvar
          </Button>
          <Button onClick={() => aoTerminar(false)}>Cancelar</Button>
        </Flex>
      </Form>
    </Card>
  );
}

export function Usuarios({ eu }: { eu: string }) {
  const [usuarios, setUsuarios] = useState<UsuarioListado[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [editando, setEditando] = useState<UsuarioListado | null>(null);
  const { message } = App.useApp();

  function carregar() {
    chamar<UsuarioListado[]>("/api/usuarios")
      .then(setUsuarios)
      .catch((falha) => setErroLista(mensagemDeErro(falha)));
  }

  useEffect(carregar, []);

  async function mudarSituacao(usuario: UsuarioListado, ativo: boolean) {
    setErroAcao(null);
    try {
      const caminho = `/api/usuarios/${encodeURIComponent(usuario.nome)}`;
      await chamar(caminho, { metodo: "PATCH", corpo: { ativo } });
      message.success(`Usuário ${usuario.nome} ${ativo ? "reativado" : "desativado"}.`);
      carregar();
    } catch (falha) {
      setErroAcao(mensagemDeErro(falha));
    }
  }

  function acoes(usuario: UsuarioListado) {
    const botoes = [
      <Button key="editar" size="small" onClick={() => setEditando(usuario)}>
        Editar
      </Button>,
    ];
    if (usuario.nome === eu) return botoes;
    if (usuario.ativo) {
      botoes.push(
        <Popconfirm
          key="desativar"
          title={`Desativar ${usuario.nome}?`}
          description="Ele não entra mais, e as sessões abertas dele caem na hora."
          okText="Desativar"
          cancelText="Cancelar"
          onConfirm={() => mudarSituacao(usuario, false)}
        >
          <Button size="small" danger>
            Desativar
          </Button>
        </Popconfirm>,
      );
    } else {
      botoes.push(
        <Button key="reativar" size="small" onClick={() => mudarSituacao(usuario, true)}>
          Reativar
        </Button>,
      );
    }
    return botoes;
  }

  return (
    <Row gutter={[24, 24]}>
      <Col xs={24}>
        <Typography.Title level={2}>Usuários</Typography.Title>
        <Typography.Text type="secondary">
          Só o admin vê esta tela. Cada usuário vê apenas as próprias investigações; o admin abre
          qualquer uma.
        </Typography.Text>
      </Col>
      <Col xs={24} md={10}>
        {editando ? (
          <FormEdicao
            key={editando.nome}
            alvo={editando}
            aoTerminar={(salvou) => {
              setEditando(null);
              if (salvou) carregar();
            }}
          />
        ) : (
          <FormCadastro aoCadastrar={carregar} />
        )}
      </Col>
      <Col xs={24} md={14}>
        <Card title="Usuários cadastrados">
          {erroAcao && <Alert type="error" showIcon title={erroAcao} className="espaco" />}
          {erroLista ? (
            <Alert type="error" showIcon title={erroLista} />
          ) : usuarios === null ? (
            <Skeleton active />
          ) : (
            <List<UsuarioListado>
              dataSource={usuarios}
              renderItem={(usuario) => (
                <List.Item actions={acoes(usuario)}>
                  <List.Item.Meta
                    title={
                      <Flex gap="small" align="center" wrap>
                        <span className={usuario.ativo ? undefined : "inativo"}>{usuario.nome}</span>
                        <Tag color={usuario.papel === "admin" ? "gold" : "default"}>{usuario.papel}</Tag>
                        {!usuario.ativo && <Tag color="red">desativado</Tag>}
                        {usuario.nome === eu && <Tag color="blue">você</Tag>}
                      </Flex>
                    }
                    description={`desde ${quando(usuario.criado_em)}`}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Col>
    </Row>
  );
}
