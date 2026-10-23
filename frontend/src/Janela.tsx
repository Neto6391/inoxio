import { Button, Flex, Typography } from "antd";
import { type ReactNode, useEffect, useRef } from "react";

type Props = { titulo: string; aoFechar: () => void; children: ReactNode };

// Janela própria em vez do Modal do antd: para travar a rolagem ele injeta um
// <style> sem nonce, e a CSP bloqueia. Aqui a trava é uma classe no <body>.
export function Janela({ titulo, aoFechar, children }: Props) {
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
        className="janela janela-larga"
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
          <Button onClick={aoFechar}>Fechar</Button>
        </Flex>
        <div className="janela-corpo">{children}</div>
      </div>
    </div>
  );
}
