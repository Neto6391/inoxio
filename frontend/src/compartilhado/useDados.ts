import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";

// Lê uma rota da API ao abrir a tela: os dados, ou a mensagem de erro.
export function useDados<T>(caminho: string) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    chamar<T>(caminho)
      .then(setDados)
      .catch((falha) => setErro(mensagemDeErro(falha)));
  }, [caminho]);
  return { dados, erro };
}
