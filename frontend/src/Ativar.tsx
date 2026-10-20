import { Button, Result, Spin } from "antd";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { navegar } from "./rotas";

// O token vem depois do "#", que o navegador não manda ao servidor. Depois de lido,
// sai da barra de endereço para não ficar no histórico.
function lerToken(): string {
  const token = window.location.hash.slice(1);
  window.history.replaceState(null, "", window.location.pathname);
  return token;
}

export function Ativar() {
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    chamar<{ mensagem: string }>("/api/ativar", { metodo: "POST", corpo: { token: lerToken() } })
      .then(({ mensagem }) => setResultado({ ok: true, texto: mensagem }))
      .catch((falha) => setResultado({ ok: false, texto: mensagemDeErro(falha) }));
  }, []);

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
