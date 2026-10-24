import { Button, Flex, Steps, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { chamar } from "../compartilhado/api";
import { BotaoFechar } from "../compartilhado/Janela";

const PASSOS = [
  {
    titulo: "Bem-vindo ao Inóxio",
    texto: [
      "O Inóxio diz se um link, um domínio, um IP ou um arquivo é suspeito.",
      "Ele consulta o VirusTotal e o AbuseIPDB, decide o veredito por regras fixas e usa IA só para explicar o resultado.",
    ],
  },
  {
    titulo: "Como investigar",
    texto: [
      "Cole no painel o endereço de uma página, um domínio, um IP ou o hash (MD5, SHA-1 ou SHA-256) de um arquivo.",
      "Também vale o formato desarmado que analistas usam, como hxxps://site[.]com.",
      "O mesmo indicador investigado nas últimas 24 horas volta na hora, sem esperar as fontes.",
    ],
  },
  {
    titulo: "Como ler o resultado",
    texto: [
      "A nota vai de 0 a 100: a partir de 25 é suspeito, a partir de 75 é malicioso.",
      "Inconclusivo quer dizer que uma fonte não respondeu; tente de novo mais tarde.",
      "\"Sem evidência\" não é garantia de que algo é inofensivo: só que as fontes não acharam nada.",
    ],
  },
  {
    titulo: "A IA explica, não decide",
    texto: [
      "A análise da IA resume as evidências, aponta técnicas do MITRE ATT&CK e sugere o que fazer.",
      "Ela nunca muda o veredito. Contas novas têm 10 investigações por dia.",
    ],
  },
];

type Props = { aberto: boolean; aoTerminar: () => void };

// Janela própria em vez do Modal do antd: para travar a rolagem ele injeta um
// <style> sem nonce, e a CSP bloqueia. Aqui a trava é uma classe no <body>.
export function Onboarding({ aberto, aoTerminar }: Props) {
  const [passo, setPasso] = useState(0);
  const janela = useRef<HTMLDivElement>(null);
  const ultimo = passo === PASSOS.length - 1;

  function terminar() {
    // Se a gravação falhar, a apresentação só volta no próximo login: nada se perde.
    chamar("/api/sessao/onboarding", { metodo: "POST" }).catch(() => undefined);
    aoTerminar();
  }

  useEffect(() => {
    if (!aberto) return;
    document.body.classList.add("sem-rolagem");
    janela.current?.focus();
    return () => document.body.classList.remove("sem-rolagem");
  }, [aberto]);

  if (!aberto) return null;
  return (
    <div className="janela-fundo">
      <div
        ref={janela}
        className="janela"
        role="dialog"
        aria-modal="true"
        aria-labelledby="janela-titulo"
        tabIndex={-1}
        onKeyDown={(evento) => {
          if (evento.key === "Escape") terminar();
        }}
      >
        <Flex justify="space-between" align="start" gap="small">
          <Typography.Title level={4} id="janela-titulo">
            {PASSOS[passo].titulo}
          </Typography.Title>
          <BotaoFechar aoFechar={terminar} />
        </Flex>
        <Steps size="small" current={passo} items={PASSOS.map(() => ({}))} className="espaco" />
        {PASSOS[passo].texto.map((paragrafo) => (
          <Typography.Paragraph key={paragrafo}>{paragrafo}</Typography.Paragraph>
        ))}
        <Flex justify="space-between" className="espaco-topo">
          <Button type="text" onClick={terminar}>
            Pular
          </Button>
          <Flex gap="small">
            {passo > 0 && <Button onClick={() => setPasso(passo - 1)}>Voltar</Button>}
            <Button type="primary" onClick={ultimo ? terminar : () => setPasso(passo + 1)}>
              {ultimo ? "Começar" : "Próximo"}
            </Button>
          </Flex>
        </Flex>
      </div>
    </div>
  );
}
