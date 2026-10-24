import { Flex, Typography } from "antd";
import { type ReactNode, useEffect, useRef } from "react";
import { IconeFechar } from "./icones";

type Props = { titulo: string; aoFechar: () => void; children: ReactNode; larga?: boolean };

// O X do canto de toda janela. O nome para o leitor de tela diz o que ele faz.
export function BotaoFechar({ aoFechar, rotulo = "Fechar" }: { aoFechar: () => void; rotulo?: string }) {
  return (
    <button type="button" className="botao-fechar" aria-label={rotulo} title={rotulo} onClick={aoFechar}>
      <IconeFechar />
    </button>
  );
}

// Janela própria em vez do Modal do antd: para travar a rolagem ele injeta um
// <style> sem nonce, e a CSP bloqueia. Aqui a trava é uma classe no <body>.
export function Janela({ titulo, aoFechar, children, larga = true }: Props) {
  const janela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add("sem-rolagem");
    janela.current?.focus();
    return () => document.body.classList.remove("sem-rolagem");
  }, []);

  return (
    <div
      className="janela-fundo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div
        ref={janela}
        className={larga ? "janela janela-larga" : "janela"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="janela-larga-titulo"
        tabIndex={-1}
        onKeyDown={(evento) => {
          if (evento.key === "Escape") aoFechar();
        }}
      >
        <Flex justify="space-between" align="center" gap="small" className="espaco">
          <Typography.Title level={4} id="janela-larga-titulo" className="sem-margem">
            {titulo}
          </Typography.Title>
          <BotaoFechar aoFechar={aoFechar} />
        </Flex>
        <div className="janela-corpo">{children}</div>
      </div>
    </div>
  );
}
