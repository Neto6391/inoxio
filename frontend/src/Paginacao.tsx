import { Flex, Pagination } from "antd";
import type { Pagina } from "./tipos";

// A resposta só vale se tiver o formato do envelope; fora dele, a tela mostra um erro.
export function ehPagina<T>(dados: unknown): dados is Pagina<T> {
  return typeof dados === "object" && dados !== null && Array.isArray((dados as Pagina<T>).itens);
}

export const FORA_DO_FORMATO = "Resposta inesperada do servidor. Tente de novo.";

type Props = { pagina: Pagina<unknown>; aoMudar: (numero: number) => void; rotulo: string };

// A paginação de toda lista: some quando cabe numa página e diz quantos itens há.
export function Paginacao({ pagina, aoMudar, rotulo }: Props) {
  return (
    <Flex justify="end" className="espaco-topo">
      <Pagination
        current={pagina.pagina}
        pageSize={pagina.por_pagina}
        total={pagina.total}
        showSizeChanger={false}
        hideOnSinglePage
        showTotal={(total) => `${total} ${rotulo}`}
        onChange={aoMudar}
      />
    </Flex>
  );
}
