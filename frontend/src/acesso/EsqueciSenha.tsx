import { Alert, Button, Card, Form, Input, Result, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";
import { Moldura } from "./Moldura";

export function EsqueciSenha() {
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function pedir({ email }: { email: string }) {
    setEnviando(true);
    setErro(null);
    try {
      const { mensagem } = await chamar<{ mensagem: string }>("/api/senha/esqueci", {
        metodo: "POST",
        corpo: { email },
      });
      setAviso(mensagem);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Moldura>
      {aviso ? (
        <Card className="cartao-login">
          <Result status="success" title="Pedido recebido" subTitle={aviso} />
        </Card>
      ) : (
        <Card title="Esqueci minha senha" className="cartao-login">
          {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
          <Typography.Paragraph type="secondary">
            Informe o e-mail da sua conta. Mandamos um link para criar uma senha nova.
          </Typography.Paragraph>
          <Form<{ email: string }> name="esqueci" layout="vertical" onFinish={pedir} requiredMark={false}>
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
            <Button type="primary" htmlType="submit" block loading={enviando}>
              Enviar link
            </Button>
          </Form>
        </Card>
      )}
    </Moldura>
  );
}
