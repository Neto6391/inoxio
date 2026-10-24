import { Button } from "antd";
import type { ReactNode } from "react";
import { usePublico } from "./Documentos";
import { INICIO } from "../app/navegacao";
import { Rodape } from "../compartilhado/Rodape";
import { navegar } from "../app/rotas";
import type { Sessao } from "../compartilhado/tipos";

// Ícones de traço da página inicial, no mesmo desenho dos de icones.tsx.
function Traco({ children, tamanho = 24 }: { children: ReactNode; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const PASSOS = [
  {
    titulo: "Cole o indicador",
    texto:
      "O endereço de uma página, um domínio, um IP ou o hash de um arquivo suspeito. O formato desarmado (hxxps://site[.]com) também funciona.",
    icone: (
      <>
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      </>
    ),
  },
  {
    titulo: "As fontes respondem",
    texto:
      "VirusTotal e AbuseIPDB são consultados em paralelo, e o veredito sai de regras fixas: a mesma entrada dá sempre o mesmo resultado.",
    icone: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    titulo: "A IA explica",
    texto:
      "Um modelo de linguagem resume as evidências em português simples, explica os termos e sugere o que fazer. Ele não decide o veredito.",
    icone: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </>
    ),
  },
];

const RECURSOS = [
  {
    titulo: "Veredito com nota",
    texto: "Malicioso, suspeito, sem evidência ou inconclusivo, com uma nota de 0 a 100 calculada por regra fixa.",
    icone: (
      <>
        <path d="M3 12a9 9 0 0 1 18 0" />
        <path d="m12 12 4-3" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
  },
  {
    titulo: "Explicação para leigos",
    texto: "O que cada fonte mostrou, um glossário dos termos e o que fazer. Para analistas, as técnicas do MITRE ATT&CK.",
    icone: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
  },
  {
    titulo: "Quem opera os IPs",
    texto:
      "Os IPs do site com a empresa que opera cada um. Cloudflare, Google ou Amazon ganham uma explicação de por que o IP é deles.",
    icone: (
      <>
        <rect x="2" y="3" width="20" height="8" rx="2" />
        <rect x="2" y="13" width="20" height="8" rx="2" />
        <path d="M6 7h.01" />
        <path d="M6 17h.01" />
      </>
    ),
  },
  {
    titulo: "Histórico e painel",
    texto: "Todas as suas investigações com busca, gráficos dos últimos 14 dias e os indicadores que você mais pesquisa.",
    icone: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </>
    ),
  },
];

const TIPOS = [
  { titulo: "URL", texto: "A página e o domínio dela; vale o resultado mais grave." },
  { titulo: "Domínio", texto: "Reputação no VirusTotal e os IPs do DNS como contexto." },
  { titulo: "IP", texto: "Relatos de abuso no AbuseIPDB e detecções no VirusTotal." },
  { titulo: "Hash", texto: "MD5, SHA-1 ou SHA-256 de um arquivo, direto no VirusTotal." },
];

const GARANTIAS = [
  "O veredito vem de regras fixas: a mesma entrada dá sempre o mesmo resultado.",
  "A IA não tem ferramentas nem campo de veredito; ela só escreve a explicação.",
  "Texto vindo das fontes é mostrado como texto, nunca interpretado.",
  "Fonte que falha deixa o resultado inconclusivo, nunca \"sem evidência\".",
  "HTTPS com troca de chaves pós-quântica (ML-KEM).",
];

type Plano = {
  nome: string;
  preco: string;
  detalhe?: string;
  itens: string[];
  selo?: string;
};

const PLANOS: Plano[] = [
  {
    nome: "Gratuito",
    preco: "R$ 0",
    detalhe: "para experimentar",
    itens: [
      "10 investigações por dia",
      "Cadastro com confirmação por e-mail",
      "URL, domínio, IP e hash",
      "Explicação da IA em cada resultado",
    ],
  },
  {
    nome: "Profissional",
    preco: "R$ 149",
    detalhe: "por mês",
    selo: "Para times pequenos",
    itens: [
      "Até 500 investigações por dia",
      "Até 10 usuários, com papéis admin e analista",
      "Histórico de 90 dias",
      "Suporte por e-mail",
    ],
  },
  {
    nome: "Empresarial",
    preco: "Sob consulta",
    itens: [
      "Cota sob medida",
      "Usuários sem limite",
      "Integração por API com o SIEM (em estudo)",
      "Acordo de nível de serviço",
    ],
  },
];

// O e-mail do pedido de demonstração é o contato da Política de Privacidade (vem do servidor).
export function linkDeDemonstracao(contato: string, plano: string): string {
  const assunto = encodeURIComponent(`Demonstração do Inóxio — plano ${plano}`);
  return `mailto:${contato}?subject=${assunto}`;
}

// A vitrine mostra um resultado real: google.com, investigado em produção em 23/10/2026,
// com o resumo que a IA escreveu. Nada aqui é inventado.
function Vitrine() {
  return (
    <figure className="vitrine" aria-label="Exemplo real de resultado: investigação de google.com">
      <div className="vitrine-barra">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span className="vitrine-caminho">Início / Investigações / resultado</span>
      </div>
      <div className="vitrine-corpo">
        <div>
          <div className="vitrine-indicador">google.com</div>
          <div className="vitrine-meta">
            <span className="vitrine-etiqueta">Domínio</span>
            exemplo real, investigado em 23/10/2026
          </div>
        </div>
        <div className="vitrine-veredito">
          <svg width="88" height="56" viewBox="0 0 88 56" role="img" aria-label="Nota de risco 0 de 100">
            <path d="M8 50 A36 36 0 0 1 80 50" fill="none" stroke="var(--borda)" strokeWidth="8" strokeLinecap="round" />
            <text x="44" y="48" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--texto)">
              0
            </text>
          </svg>
          <div>
            <div className="vitrine-rotulo">Veredito</div>
            <div className="vitrine-resultado">Sem evidência de atividade maliciosa</div>
            <div className="vitrine-rotulo">nota de risco 0 de 100, por regra fixa</div>
          </div>
        </div>
        <div className="vitrine-explicacao">
          <div className="vitrine-explicacao-titulo">
            <Traco tamanho={18}>
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
            </Traco>
            Em linguagem simples
          </div>
          <p>
            O domínio google.com não tem evidências de ser malicioso. Os registros DNS mostram IPs pertencentes
            ao Google, que é um provedor de serviços de internet. Não há sinais de abuso ou atividade suspeita.
          </p>
        </div>
        <div className="vitrine-fatos">
          <span>VirusTotal respondeu</span>
          <span>10 IPs do site, quem opera cada um</span>
          <span>3 recomendações</span>
        </div>
      </div>
    </figure>
  );
}

