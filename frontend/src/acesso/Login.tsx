import { Segmented, Typography } from "antd";
import { useState } from "react";
import foto from "../assets/investigacao.webp";
import { Privacidade } from "../publico/documentos/Privacidade";
import { Termos } from "../publico/documentos/Termos";
import { Janela } from "../compartilhado/Janela";
import { Link, substituir } from "../app/rotas";
import type { Sessao } from "../compartilhado/tipos";
import { CriarConta } from "./CriarConta";
import { Entrar } from "./Entrar";

export type Aba = "entrar" | "criar";

// Cada aba tem o próprio endereço: recarregar a página ou abrir o link mantém a aba.
export const ENDERECO_DA_ABA: Record<Aba, string> = { entrar: "/entrar", criar: "/cadastro" };

export type Documento = "termos" | "privacidade";

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
