import { Alert, Button, Card, Checkbox, Col, Form, Input, Result, Row, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { Rodape } from "./Rodape";
import { Link } from "./rotas";
import type { Sessao } from "./tipos";

type Credenciais = { nome: string; senha: string };
type Cadastro = { nome: string; email: string; senha: string; confirmacao: string; aceite: boolean };

function Entrar({ aoEntrar }: { aoEntrar: (sessao: Sessao) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(credenciais: Credenciais) {
    setEnviando(true);
    setErro(null);
    try {
      aoEntrar(await chamar<Sessao>("/api/login", { metodo: "POST", corpo: credenciais }));
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card title="Entrar" className="cartao-login">
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Form<Credenciais> name="entrar" layout="vertical" onFinish={enviar} requiredMark={false}>
        <Form.Item label="Usuário" name="nome" rules={[{ required: true, message: "Informe o usuário" }]}>
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item label="Senha" name="senha" rules={[{ required: true, message: "Informe a senha" }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={enviando}>
          Entrar
        </Button>
      </Form>
      <div className="espaco-topo">
        <Link para="/esqueci-senha">Esqueci minha senha</Link>
      </div>
      <Typography.Paragraph type="secondary" className="espaco-topo">
        Acabou de se cadastrar? Ative a conta pelo link que mandamos por e-mail antes de entrar.
      </Typography.Paragraph>
    </Card>
  );
}

function CriarConta() {
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cadastrar({ nome, email, senha }: Cadastro) {
    setEnviando(true);
    setErro(null);
    try {
      const { mensagem } = await chamar<{ mensagem: string }>("/api/cadastro", {
        metodo: "POST",
        corpo: { nome, email, senha, aceite_termos: true },
      });
      setAviso(mensagem);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  if (aviso) {
    return (
      <Card className="cartao-login">
        <Result status="success" title="Cadastro recebido" subTitle={aviso} />
      </Card>
    );
  }

  return (
    <Card title="Criar conta" className="cartao-login">
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      {/* Nome próprio em cada formulário: sem ele os dois teriam campos com o mesmo id. */}
      <Form<Cadastro> name="cadastro" layout="vertical" onFinish={cadastrar} requiredMark={false}>
        <Form.Item
          label="Nome de usuário"
          name="nome"
          extra="De 3 a 32 caracteres: letras minúsculas, dígitos, ponto, hífen ou sublinhado."
          rules={[
            { required: true, message: "Escolha um nome" },
            { pattern: /^[a-z0-9._-]{3,32}$/, message: "Nome fora do formato" },
          ]}
        >
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item
          label="E-mail"
          name="email"
          rules={[
            { required: true, message: "Informe o e-mail" },
            { type: "email", message: "E-mail inválido" },
          ]}
        >
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item
          label="Crie uma senha"
          name="senha"
          rules={[
            { required: true, message: "Crie uma senha" },
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
        <Form.Item
          name="aceite"
          valuePropName="checked"
          rules={[
            {
              validator: (_, marcado) =>
                marcado ? Promise.resolve() : Promise.reject(new Error("Aceite para criar a conta")),
            },
          ]}
        >
          <Checkbox>
            Li e aceito os{" "}
            <a href="/termos" target="_blank" rel="noopener noreferrer">
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a href="/privacidade" target="_blank" rel="noopener noreferrer">
              Política de Privacidade
            </a>
          </Checkbox>
        </Form.Item>
        <Button htmlType="submit" block loading={enviando}>
          Criar conta
        </Button>
      </Form>
      <Typography.Paragraph type="secondary" className="espaco-topo">
        A conta começa com 10 investigações por dia e só entra depois de confirmar o e-mail.
      </Typography.Paragraph>
    </Card>
  );
}

export function Login({ aoEntrar }: { aoEntrar: (sessao: Sessao) => void }) {
  return (
    <div className="login">
      <div className="area-login">
        <div className="marca espaco">
          <span className="marca-simbolo">I</span>
          Inóxio
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Entrar aoEntrar={aoEntrar} />
          </Col>
          <Col xs={24} md={12}>
            <CriarConta />
          </Col>
        </Row>
        <div className="espaco-topo">
          <Link para="/">← Conhecer o Inóxio</Link>
        </div>
        <Rodape />
      </div>
    </div>
  );
}
