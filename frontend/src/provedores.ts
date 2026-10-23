// Empresas que operam IPs de muitos sites ao mesmo tempo. O texto é fixo, escrito
// aqui: não depende da IA, e a fama do IP de uma delas não diz nada sobre um site só.
export type Provedor = { nome: string; texto: string };

const MESMO_IP =
  "O mesmo IP atende muitos sites ao mesmo tempo, então a fama dele não diz nada sobre este site em particular.";
const ALUGUEL =
  "Qualquer empresa ou pessoa pode alugar um servidor ali, então o IP mostra onde o site está hospedado, não quem é o dono.";

const CONHECIDOS: { padrao: RegExp; provedor: Provedor }[] = [
  {
    padrao: /cloudflare/i,
    provedor: {
      nome: "Cloudflare",
      texto: `Empresa que fica na frente de milhões de sites: recebe os acessos, filtra ataques e entrega as páginas mais rápido. ${MESMO_IP}`,
    },
  },
  {
    padrao: /akamai/i,
    provedor: {
      nome: "Akamai",
      texto: `Empresa que entrega o conteúdo de grandes sites a partir de servidores espalhados pelo mundo. ${MESMO_IP}`,
    },
  },
  {
    padrao: /fastly/i,
    provedor: {
      nome: "Fastly",
      texto: `Empresa que entrega o conteúdo de sites a partir de servidores perto de quem acessa. ${MESMO_IP}`,
    },
  },
  {
    padrao: /google/i,
    provedor: {
      nome: "Google",
      texto: `O Google aluga servidores (Google Cloud) e mantém serviços públicos, como o de nomes no 8.8.8.8. ${ALUGUEL}`,
    },
  },
  {
    padrao: /amazon|\baws\b/i,
    provedor: {
      nome: "Amazon",
      texto: `A Amazon aluga servidores (AWS) para milhões de empresas. ${ALUGUEL}`,
    },
  },
  {
    padrao: /microsoft|azure/i,
    provedor: {
      nome: "Microsoft",
      texto: `A Microsoft aluga servidores (Azure) para milhões de empresas. ${ALUGUEL}`,
    },
  },
];

// Na ordem em que aparecem, sem repetir a mesma empresa.
export function provedoresDe(isps: string[]): Provedor[] {
  const achados: Provedor[] = [];
  for (const isp of isps) {
    const conhecido = CONHECIDOS.find(({ padrao }) => padrao.test(isp));
    if (conhecido && !achados.includes(conhecido.provedor)) achados.push(conhecido.provedor);
  }
  return achados;
}
