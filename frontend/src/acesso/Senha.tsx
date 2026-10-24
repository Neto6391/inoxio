import { Alert, Button, Card, Form, Input, Result, Typography } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";
import { Rodape } from "../compartilhado/Rodape";
import { Link, navegar } from "../app/rotas";

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="login">
      <div className="area-senha">
        <div className="marca espaco">
          <span className="marca-simbolo">I</span>
          Inóxio
        </div>
        {children}
        <div className="espaco-topo">
          <Link para="/entrar">← Voltar para entrar</Link>
        </div>
        <Rodape />
      </div>
    </div>
  );
}

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

type SenhaNova = { senha: string; confirmacao: string };

export function RedefinirSenha() {
  // O token vem depois do "#", que o navegador não manda ao servidor. Lido sem apagar,
  // porque o StrictMode chama o inicializador duas vezes; a barra é limpa depois.
  const [token, setToken] = useState(() => window.location.hash.slice(1));
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Colar outro link nesta mesma página só troca o "#", sem recarregar.
    function lerDaBarra() {
      const novo = window.location.hash.slice(1);
      if (!novo) return;
      setToken(novo);
      setErro(null);
      window.history.replaceState(null, "", window.location.pathname);
    }
    lerDaBarra();
    window.addEventListener("hashchange", lerDaBarra);
    return () => window.removeEventListener("hashchange", lerDaBarra);
  }, []);

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
