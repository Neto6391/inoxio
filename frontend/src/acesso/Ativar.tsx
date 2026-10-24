import { Button, Result, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";
import { navegar } from "../app/rotas";

type Textos = { api: string; ok: string; falha: string; botaoOk: string; botaoFalha: string; destino: string };

const ATIVACAO: Textos = {
  api: "/api/ativar",
  ok: "Conta ativada",
  falha: "Não foi possível ativar",
  botaoOk: "Entrar",
  botaoFalha: "Voltar ao cadastro",
  destino: "/entrar",
};

const TROCA_DE_EMAIL: Textos = {
  api: "/api/conta/email/confirmar",
  ok: "E-mail trocado",
  falha: "Não foi possível trocar o e-mail",
  botaoOk: "Ir para Minha conta",
  botaoFalha: "Ir para Minha conta",
  destino: "/conta",
};

export function Ativar() {
  return <LinkDeUsoUnico textos={ATIVACAO} />;
}

export function ConfirmarEmail() {
  return <LinkDeUsoUnico textos={TROCA_DE_EMAIL} />;
}

// O link do e-mail, de uso único: a ativação da conta e a confirmação de um e-mail novo.
function LinkDeUsoUnico({ textos }: { textos: Textos }) {
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
    chamar<{ mensagem: string }>(textos.api, { metodo: "POST", corpo: { token } })
      .then(({ mensagem }) => setResultado({ ok: true, texto: mensagem }))
      .catch((falha) => setResultado({ ok: false, texto: mensagemDeErro(falha) }));
  }, [token, textos.api]);

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
        title={resultado.ok ? textos.ok : textos.falha}
        subTitle={resultado.texto}
        extra={
          <Button type="primary" onClick={() => navegar(textos.destino)}>
            {resultado.ok ? textos.botaoOk : textos.botaoFalha}
          </Button>
        }
      />
    </div>
  );
}
