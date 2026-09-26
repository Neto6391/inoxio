import { Tag } from "antd";

const CORES: Record<string, string> = {
  malicioso: "red",
  suspeito: "orange",
  sem_evidencia: "blue",
  desconhecido: "default",
  inconclusivo: "default",
};

export function TagVeredito({ veredito, texto }: { veredito: string; texto?: string }) {
  return <Tag color={CORES[veredito] ?? "default"}>{texto ?? veredito}</Tag>;
}

export function quando(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

// Texto de terceiros vira texto: o React escapa tudo o que passa por aqui.
export function comoTexto(valor: unknown): string {
  return Array.isArray(valor) ? valor.join(", ") : String(valor);
}
