import { Alert, Button, Card, Col, Flex, Row, Tag, Typography } from "antd";
import { navegar } from "./rotas";
import type { Sessao } from "./tipos";

const PASSOS = [
  {
    titulo: "Cole o indicador",
    texto: "O endereço de uma página, um domínio, um IP ou o hash de um arquivo suspeito.",
  },
  {
    titulo: "As fontes respondem",
    texto:
      "VirusTotal e AbuseIPDB são consultados em paralelo, e o veredito sai de regras fixas, sempre as mesmas.",
  },
  {
    titulo: "A IA explica",
    texto:
      "Um modelo de linguagem resume as evidências, aponta técnicas do MITRE ATT&CK e sugere o que fazer. Ele não decide o veredito.",
  },
];

const TIPOS = [
  { titulo: "URL", texto: "A página e o domínio dela, e vale o resultado mais grave." },
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
  detalhe: string;
  itens: string[];
  destaque?: boolean;
};

const PLANOS: Plano[] = [
  {
    nome: "Gratuito",
    preco: "R$ 0",
    detalhe: "para experimentar",
    itens: [
      "Até 20 investigações por hora",
      "1 usuário",
      "URL, domínio, IP e hash",
      "Explicação da IA em cada resultado",
    ],
  },
  {
    nome: "Profissional",
    preco: "R$ 149",
    detalhe: "por mês",
    destaque: true,
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
    detalhe: "para times de segurança",
    itens: [
      "Cota sob medida",
      "Usuários sem limite",
      "Integração por API com o SIEM (em estudo)",
      "Acordo de nível de serviço",
    ],
  },
];

export function Landing({ sessao }: { sessao: Sessao | null }) {
  const acao = sessao ? "Abrir painel" : "Entrar";
  const irParaApp = () => navegar(sessao ? "/painel" : "/entrar");

  return (
    <div className="landing">
      <header className="landing-topo">
        <span className="marca">
          <span className="marca-simbolo">I</span>
          Inóxio
        </span>
        <nav className="landing-links">
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
        </nav>
        <Button type="primary" onClick={irParaApp}>
          {acao}
        </Button>
      </header>

      <section className="landing-hero">
        <Tag color="blue">Investigação de indicadores suspeitos</Tag>
        <Typography.Title className="landing-titulo">
          Descubra em segundos se um link, domínio, IP ou arquivo é suspeito.
        </Typography.Title>
        <Typography.Paragraph className="landing-subtitulo">
          O Inóxio cruza o VirusTotal e o AbuseIPDB, decide o veredito por regras fixas e usa IA
          só para explicar o resultado em português.
        </Typography.Paragraph>
        <Flex gap="middle" justify="center" wrap>
          <Button type="primary" size="large" onClick={irParaApp}>
            {acao}
          </Button>
          <Button size="large" href="#planos">
            Ver planos
          </Button>
        </Flex>
      </section>

      <section id="como-funciona" className="landing-secao">
        <Typography.Title level={2}>Como funciona</Typography.Title>
        <Row gutter={[16, 16]}>
          {PASSOS.map((passo, posicao) => (
            <Col key={passo.titulo} xs={24} md={8}>
              <Card className="landing-cartao">
                <span className="landing-numero">{posicao + 1}</span>
                <Typography.Title level={4}>{passo.titulo}</Typography.Title>
                <Typography.Text type="secondary">{passo.texto}</Typography.Text>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      <section className="landing-secao">
        <Typography.Title level={2}>O que dá para investigar</Typography.Title>
        <Row gutter={[16, 16]}>
          {TIPOS.map((tipo) => (
            <Col key={tipo.titulo} xs={24} sm={12} lg={6}>
              <Card className="landing-cartao" size="small">
                <Typography.Title level={5}>{tipo.titulo}</Typography.Title>
                <Typography.Text type="secondary">{tipo.texto}</Typography.Text>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      <section className="landing-secao">
        <Typography.Title level={2}>Por que confiar no veredito</Typography.Title>
        <ul className="landing-lista">
          {GARANTIAS.map((garantia) => (
            <li key={garantia}>{garantia}</li>
          ))}
        </ul>
      </section>

      <section id="planos" className="landing-secao">
        <Typography.Title level={2}>Planos</Typography.Title>
        <Alert
          type="warning"
          showIcon
          className="espaco"
          title="Projeto acadêmico: planos e valores são ilustrativos, e nada é vendido."
          description="As consultas usam as APIs gratuitas do VirusTotal e do AbuseIPDB, cujos termos não permitem uso comercial. Vender um plano exigiria as versões pagas dessas APIs."
        />
        <Row gutter={[16, 16]}>
          {PLANOS.map((plano) => (
            <Col key={plano.nome} xs={24} md={8}>
              <Card className={plano.destaque ? "landing-plano landing-plano-destaque" : "landing-plano"}>
                <Flex vertical gap="middle">
                  <Typography.Title level={4}>{plano.nome}</Typography.Title>
                  <div>
                    <span className="landing-preco">{plano.preco}</span>
                    <Typography.Text type="secondary"> {plano.detalhe}</Typography.Text>
                  </div>
                  <ul className="landing-lista">
                    {plano.itens.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {plano.nome === "Gratuito" ? (
                    <Button type="primary" block onClick={irParaApp}>
                      {acao}
                    </Button>
                  ) : (
                    <Button block disabled>
                      Demonstração
                    </Button>
                  )}
                </Flex>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      <footer className="landing-rodape">
        Inóxio · projeto da disciplina Projeto Aplicado: Práticas de Mercado ·{" "}
        <a href="https://github.com/Neto6391/inoxio" target="_blank" rel="noopener noreferrer">
          código no GitHub
        </a>
      </footer>
    </div>
  );
}
