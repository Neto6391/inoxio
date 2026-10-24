import { Button } from "antd";
import { GARANTIAS, PASSOS, type Plano, PLANOS, RECURSOS, TIPOS } from "./conteudo";
import { Traco } from "./Traco";
import { Vitrine } from "./Vitrine";

type Acao = () => void;

function Cabecalho({ sobretitulo, titulo }: { sobretitulo: string; titulo: string }) {
  return (
    <div className="pagina-cabecalho">
      <span className="pagina-sobretitulo">{sobretitulo}</span>
      <h2>{titulo}</h2>
    </div>
  );
}

export function Topo({ aoEntrar, aoCriarConta }: { aoEntrar: Acao; aoCriarConta: Acao }) {
  return (
    <header className="pagina-topo">
      <div className="pagina-largura pagina-topo-linha">
        <a href="#topo" className="marca">
          <span className="marca-simbolo">I</span>
          Inóxio
        </a>
        <nav className="pagina-links" aria-label="Seções">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">O que você recebe</a>
          <a href="#planos">Planos</a>
        </nav>
        <div className="pagina-acoes">
          <Button size="large" onClick={aoEntrar}>
            Entrar
          </Button>
          <Button size="large" type="primary" onClick={aoCriarConta}>
            Criar conta grátis
          </Button>
        </div>
      </div>
    </header>
  );
}

export function Destaque({ aoCriarConta }: { aoCriarConta: Acao }) {
  return (
    <section id="topo" className="pagina-destaque">
      <div className="pagina-largura pagina-destaque-linha">
        <div className="pagina-destaque-texto">
          <span className="pagina-selo">Investigação de indicadores suspeitos</span>
          <h1>Descubra em segundos se um link, domínio, IP ou arquivo é suspeito.</h1>
          <p className="pagina-subtitulo">
            O Inóxio cruza o VirusTotal e o AbuseIPDB, decide o veredito por regras fixas e usa IA só para
            explicar o resultado em português simples.
          </p>
          <div className="pagina-botoes">
            <Button size="large" type="primary" onClick={aoCriarConta}>
              Criar conta grátis
            </Button>
            <Button size="large" href="#como-funciona">
              Ver como funciona
            </Button>
          </div>
          <p className="pagina-nota">10 investigações por dia no plano gratuito. Cadastro com confirmação por e-mail.</p>
        </div>
        <Vitrine />
      </div>
    </section>
  );
}

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="pagina-secao">
      <div className="pagina-largura">
        <Cabecalho sobretitulo="Como funciona" titulo="Do indicador colado à explicação, em três passos" />
        <div className="pagina-grade pagina-grade-3">
          {PASSOS.map((passo, posicao) => (
            <div key={passo.titulo} className="pagina-cartao">
              <div className="pagina-cartao-topo">
                <span className="pagina-icone">
                  <Traco>{passo.icone}</Traco>
                </span>
                <span className="pagina-numero" aria-hidden="true">
                  {posicao + 1}
                </span>
              </div>
              <h3>{passo.titulo}</h3>
              <p>{passo.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Recursos() {
  return (
    <section id="recursos" className="pagina-secao pagina-faixa">
      <div className="pagina-largura">
        <Cabecalho sobretitulo="O que você recebe" titulo="Um resultado que dá para entender e para defender" />
        <div className="pagina-grade pagina-grade-4">
          {RECURSOS.map((recurso) => (
            <div key={recurso.titulo} className="pagina-cartao">
              <span className="pagina-icone-solto">
                <Traco tamanho={28}>{recurso.icone}</Traco>
              </span>
              <h3>{recurso.titulo}</h3>
              <p>{recurso.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TiposEGarantias() {
  return (
    <section className="pagina-secao">
      <div className="pagina-largura pagina-duas-colunas">
        <div>
          <h2 className="pagina-titulo-menor">O que dá para investigar</h2>
          <div className="pagina-grade pagina-grade-2">
            {TIPOS.map((tipo) => (
              <div key={tipo.titulo} className="pagina-cartao pagina-cartao-compacto">
                <div className="pagina-tipo">{tipo.titulo}</div>
                <p>{tipo.texto}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="pagina-titulo-menor">Por que confiar no veredito</h2>
          <ul className="pagina-garantias">
            {GARANTIAS.map((garantia) => (
              <li key={garantia}>
                <Traco tamanho={22}>
                  <path d="M20 6 9 17l-5-5" />
                </Traco>
                <span>{garantia}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// O e-mail do pedido de demonstração é o contato da Política de Privacidade (vem do servidor).
function linkDeDemonstracao(contato: string, plano: string): string {
  const assunto = encodeURIComponent(`Demonstração do Inóxio — plano ${plano}`);
  return `mailto:${contato}?subject=${assunto}`;
}

function BotaoDoPlano({ plano, contato, aoCriarConta }: { plano: Plano; contato: string; aoCriarConta: Acao }) {
  if (plano.nome === "Gratuito") {
    return (
      <Button type="primary" size="large" block onClick={aoCriarConta}>
        Criar conta grátis
      </Button>
    );
  }
  if (!contato) {
    return (
      <Button size="large" block disabled>
        Em breve
      </Button>
    );
  }
  return (
    <Button size="large" block href={linkDeDemonstracao(contato, plano.nome)}>
      Pedir demonstração
    </Button>
  );
}

export function Planos({ contato, aoCriarConta }: { contato: string; aoCriarConta: Acao }) {
  return (
    <section id="planos" className="pagina-secao pagina-faixa">
      <div className="pagina-largura">
        <Cabecalho sobretitulo="Planos" titulo="Comece grátis; para o time, fale com a gente" />
        <div className="pagina-grade pagina-grade-3">
          {PLANOS.map((plano) => (
            <div key={plano.nome} className={plano.selo ? "pagina-plano pagina-plano-destaque" : "pagina-plano"}>
              {plano.selo && <span className="pagina-plano-selo">{plano.selo}</span>}
              <h3>{plano.nome}</h3>
              <div>
                <span className="pagina-preco">{plano.preco}</span>
                {plano.detalhe && <span className="pagina-preco-detalhe"> {plano.detalhe}</span>}
              </div>
              <ul>
                {plano.itens.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <BotaoDoPlano plano={plano} contato={contato} aoCriarConta={aoCriarConta} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ChamadaFinal({ aoCriarConta }: { aoCriarConta: Acao }) {
  return (
    <section className="pagina-secao pagina-secao-final">
      <div className="pagina-largura">
        <div className="pagina-chamada">
          <div>
            <h2>Tem um link estranho aí? Investigue agora.</h2>
            <p>Crie a conta em um minuto e use 10 investigações por dia, grátis.</p>
          </div>
          <Button type="primary" size="large" onClick={aoCriarConta}>
            Criar conta grátis
          </Button>
        </div>
      </div>
    </section>
  );
}
