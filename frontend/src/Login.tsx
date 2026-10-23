import { Alert, Button, Checkbox, Form, Input, Result, Segmented, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import foto from "./assets/investigacao.webp";
import { Privacidade, Termos } from "./Documentos";
import { Janela } from "./Janela";
import { Link, substituir } from "./rotas";
import type { Sessao } from "./tipos";

export type Aba = "entrar" | "criar";
// Cada aba tem o próprio endereço: recarregar a página ou abrir o link mantém a aba.
export const ENDERECO_DA_ABA: Record<Aba, string> = { entrar: "/entrar", criar: "/cadastro" };
type Documento = "termos" | "privacidade";

type Credenciais = { nome: string; senha: string };
type Cadastro = { nome: string; email: string; senha: string; confirmacao: string; aceite: boolean };

function Entrar({ aoEntrar }: { aoEntrar: (sessao: Sessao) => void }) {
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

function CriarConta({ aoAbrir }: { aoAbrir: (documento: Documento) => void }) {
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

const TITULOS: Record<Aba, { titulo: string; subtitulo: string }> = {
  entrar: { titulo: "Bem-vindo de volta", subtitulo: "Entre para continuar as suas investigações." },
  criar: { titulo: "Crie a sua conta", subtitulo: "Grátis, com 10 investigações por dia." },
};

const ABAS = [
  { label: "Entrar", value: "entrar" as Aba },
  { label: "Criar conta", value: "criar" as Aba },
];

type PropsLogin = { aoEntrar: (sessao: Sessao) => void; abaInicial?: Aba };

// A foto ocupa a metade esquerda; à direita, um cartão só, com as duas abas.
export function Login({ aoEntrar, abaInicial = "entrar" }: PropsLogin) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [documento, setDocumento] = useState<Documento | null>(null);

  function trocarAba(nova: Aba) {
    setAba(nova);
    substituir(ENDERECO_DA_ABA[nova]);
  }

  return (
    <div className="tela-entrar">
      <div className="tela-entrar-foto">
        <img src={foto} alt="Mesa com notebook, caderno e uma lupa" />
        <div className="tela-entrar-sombra" aria-hidden="true" />
        <div className="tela-entrar-chamada">
          <h1>Investigue antes de clicar.</h1>
          <p>
            Cole um link, domínio, IP ou hash e saiba em segundos o que as fontes dizem sobre ele,
            explicado em português simples.
          </p>
          <ul>
            <li>Veredito por regras fixas, sempre o mesmo</li>
            <li>A IA explica; ela não decide</li>
            <li>10 investigações por dia, grátis</li>
          </ul>
        </div>
      </div>
      <div className="tela-entrar-lado">
        <div className="tela-entrar-cartao">
          <Link para="/" className="marca">
            <span className="marca-simbolo">I</span>
            Inóxio
          </Link>
          <div>
            <h2 className="tela-entrar-titulo">{TITULOS[aba].titulo}</h2>
            <Typography.Text type="secondary">{TITULOS[aba].subtitulo}</Typography.Text>
          </div>
          <Segmented<Aba> block size="large" options={ABAS} value={aba} onChange={trocarAba} />
          {aba === "entrar" ? <Entrar aoEntrar={aoEntrar} /> : <CriarConta aoAbrir={setDocumento} />}
          <Link para="/">← Conhecer o Inóxio</Link>
        </div>
      </div>
      {documento && (
        <Janela
          titulo={documento === "termos" ? "Termos de Uso" : "Política de Privacidade"}
          aoFechar={() => setDocumento(null)}
        >
          {documento === "termos" ? <Termos naJanela /> : <Privacidade naJanela />}
        </Janela>
      )}
    </div>
  );
}
