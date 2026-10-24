import type { Rule } from "antd/es/form";
import type { Papel } from "../../compartilhado/tipos";

export const OPCOES_PAPEL = [
  { label: "Analista", value: "analista" as Papel },
  { label: "Admin", value: "admin" as Papel },
];

export function confirmaSenha(obrigatoria: boolean): Rule[] {
  return [
    { required: obrigatoria, message: "Repita a senha" },
    ({ getFieldValue }) => ({
      validator: (_, valor) =>
        (valor ?? "") === (getFieldValue("senha") ?? "")
          ? Promise.resolve()
          : Promise.reject(new Error("As senhas não conferem")),
    }),
  ];
}

export function textoCota(cota: number | null): string {
  return cota === null ? "sem cota diária" : `cota ${cota}/dia`;
}
