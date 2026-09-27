import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { Link } from "./rotas";
import type { Sessao } from "./tipos";

type Credenciais = { nome: string; senha: string };

export function Login({ aoEntrar }: { aoEntrar: (sessao: Sessao) => void }) {
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
    <div className="login">
      <Card className="cartao-login">
        <div className="marca espaco">
          <span className="marca-simbolo">I</span>
          Inóxio
        </div>
        <Typography.Paragraph type="secondary">
          Investigação de indicadores suspeitos: IPs, domínios e arquivos.
        </Typography.Paragraph>
        {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
        <Form<Credenciais> layout="vertical" onFinish={enviar} requiredMark={false}>
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
          <Link para="/">← Conhecer o Inóxio</Link>
        </div>
      </Card>
    </div>
  );
}
