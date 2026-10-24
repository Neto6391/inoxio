import { Alert, Button, Form, Input, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";
import { Link } from "../app/rotas";
import type { Sessao } from "../compartilhado/tipos";

type Credenciais = { nome: string; senha: string };

export function Entrar({ aoEntrar }: { aoEntrar: (sessao: Sessao) => void }) {
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
    <>
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Form<Credenciais> name="entrar" layout="vertical" onFinish={enviar} requiredMark={false}>
        <Form.Item label="Usuário" name="nome" rules={[{ required: true, message: "Informe o usuário" }]}>
          <Input size="large" autoComplete="username" />
        </Form.Item>
        <Form.Item label="Senha" name="senha" rules={[{ required: true, message: "Informe a senha" }]}>
          <Input.Password size="large" autoComplete="current-password" />
        </Form.Item>
        <div className="entrar-esqueci">
          <Link para="/esqueci-senha">Esqueci minha senha</Link>
        </div>
        <Button type="primary" size="large" htmlType="submit" block loading={enviando}>
          Entrar
        </Button>
      </Form>
      <Typography.Paragraph type="secondary" className="espaco-topo">
        Acabou de se cadastrar? Ative a conta pelo link que mandamos por e-mail antes de entrar.
      </Typography.Paragraph>
    </>
  );
}
