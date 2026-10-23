import { Button, Result, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { navegar } from "./rotas";

export function Ativar() {
  // O token vem depois do "#", que o navegador não manda ao servidor. Lido sem apagar,
  // porque o StrictMode chama o inicializador duas vezes; a barra é limpa depois.
  const [token, setToken] = useState(() => window.location.hash.slice(1));
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  // O link é de uso único: o mesmo token não vai duas vezes, nem com o efeito repetido.
  const enviado = useRef<string | null>(null);

  useEffect(() => {
    // Colar outro link nesta mesma página só troca o "#", sem recarregar.
    function lerDaBarra() {
      const novo = window.location.hash.slice(1);
      if (!novo) return;
      setToken(novo);
      window.history.replaceState(null, "", window.location.pathname);
    }
    lerDaBarra();
    window.addEventListener("hashchange", lerDaBarra);
    return () => window.removeEventListener("hashchange", lerDaBarra);
  }, []);

  useEffect(() => {
    if (enviado.current === token) return;
    enviado.current = token;
    setResultado(null);
    chamar<{ mensagem: string }>("/api/ativar", { metodo: "POST", corpo: { token } })
      .then(({ mensagem }) => setResultado({ ok: true, texto: mensagem }))
      .catch((falha) => setResultado({ ok: false, texto: mensagemDeErro(falha) }));
  }, [token]);

  if (!resultado) {
    return (
      <div className="login">
        <Spin />
      </div>
    );
  }
  return (
    <div className="login">
      <Result
        status={resultado.ok ? "success" : "warning"}
        title={resultado.ok ? "Conta ativada" : "Não foi possível ativar"}
        subTitle={resultado.texto}
        extra={
          <Button type="primary" onClick={() => navegar("/entrar")}>
            {resultado.ok ? "Entrar" : "Voltar ao cadastro"}
          </Button>
        }
      />
    </div>
  );
}
