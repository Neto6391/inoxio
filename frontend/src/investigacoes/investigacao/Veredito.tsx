import { Card, Flex, Progress, Typography } from "antd";
import type { CSSProperties } from "react";
import { CORES_VEREDITO, corDaNota } from "../../compartilhado/formato";
import type { DetalheInvestigacao } from "../../compartilhado/tipos";

// Sem todas as fontes, ou sem nenhuma que conheça o indicador, a nota das que
// responderam não mede o risco: mostrar 0 sugeriria que o indicador é inofensivo.
const SEM_NOTA: Record<string, string> = {
  inconclusivo: "Uma das fontes falhou. Sem ela, não há nota: investigue de novo mais tarde.",
  desconhecido: "Nenhuma fonte conhece o indicador, então não há nota.",
};

// A cor vem de CORES_VEREDITO por uma variável CSS: o React a aplica pelo DOM, o
// que a CSP permite, e a cor fica definida num lugar só.
function corDoVeredito(veredito: string): CSSProperties {
  return { "--cor-veredito": CORES_VEREDITO[veredito] ?? "#64748b" } as CSSProperties;
}

export function Veredito({ detalhe }: { detalhe: DetalheInvestigacao }) {
  const nota = detalhe.veredito in SEM_NOTA ? null : detalhe.nota;
  return (
    <Card className="veredito" style={corDoVeredito(detalhe.veredito)}>
      <Flex gap="large" align="center" wrap>
        <Progress
          type="dashboard"
          size={112}
          // Sem isso, 100% vira status "success" e a nota aparece verde.
          status="normal"
          percent={nota ?? 0}
          strokeColor={nota === null ? "#3b4a5a" : corDaNota(nota)}
          format={() => (nota === null ? "—" : nota)}
        />
        <Flex vertical gap={4}>
          <Typography.Text type="secondary">Veredito</Typography.Text>
          <span className="rotulo-veredito">{detalhe.rotulo}</span>
          <Typography.Text type="secondary">
            {SEM_NOTA[detalhe.veredito] ??
              "Nota de risco de 0 a 100, calculada por regra fixa. A partir de 25 é suspeito; a partir de 75, malicioso."}
          </Typography.Text>
        </Flex>
      </Flex>
    </Card>
  );
}
