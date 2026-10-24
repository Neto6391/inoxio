import { Alert, Button, Card, Form, Input, Result, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";
import { Link, navegar } from "../app/rotas";
import { useTokenDaBarra } from "./useTokenDaBarra";
import { Moldura } from "./Moldura";

type SenhaNova = { senha: string; confirmacao: string };

export function RedefinirSenha() {
  const [erro, setErro] = useState<string | null>(null);
  const token = useTokenDaBarra(() => setErro(null));
  const [pronto, setPronto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function trocar({ senha }: SenhaNova) {
    setEnviando(true);
    setErro(null);
    try {
      const { mensagem } = await chamar<{ mensagem: string }>("/api/senha/redefinir", {
        metodo: "POST",
        corpo: { token, senha },
      });
      setPronto(mensagem);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <Moldura>
        <Card className="cartao-login">
          <Result
            status="success"
            title="Senha trocada"
            subTitle={pronto}
            extra={
              <Button type="primary" onClick={() => navegar("/entrar")}>
                Entrar
              </Button>
            }
          />
        </Card>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <Card title="Criar uma senha nova" className="cartao-login">
        {erro && (
          <Alert
            type="error"
            showIcon
            title={erro}
            className="espaco"
            action={<Link para="/esqueci-senha">Pedir outro link</Link>}
          />
        )}
        <Form<SenhaNova> name="redefinir" layout="vertical" onFinish={trocar} requiredMark={false}>
          <Form.Item
            label="Senha nova"
            name="senha"
            rules={[
              { required: true, message: "Crie uma senha" },
              { min: 12, message: "Pelo menos 12 caracteres" },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Repita a senha nova"
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
          <Button type="primary" htmlType="submit" block loading={enviando}>
            Trocar a senha
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" className="espaco-topo">
          Trocar a senha encerra as sessões abertas em outros aparelhos.
        </Typography.Paragraph>
      </Card>
    </Moldura>
  );
}
