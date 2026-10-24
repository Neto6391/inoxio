// O mapa das telas do app: o menu, o breadcrumb e o botão Voltar saem daqui. Uma lista
// só, para o menu e o caminho nunca discordarem sobre quem é filho de quem.
import { Breadcrumb, Button, Flex } from "antd";
import type { ReactNode } from "react";
import {
  IconeBusca,
  IconeConta,
  IconeEscudo,
  IconeGrafico,
  IconePainel,
  IconeUsuarios,
  IconeVoltar,
} from "../compartilhado/icones";
import { Link, navegar, temAnterior } from "./rotas";

export type Pagina = {
  caminho: string;
  titulo: string;
  // A tela de cima no breadcrumb. Sem pai, a tela é raiz: Início, ou Visão geral na administração.
  pai?: string;
  admin?: boolean;
  // Aparece no menu lateral, com este ícone. As filhas de uma raiz do menu ficam embaixo dela.
  icone?: ReactNode;
};

export const INICIO = "/inicio";

export const PAGINAS: Pagina[] = [
  { caminho: INICIO, titulo: "Início", icone: <IconePainel /> },
  { caminho: "/investigacoes", titulo: "Investigações", pai: INICIO, icone: <IconeBusca /> },
  // No breadcrumb, o título é o próprio id da investigação.
  { caminho: "/investigacoes/:id", titulo: ":id", pai: "/investigacoes" },
  { caminho: "/conta", titulo: "Minha conta", pai: INICIO, icone: <IconeConta /> },
  { caminho: "/termos", titulo: "Termos de Uso", pai: INICIO },
  { caminho: "/privacidade", titulo: "Política de Privacidade", pai: INICIO },
  // A administração tem a própria raiz: no breadcrumb dela não aparece o Início.
  { caminho: "/visao-geral", titulo: "Visão geral", admin: true, icone: <IconeGrafico /> },
  { caminho: "/usuarios", titulo: "Usuários", pai: "/visao-geral", admin: true, icone: <IconeUsuarios /> },
  { caminho: "/auditoria", titulo: "Auditoria", pai: "/visao-geral", admin: true, icone: <IconeEscudo /> },
];

function casa(modelo: string, caminho: string): boolean {
  const partes = modelo.split("/");
  const reais = caminho.split("/");
  return partes.length === reais.length && partes.every((parte, i) => parte === reais[i] || (parte.startsWith(":") && /^[\w-]+$/.test(reais[i])));
}

export function paginaDe(caminho: string): Pagina | undefined {
  // "/entrar" depois do login é o Início.
  const alvo = caminho === "/entrar" ? INICIO : caminho;
  return PAGINAS.find((pagina) => casa(pagina.caminho, alvo));
}

// Da raiz até a tela atual. Um título ":id" vira o pedaço do endereço que ele casou.
export function trilha(caminho: string): Pagina[] {
  const passos: Pagina[] = [];
  let atual = paginaDe(caminho);
  let real: string | undefined = caminho;
  while (atual) {
    const modelo = atual.caminho.split("/");
    const partes = (real ?? atual.caminho).split("/");
    const titulo = atual.titulo.startsWith(":") ? partes[modelo.indexOf(atual.titulo)] ?? atual.titulo : atual.titulo;
    passos.unshift({ ...atual, titulo, caminho: real ?? atual.caminho });
    real = atual.pai;
    atual = atual.pai ? paginaDe(atual.pai) : undefined;
  }
  return passos;
}

// A raiz da seção da tela: Início ou Visão geral.
export function raizDe(caminho: string): string | undefined {
  return trilha(caminho)[0]?.caminho;
}

// Volta para a tela anterior desta aba; sem uma anterior (link aberto direto), sobe um nível.
export function voltar(caminho: string): void {
  if (temAnterior()) {
    window.history.back();
    return;
  }
  const pai = paginaDe(caminho)?.pai;
  navegar(pai ?? INICIO);
}

export function Trilha({ caminho }: { caminho: string }) {
  const passos = trilha(caminho);
  if (passos.length === 0) return null;
  const itens = passos.map((passo, indice) => ({
    key: passo.caminho,
    title:
      indice === passos.length - 1 ? (
        <span aria-current="page">{passo.titulo}</span>
      ) : (
        <Link para={passo.caminho}>{passo.titulo}</Link>
      ),
  }));
  const naRaiz = passos.length === 1;
  return (
    <Flex align="center" gap="middle" className="trilha" wrap>
      {!naRaiz && (
        <Button className="botao-voltar" icon={<IconeVoltar />} onClick={() => voltar(caminho)}>
          Voltar
        </Button>
      )}
      <Breadcrumb items={itens} />
    </Flex>
  );
}
