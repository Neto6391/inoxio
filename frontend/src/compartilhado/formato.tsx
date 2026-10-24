import { Tag } from "antd";

// Nenhuma cor sugere que o indicador é inofensivo: sem evidência é azul, não verde.
export const CORES_VEREDITO: Record<string, string> = {
  malicioso: "#ef4444",
  suspeito: "#f59e0b",
  sem_evidencia: "#3b82f6",
  desconhecido: "#64748b",
  inconclusivo: "#8b5cf6",
};

export const NOMES_VEREDITO: Record<string, string> = {
  malicioso: "Malicioso",
  suspeito: "Suspeito",
  sem_evidencia: "Sem evidência",
  desconhecido: "Desconhecido",
  inconclusivo: "Inconclusivo",
};

export function TagVeredito({ veredito, texto }: { veredito: string; texto?: string }) {
  return (
    <Tag color={CORES_VEREDITO[veredito] ?? "default"}>
      {texto ?? NOMES_VEREDITO[veredito] ?? veredito}
    </Tag>
  );
}

// Mesmas faixas do backend: a partir de 25 é suspeito, a partir de 75 é malicioso.
export function corDaNota(nota: number): string {
  if (nota >= 75) return CORES_VEREDITO.malicioso;
  if (nota >= 25) return CORES_VEREDITO.suspeito;
  return CORES_VEREDITO.sem_evidencia;
}

export const NOMES_TIPO: Record<string, string> = {
  ip: "IP",
  dominio: "Domínio",
  hash: "Hash",
  url: "URL",
};

const BRASILIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// O banco guarda UTC sem fuso ("2026-10-23T02:22:15.123456"); a tela mostra
// o horário de Brasília: "22/10/2026 23:22:15".
export function quando(iso: string): string {
  const semFracao = iso.replace(/(\.\d{3})\d+/, "$1");
  const utc = /[zZ]|[+-]\d{2}:\d{2}$/.test(semFracao) ? semFracao : `${semFracao}Z`;
  const data = new Date(utc);
  return Number.isNaN(data.getTime()) ? iso : BRASILIA.format(data).replace(", ", " ");
}

// "2026-10-23" (um dia do gráfico, já no calendário de Brasília) vira "23/10".
export function diaCurto(dia: string): string {
  const [, mes, data] = dia.split("-");
  return `${data}/${mes}`;
}

// A versão dos termos é uma data AAAA-MM-DD; lida em português ela vira "20 de outubro de 2026".
export function dataPorExtenso(versao: string): string {
  const [ano, mes, dia] = versao.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { dateStyle: "long" });
}

// Texto de terceiros vira texto: o React escapa tudo o que passa por aqui.
export function comoTexto(valor: unknown): string {
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "—";
  return valor === "" || valor === null || valor === undefined ? "—" : String(valor);
}
