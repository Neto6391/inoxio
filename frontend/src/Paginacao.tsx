import { Flex, Pagination } from "antd";
import { useEffect, useState } from "react";
import { chamar, ErroApi, mensagemDeErro } from "./api";
import type { Pagina } from "./tipos";

// A resposta só vale se tiver o formato do envelope; fora dele, a tela mostra um erro.
export function ehPagina<T>(dados: unknown): dados is Pagina<T> {
  return typeof dados === "object" && dados !== null && Array.isArray((dados as Pagina<T>).itens);
}

export const FORA_DO_FORMATO = "Resposta inesperada do servidor. Tente de novo.";

// Lê uma página da API. `carregando` vale enquanto a página pedida não chega: a tela
// troca a lista pelo carregando e mostra os itens novos quando eles chegam. Com cliques
// rápidos, a resposta de um pedido antigo não cobre a do novo. `releitura` sobe para ler
// de novo o mesmo endereço (depois de uma mudança).
export function usePagina<T>(endereco: string, releitura = 0) {
  const [pagina, setPagina] = useState<Pagina<T> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vigente = true;
    setCarregando(true);
    chamar<unknown>(endereco)
      .then((nova) => {
        if (!vigente) return;
        if (!ehPagina<T>(nova)) throw new ErroApi(200, FORA_DO_FORMATO);
        setPagina(nova);
        setErro(null);
      })
      .catch((falha) => {
        if (vigente) setErro(mensagemDeErro(falha));
      })
      .finally(() => {
        if (vigente) setCarregando(false);
      });
    return () => {
      vigente = false;
    };
  }, [endereco, releitura]);

  return { pagina, erro, carregando };
}

// O nome do item no singular e no plural: "1 sessão", "2 sessões".
type Props = { pagina: Pagina<unknown>; aoMudar: (numero: number) => void; rotulo: [string, string] };

// A paginação de toda lista: sempre visível, mesmo com uma página só, e diz quantos itens há.
export function Paginacao({ pagina, aoMudar, rotulo }: Props) {
  return (
    <Flex justify="end" className="espaco-topo">
      <Pagination
        current={pagina.pagina}
        pageSize={pagina.por_pagina}
        total={pagina.total}
        showSizeChanger={false}
        showTotal={(total) => `${total} ${total === 1 ? rotulo[0] : rotulo[1]}`}
        onChange={aoMudar}
      />
    </Flex>
  );
}
