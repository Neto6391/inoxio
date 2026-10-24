import { useEffect, useState } from "react";
import { chamar, ErroApi, guardarCsrf, SESSAO_EXPIRADA, SESSAO_TROCADA } from "../compartilhado/api";
import type { RespostaSessao, Sessao, Usuario } from "../compartilhado/tipos";
import { INICIO } from "./navegacao";
import { navegar, substituir } from "./rotas";

// Quem está logado nesta aba: pergunta ao servidor ao abrir e de novo quando outra aba
// troca a sessão; esquece quando ela vence.
export function useSessao() {
  // undefined: ainda perguntando ao servidor; null: sem sessão.
  const [sessao, setSessao] = useState<Sessao | null | undefined>(undefined);

  function entrarCom(nova: Sessao) {
    guardarCsrf(nova.csrf);
    setSessao(nova);
    // Quem entrou pela tela de login vai para o Início, e o endereço acompanha.
    if (["/entrar", "/cadastro"].includes(window.location.pathname)) substituir(INICIO);
  }

  useEffect(() => {
    function perguntarAoServidor() {
      chamar<RespostaSessao>("/api/sessao")
        .then(({ usuario, csrf }) =>
          usuario && csrf ? entrarCom({ usuario, csrf }) : setSessao(null),
        )
        .catch(() => setSessao(null));
    }
    const expirou = () => setSessao(null);
    perguntarAoServidor();
    window.addEventListener(SESSAO_EXPIRADA, expirou);
    window.addEventListener(SESSAO_TROCADA, perguntarAoServidor);
    return () => {
      window.removeEventListener(SESSAO_EXPIRADA, expirou);
      window.removeEventListener(SESSAO_TROCADA, perguntarAoServidor);
    };
  }, []);

  // Sem sessão, de volta à página pública.
  function encerrar() {
    setSessao(null);
    navegar("/");
  }

  async function sair() {
    try {
      await chamar("/api/logout", { metodo: "POST" });
    } catch (falha) {
      // Token velho porque outra aba entrou de novo: sai da sessão que está valendo.
      if (falha instanceof ErroApi && falha.status === 403) {
        const atual = await chamar<RespostaSessao>("/api/sessao").catch(() => null);
        if (atual?.csrf) {
          guardarCsrf(atual.csrf);
          await chamar("/api/logout", { metodo: "POST" }).catch(() => undefined);
        }
      }
    }
    encerrar();
  }

  function atualizarUsuario(mudanca: Partial<Usuario>) {
    setSessao((atual) => atual && { ...atual, usuario: { ...atual.usuario, ...mudanca } });
  }

  return { sessao, entrarCom, sair, encerrar, atualizarUsuario };
}
