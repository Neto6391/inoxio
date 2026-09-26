import { Tag } from "antd";

// Nenhuma cor sugere que o indicador é inofensivo: sem evidência é azul, não verde.
export const CORES_VEREDITO: Record<string, string> = {
  malicioso: "#ef4444",
  suspeito: "#f59e0b",
  sem_evidencia: "#3b82f6",
  desconhecido: "#64748b",
  inconclusivo: "#8b5cf6",
};

const NOMES_VEREDITO: Record<string, string> = {
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
};

export function quando(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

// Texto de terceiros vira texto: o React escapa tudo o que passa por aqui.
export function comoTexto(valor: unknown): string {
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "—";
  return valor === "" || valor === null || valor === undefined ? "—" : String(valor);
}