function Cabecalho({ sobretitulo, titulo }: { sobretitulo: string; titulo: string }) {
  return (
    <div className="pagina-cabecalho">
      <span className="pagina-sobretitulo">{sobretitulo}</span>
      <h2>{titulo}</h2>
    </div>
  );
}

export function Landing({ sessao }: { sessao: Sessao | null }) {
  const publico = usePublico();
  const contato = publico?.contato_privacidade ?? "";
  const entrar = () => navegar(sessao ? INICIO : "/entrar");
  // A tela de entrar abre direto na aba de criar conta.
  const criarConta = () => navegar(sessao ? INICIO : "/cadastro");

  return (
    <div className="pagina-inicial">
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
            <Button size="large" onClick={entrar}>
              Entrar
            </Button>
            <Button size="large" type="primary" onClick={criarConta}>
              Criar conta grátis
            </Button>
          </div>
        </div>
      </header>

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
              <Button size="large" type="primary" onClick={criarConta}>
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
                {plano.nome === "Gratuito" ? (
                  <Button type="primary" size="large" block onClick={criarConta}>
                    Criar conta grátis
                  </Button>
                ) : contato ? (
                  <Button size="large" block href={linkDeDemonstracao(contato, plano.nome)}>
                    Pedir demonstração
                  </Button>
                ) : (
                  <Button size="large" block disabled>
                    Em breve
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pagina-secao pagina-secao-final">
        <div className="pagina-largura">
          <div className="pagina-chamada">
            <div>
              <h2>Tem um link estranho aí? Investigue agora.</h2>
              <p>Crie a conta em um minuto e use 10 investigações por dia, grátis.</p>
            </div>
            <Button type="primary" size="large" onClick={criarConta}>
              Criar conta grátis
            </Button>
          </div>
        </div>
      </section>

      <div className="pagina-largura">
        <Rodape />
      </div>
    </div>
  );
}
