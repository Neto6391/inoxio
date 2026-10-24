// O texto da página inicial: os passos, os recursos, os tipos, as garantias e os planos.

export const PASSOS = [
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

export const RECURSOS = [
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

export const TIPOS = [
  { titulo: "URL", texto: "A página e o domínio dela; vale o resultado mais grave." },
  { titulo: "Domínio", texto: "Reputação no VirusTotal e os IPs do DNS como contexto." },
  { titulo: "IP", texto: "Relatos de abuso no AbuseIPDB e detecções no VirusTotal." },
  { titulo: "Hash", texto: "MD5, SHA-1 ou SHA-256 de um arquivo, direto no VirusTotal." },
];

export const GARANTIAS = [
  "O veredito vem de regras fixas: a mesma entrada dá sempre o mesmo resultado.",
  "A IA não tem ferramentas nem campo de veredito; ela só escreve a explicação.",
  "Texto vindo das fontes é mostrado como texto, nunca interpretado.",
  "Fonte que falha deixa o resultado inconclusivo, nunca \"sem evidência\".",
  "HTTPS com troca de chaves pós-quântica (ML-KEM).",
];

export type Plano = {
  nome: string;
  preco: string;
  detalhe?: string;
  itens: string[];
  selo?: string;
};

export const PLANOS: Plano[] = [
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
