import { Flex, Input, Select } from "antd";

export type Filtros = { busca: string; papel: string; situacao: string };
export const SEM_FILTRO: Filtros = { busca: "", papel: "", situacao: "" };

const PAPEIS = [
  { label: "Todos os papéis", value: "" },
  { label: "Admin", value: "admin" },
  { label: "Analista", value: "analista" },
];
const SITUACOES = [
  { label: "Todas as situações", value: "" },
  { label: "Ativas", value: "ativa" },
  { label: "Desativadas", value: "desativada" },
  { label: "Aguardando e-mail", value: "aguardando" },
  { label: "Recusadas", value: "recusada" },
];

// Os mesmos filtros nas telas de Usuários e de Auditoria, e os mesmos parâmetros na API.
export function parametros(filtros: Filtros, pagina: number): string {
  const busca = new URLSearchParams({ pagina: String(pagina) });
  if (filtros.busca.trim()) busca.set("busca", filtros.busca.trim());
  if (filtros.papel) busca.set("papel", filtros.papel);
  if (filtros.situacao) busca.set("situacao", filtros.situacao);
  return busca.toString();
}

type Props = { filtros: Filtros; aoMudar: (filtros: Filtros) => void };

export function FiltrosUsuarios({ filtros, aoMudar }: Props) {
  return (
    <Flex gap="small" wrap className="filtros">
      <Input.Search
        allowClear
        placeholder="Buscar por usuário, nome ou e-mail"
        aria-label="Buscar usuário"
        defaultValue={filtros.busca}
        onSearch={(busca) => aoMudar({ ...filtros, busca })}
        onChange={(evento) => {
          // Apagar o texto tira o filtro na hora, como na Auditoria.
          if (!evento.target.value) aoMudar({ ...filtros, busca: "" });
        }}
        className="filtro-busca"
      />
      <Select
        aria-label="Filtrar por papel"
        value={filtros.papel}
        options={PAPEIS}
        onChange={(papel) => aoMudar({ ...filtros, papel })}
        className="filtro-select"
      />
      <Select
        aria-label="Filtrar por situação"
        value={filtros.situacao}
        options={SITUACOES}
        onChange={(situacao) => aoMudar({ ...filtros, situacao })}
        className="filtro-select"
      />
    </Flex>
  );
}
