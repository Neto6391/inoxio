import { Alert, App, Button, Form, Input, Segmented } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../../compartilhado/api";
import type { Papel } from "../../compartilhado/tipos";
import { confirmaSenha, OPCOES_PAPEL } from "./campos";

type Cadastro = { nome: string; senha: string; confirmacao: string; papel: Papel };

export function FormCadastro({ aoCadastrar }: { aoCadastrar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formulario] = Form.useForm<Cadastro>();
  const { message } = App.useApp();

  async function cadastrar({ nome, senha, papel }: Cadastro) {
    setEnviando(true);
    setErro(null);
    try {
      await chamar("/api/usuarios", { metodo: "POST", corpo: { nome, senha, papel } });
      formulario.resetFields();
      message.success(`Usuário ${nome} cadastrado.`);
      aoCadastrar();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
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
        <Form.Item label="Repita a senha" name="confirmacao" dependencies={["senha"]} rules={confirmaSenha(true)}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="Papel" name="papel">
          <Segmented<Papel> options={OPCOES_PAPEL} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={enviando}>
          Cadastrar
        </Button>
      </Form>
    </>
  );
}
