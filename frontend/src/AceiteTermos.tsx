import { Alert, Button, Checkbox, Flex, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { Link } from "./rotas";

type Props = { aberto: boolean; aoAceitar: () => void; aoSair: () => void };

// Para quem já tinha conta antes dos Termos (ou de uma versão nova deles): sem aceite,
// não segue. Janela própria pelo mesmo motivo da apresentação: o Modal do antd
// injeta estilo sem nonce.
export function AceiteTermos({ aberto, aoAceitar, aoSair }: Props) {
  const [marcado, setMarcado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const janela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    document.body.classList.add("sem-rolagem");
    janela.current?.focus();
    return () => document.body.classList.remove("sem-rolagem");
  }, [aberto]);

  async function aceitar() {
    setEnviando(true);
    setErro(null);
    try {
      await chamar("/api/sessao/termos", { metodo: "POST" });
      aoAceitar();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) return null;
  return (
    <div className="janela-fundo">
      <div ref={janela} className="janela" role="dialog" aria-modal="true" aria-labelledby="termos-titulo" tabIndex={-1}>
        <Typography.Title level={4} id="termos-titulo">
          Termos de Uso e Política de Privacidade
        </Typography.Title>
        <Typography.Paragraph>
          Para continuar usando o Inóxio, leia e aceite os{" "}
          <Link para="/termos">Termos de Uso</Link> e a{" "}
          <Link para="/privacidade">Política de Privacidade</Link>. Eles explicam o que o sistema
          faz com os seus dados e os seus direitos pela LGPD.
        </Typography.Paragraph>
        {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
        <Checkbox checked={marcado} onChange={(evento) => setMarcado(evento.target.checked)}>
          Li e aceito os Termos de Uso e a Política de Privacidade
        </Checkbox>
        <Flex justify="space-between" className="espaco-topo">
          <Button type="text" onClick={aoSair}>
            Sair
          </Button>
          <Button type="primary" disabled={!marcado} loading={enviando} onClick={aceitar}>
            Aceitar e continuar
          </Button>
        </Flex>
      </div>
    </div>
  );
}
