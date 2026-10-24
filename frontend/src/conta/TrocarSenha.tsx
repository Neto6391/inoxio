import { Alert, App, Button, Flex, Form, Input, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";

type FormSenha = { atual: string; nova: string; confirmacao: string };

export function TrocarSenha({ aoTerminar }: { aoTerminar: () => void }) {
  const [formulario] = Form.useForm<FormSenha>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { message } = App.useApp();

  async function trocar({ atual, nova }: FormSenha) {
    setEnviando(true);
    setErro(null);
    try {
      await chamar("/api/conta/senha", { metodo: "POST", corpo: { atual, nova } });
      formulario.resetFields();
      message.success("Senha trocada. As outras sessões foram encerradas.");
      aoTerminar();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Form<FormSenha> form={formulario} layout="vertical" requiredMark={false} onFinish={trocar}>
        <Form.Item label="Senha atual" name="atual" rules={[{ required: true, message: "Informe a senha atual" }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          label="Senha nova"
          name="nova"
          rules={[
            { required: true, message: "Informe a senha nova" },
            { min: 12, message: "Pelo menos 12 caracteres" },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="Repita a senha nova"
          name="confirmacao"
          dependencies={["nova"]}
          rules={[
            { required: true, message: "Repita a senha nova" },
            ({ getFieldValue }) => ({
              validator: (_, valor) =>
                valor === getFieldValue("nova") ? Promise.resolve() : Promise.reject(new Error("As senhas não conferem")),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          Você continua nesta sessão; as abertas em outros navegadores caem.
        </Typography.Paragraph>
        <Flex gap="small">
          <Button type="primary" htmlType="submit" loading={enviando}>
            Trocar a senha
          </Button>
          <Button onClick={aoTerminar}>Cancelar</Button>
        </Flex>
      </Form>
    </>
  );
}
