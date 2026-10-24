import { Alert, Button, Checkbox, Form, Input, Result, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";
import type { Documento } from "./Login";

type Cadastro = { nome: string; email: string; senha: string; confirmacao: string; aceite: boolean };

export function CriarConta({ aoAbrir }: { aoAbrir: (documento: Documento) => void }) {
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
    return <Result status="success" title="Cadastro recebido" subTitle={aviso} />;
  }

  return (
    <>
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
          <Input size="large" autoComplete="username" />
        </Form.Item>
        <Form.Item
          label="E-mail"
          name="email"
          rules={[
            { required: true, message: "Informe o e-mail" },
            { type: "email", message: "E-mail inválido" },
          ]}
        >
          <Input size="large" autoComplete="email" />
        </Form.Item>
        <div className="entrar-senhas">
        <Form.Item
          label="Crie uma senha"
          name="senha"
          rules={[
            { required: true, message: "Crie uma senha" },
            { min: 12, message: "Pelo menos 12 caracteres" },
          ]}
        >
          <Input.Password size="large" autoComplete="new-password" />
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
          <Input.Password size="large" autoComplete="new-password" />
        </Form.Item>
        </div>
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
            {/* Abrem o texto numa janela, sem sair da tela: o que já foi digitado fica. */}
            <button type="button" className="link-botao" onClick={() => aoAbrir("termos")}>
              Termos de Uso
            </button>{" "}
            e a{" "}
            <button type="button" className="link-botao" onClick={() => aoAbrir("privacidade")}>
              Política de Privacidade
            </button>
          </Checkbox>
        </Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={enviando}>
          Criar conta
        </Button>
      </Form>
      <Typography.Paragraph type="secondary" className="espaco-topo">
        A conta começa com 10 investigações por dia e só entra depois de confirmar o e-mail.
      </Typography.Paragraph>
    </>
  );
}
