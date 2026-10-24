import { Button, Card, Typography } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { chamar } from "../../compartilhado/api";
import { dataPorExtenso } from "../../compartilhado/formato";
import { IconeVoltar } from "../../compartilhado/icones";
import { Rodape } from "../../compartilhado/Rodape";
import { Link, navegar, temAnterior } from "../../app/rotas";

type Secao = { titulo: string; corpo: ReactNode };

type Publico = { contato_privacidade: string; versao_termos: string };

// A versão dos termos tem uma fonte só, o servidor: é ela que decide quem precisa
// aceitar de novo.
export function usePublico(): Publico | null {
  const [publico, setPublico] = useState<Publico | null>(null);
  useEffect(() => {
    chamar<Publico>("/api/publico")
      .then(setPublico)
      .catch(() => setPublico(null));
  }, []);
  return publico;
}

// Onde o documento aparece: logado, dentro do app (menu e breadcrumb); numa janela por
// cima da tela de entrar, só o texto (a janela dá o título); sem sessão, sozinho, com o
// botão Voltar e o logo levando à página inicial.
type PropsDocumento = { titulo: string; secoes: Secao[]; dentroDoApp?: boolean; naJanela?: boolean };

export type PropsDoDocumento = { dentroDoApp?: boolean; naJanela?: boolean };

export function Documento({ titulo, secoes, dentroDoApp = false, naJanela = false }: PropsDocumento) {
  const publico = usePublico();
  if (naJanela) {
    return (
      <div className="documento-na-janela">
        {publico?.versao_termos && (
          <Typography.Text type="secondary">Versão de {dataPorExtenso(publico.versao_termos)}.</Typography.Text>
        )}
        {secoes.map((secao) => (
          <section key={secao.titulo}>
            <Typography.Title level={5}>{secao.titulo}</Typography.Title>
            {secao.corpo}
          </section>
        ))}
      </div>
    );
  }
  const cartao = (
    <Card className="documento">
        <Typography.Title level={1}>{titulo}</Typography.Title>
        {publico?.versao_termos && (
          <Typography.Text type="secondary">
            Versão de {dataPorExtenso(publico.versao_termos)}.
          </Typography.Text>
        )}
        {secoes.map((secao) => (
          <section key={secao.titulo}>
            <Typography.Title level={3}>{secao.titulo}</Typography.Title>
            {secao.corpo}
          </section>
        ))}
    </Card>
  );
  if (dentroDoApp) return cartao;
  return (
    <div className="pagina-inicial">
      <header className="pagina-topo">
        <div className="pagina-largura pagina-topo-linha">
          <Link para="/">
            <span className="marca">
              <span className="marca-simbolo">I</span>
              Inóxio
            </span>
          </Link>
          <span className="topo-espaco" />
          <Button
            className="botao-voltar"
            icon={<IconeVoltar />}
            onClick={() => (temAnterior() ? window.history.back() : navegar("/"))}
          >
            Voltar
          </Button>
        </div>
      </header>
      <div className="pagina-largura">
        {cartao}
        <Rodape />
      </div>
    </div>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <Typography.Paragraph>{children}</Typography.Paragraph>;
}

export function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="lista-documento">
      {itens.map((item, posicao) => (
        <li key={posicao}>{item}</li>
      ))}
    </ul>
  );
}

export function Contato() {
  const contato = usePublico()?.contato_privacidade;
  if (!contato) {
    return <>pela própria conta, na página Minha conta, ou com o administrador do sistema</>;
  }
  return (
    <>
      pela página Minha conta ou pelo e-mail <a href={`mailto:${contato}`}>{contato}</a>
    </>
  );
}
