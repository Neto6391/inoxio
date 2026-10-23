import { Alert, App, Button, Card, Descriptions, Flex, Form, Input, Popconfirm, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { dataPorExtenso, quando } from "./formato";

type Perfil = {
  nome: string;
  nome_exibicao: string | null;
  email: string | null;
  // E-mail novo que espera o clique no link.
  email_pendente?: string | null;
  papel: string;
  criado_em: string | null;
  email_confirmado_em: string | null;
  cota_diaria: number | null;
  termos_versao: string | null;
  termos_aceitos_em: string | null;
};

function NomeDeExibicao({ perfil, aoSalvar }: { perfil: Perfil; aoSalvar: (novo: Perfil) => void }) {
  const [nome, setNome] = useState(perfil.nome_exibicao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { message } = App.useApp();

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const novo = await chamar<Perfil>("/api/conta", { metodo: "PATCH", corpo: { nome_exibicao: nome } });
      aoSalvar(novo);
      message.success("Nome salvo.");
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Flex vertical gap="small">
      {erro && <Alert type="error" showIcon title={erro} />}
      <Flex gap="small" wrap>
        <Input
          aria-label="Nome de exibição"
          placeholder={perfil.nome}
          maxLength={80}
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          className="campo-nome"
        />
        <Button onClick={salvar} loading={salvando} disabled={nome.trim() === (perfil.nome_exibicao ?? "")}>
          Salvar nome
        </Button>
      </Flex>
      <Typography.Text type="secondary">
        Aparece no topo da tela. Para entrar, continua valendo o usuário {perfil.nome}.
      </Typography.Text>
    </Flex>
  );
}

type FormSenha = { atual: string; nova: string; confirmacao: string };

function TrocarSenha() {
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
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card title="Trocar a senha">
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Form<FormSenha> form={formulario} layout="vertical" requiredMark={false} onFinish={trocar} className="form-conta">
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
        <Button type="primary" htmlType="submit" loading={enviando}>
          Trocar a senha
        </Button>
      </Form>
    </Card>
  );
}

type FormEmail = { email: string; senha: string };

function TrocarEmail({ perfil, aoPedir }: { perfil: Perfil; aoPedir: (email: string) => void }) {
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

  return (
    <Card title={perfil.email ? "Trocar o e-mail" : "Informar um e-mail"}>
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      {aviso && <Alert type="success" showIcon title={aviso} className="espaco" />}
      {perfil.email_pendente && !aviso && (
        <Alert
          type="info"
          showIcon
          className="espaco"
          title={`Esperando a confirmação de ${perfil.email_pendente}: abra o link que mandamos para ele.`}
        />
      )}
      <Form<FormEmail> form={formulario} layout="vertical" requiredMark={false} onFinish={pedir} className="form-conta">
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
        <Button type="primary" htmlType="submit" loading={enviando}>
          Enviar o link
        </Button>
      </Form>
    </Card>
  );
}

type PropsConta = { aoExcluir: () => void; aoMudarNome: (nome: string | null) => void };

export function Conta({ aoExcluir, aoMudarNome }: PropsConta) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    chamar<Perfil>("/api/conta")
      .then(setPerfil)
      .catch((falha) => setErro(mensagemDeErro(falha)));
  }, []);

  async function excluir() {
    setExcluindo(true);
    setErroExclusao(null);
    try {
      await chamar("/api/conta/excluir", { metodo: "POST", corpo: { senha } });
      aoExcluir();
    } catch (falha) {
      setErroExclusao(mensagemDeErro(falha));
    } finally {
      setExcluindo(false);
    }
  }

  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (!perfil) return <Skeleton active />;

  const itens = [
    { key: "nome", label: "Usuário (para entrar)", children: perfil.nome },
    { key: "email", label: "E-mail", children: perfil.email ?? "—" },
    { key: "papel", label: "Papel", children: `${perfil.papel} (só o admin muda)` },
    { key: "criado", label: "Conta criada em", children: perfil.criado_em ? quando(perfil.criado_em) : "—" },
    { key: "cota", label: "Cota diária", children: perfil.cota_diaria ? `${perfil.cota_diaria} investigações` : "sem cota diária" },
    {
      key: "termos",
      label: "Termos aceitos",
      children: perfil.termos_aceitos_em && perfil.termos_versao
        ? `versão de ${dataPorExtenso(perfil.termos_versao)}, em ${quando(perfil.termos_aceitos_em)}`
        : "ainda não",
    },
  ];

  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Minha conta</Typography.Title>
        <Typography.Text type="secondary">
          Os seus dados e os seus direitos pela LGPD: ver, corrigir, levar e excluir.
        </Typography.Text>
      </div>
      <Card title="Seus dados">
        <Flex vertical gap="middle">
          <NomeDeExibicao
            perfil={perfil}
            aoSalvar={(novo) => {
              setPerfil({ ...perfil, ...novo });
              aoMudarNome(novo.nome_exibicao);
            }}
          />
          <Descriptions column={1} size="small" items={itens} />
        </Flex>
      </Card>
      <TrocarEmail perfil={perfil} aoPedir={(email) => setPerfil({ ...perfil, email_pendente: email })} />
      <TrocarSenha />
      <Card title="Baixar meus dados">
        <Typography.Paragraph>
          Um arquivo JSON com a sua conta, as suas investigações e os seus registros de segurança.
        </Typography.Paragraph>
        <Button href="/api/conta/dados" download>
          Baixar meus dados
        </Button>
      </Card>
      <Card title="Excluir minha conta" className="cartao-perigo">
        <Typography.Paragraph>
          Apaga a conta, as investigações e as sessões abertas. Os registros de segurança ficam pelo
          prazo da Política de Privacidade, sem o seu nome. As cópias de segurança do banco vencem
          em até 14 dias. Não dá para desfazer.
        </Typography.Paragraph>
        {erroExclusao && <Alert type="error" showIcon title={erroExclusao} className="espaco" />}
        <Flex gap="small" wrap>
          <Input.Password
            placeholder="Sua senha, para confirmar"
            autoComplete="current-password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            className="campo-senha"
          />
          <Popconfirm
            title="Excluir a sua conta?"
            description="Não dá para desfazer."
            okText="Excluir"
            okButtonProps={{ danger: true }}
            cancelText="Cancelar"
            onConfirm={excluir}
            disabled={!senha}
          >
            <Button danger disabled={!senha} loading={excluindo}>
              Excluir minha conta
            </Button>
          </Popconfirm>
        </Flex>
      </Card>
    </Flex>
  );
}
