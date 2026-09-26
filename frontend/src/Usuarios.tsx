import { Alert, App, Button, Card, Col, Form, Input, List, Row, Segmented, Skeleton, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { quando } from "./formato";
import type { Papel, UsuarioListado } from "./tipos";

type Cadastro = { nome: string; senha: string; confirmacao: string; papel: Papel };

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioListado[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formulario] = Form.useForm<Cadastro>();
  const { message } = App.useApp();

  function carregar() {
    chamar<UsuarioListado[]>("/api/usuarios")
      .then(setUsuarios)
      .catch((falha) => setErroLista(mensagemDeErro(falha)));
  }

  useEffect(carregar, []);

  async function cadastrar({ nome, senha, papel }: Cadastro) {
    setEnviando(true);
    setErro(null);
    try {
      await chamar("/api/usuarios", { metodo: "POST", corpo: { nome, senha, papel } });
      formulario.resetFields();
      message.success(`Usuário ${nome} cadastrado.`);
      carregar();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
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
            <Form.Item
              label="Repita a senha"
              name="confirmacao"
              dependencies={["senha"]}
              rules={[
                { required: true, message: "Repita a senha" },
                ({ getFieldValue }) => ({
                  validator: (_, valor) =>
                    !valor || valor === getFieldValue("senha")
                      ? Promise.resolve()
                      : Promise.reject(new Error("As senhas não conferem")),
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item label="Papel" name="papel">
              <Segmented<Papel>
                options={[
                  { label: "Analista", value: "analista" },
                  { label: "Admin", value: "admin" },
                ]}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={enviando}>
              Cadastrar
            </Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14}>
        <Card title="Usuários cadastrados">
          {erroLista ? (
            <Alert type="error" showIcon title={erroLista} />
          ) : usuarios === null ? (
            <Skeleton active />
          ) : (
            <List<UsuarioListado>
              dataSource={usuarios}
              renderItem={(usuario) => (
                <List.Item extra={<Tag color={usuario.papel === "admin" ? "gold" : "default"}>{usuario.papel}</Tag>}>
                  <List.Item.Meta
                    title={usuario.nome}
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
