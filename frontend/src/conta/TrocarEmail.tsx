import { Alert, Button, Flex, Form, Input, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";

type FormEmail = { email: string; senha: string };

export function TrocarEmail({ aoPedir, aoTerminar }: { aoPedir: (email: string) => void; aoTerminar: () => void }) {
  const [formulario] = Form.useForm<FormEmail>();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function pedir({ email, senha }: FormEmail) {
    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      const { mensagem } = await chamar<{ mensagem: string }>("/api/conta/email", {
        metodo: "POST",
        corpo: { email, senha },
      });
      formulario.resetFields();
      setAviso(mensagem);
      aoPedir(email.trim().toLowerCase());
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  if (aviso) {
    return (
      <Flex vertical gap="middle">
        <Alert type="success" showIcon title={aviso} />
        <Button type="primary" onClick={aoTerminar} className="botao-salvar">
          Entendi
        </Button>
      </Flex>
    );
  }
  return (
    <>
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Form<FormEmail> form={formulario} layout="vertical" requiredMark={false} onFinish={pedir}>
        <Form.Item
          label="E-mail novo"
          name="email"
          rules={[
            { required: true, message: "Informe o e-mail novo" },
            { type: "email", message: "Informe um e-mail válido" },
          ]}
        >
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item label="Sua senha, para confirmar" name="senha" rules={[{ required: true, message: "Informe a senha" }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          Mandamos um link ao e-mail novo, e ele só passa a valer depois do clique. O e-mail atual
          recebe um aviso.
        </Typography.Paragraph>
        <Flex gap="small">
          <Button type="primary" htmlType="submit" loading={enviando}>
            Enviar o link
          </Button>
          <Button onClick={aoTerminar}>Cancelar</Button>
        </Flex>
      </Form>
    </>
  );
}
