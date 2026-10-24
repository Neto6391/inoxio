import { Flex, Tag, Timeline, Typography } from "antd";
import { quando } from "../../compartilhado/formato";
import { type EventoDaSessao, nomeDoEvento, type SessaoAuditada } from "./eventos";

export function hora(iso: string): string {
  return quando(iso).slice(11);
}

export function fimDaSessao(sessao: SessaoAuditada): string {
  if (sessao.aberta) return sessao.expira_em ? `aberta, vence às ${hora(sessao.expira_em)}` : "aberta";
  if (sessao.fim === null) return "fim não registrado";
  return `${sessao.motivo_fim} às ${hora(sessao.fim)}`;
}

function ItemDaLinha({ evento }: { evento: EventoDaSessao }) {
  const nome = nomeDoEvento(evento.tipo);
  return (
    <Flex vertical gap={2}>
      <Flex gap="small" align="center" wrap>
        <Typography.Text type="secondary">{hora(evento.quando)}</Typography.Text>
        <Tag color={nome.cor}>{nome.texto}</Tag>
        <span className="indicador evento-ip">{evento.ip}</span>
      </Flex>
      {evento.detalhe && <span className="indicador evento-detalhe">{evento.detalhe}</span>}
    </Flex>
  );
}

export function LinhaDoTempo({ sessao }: { sessao: SessaoAuditada }) {
  const itens = sessao.eventos.map((evento, indice) => ({
    key: `${evento.quando}-${indice}`,
    content: <ItemDaLinha evento={evento} />,
  }));
  if (!sessao.inicio_registrado) {
    itens.unshift({ key: "inicio", content: <Typography.Text type="secondary">Começo fora da trilha</Typography.Text> });
  }
  if (sessao.aberta) {
    itens.push({ key: "aberta", content: <Typography.Text>{fimDaSessao(sessao)}</Typography.Text> });
  } else if (sessao.fim === null) {
    itens.push({ key: "fim", content: <Typography.Text type="secondary">Fim não registrado</Typography.Text> });
  } else if (!sessao.eventos.some((evento) => ["logout", "sessao_encerrada"].includes(evento.tipo))) {
    // Venceu sem o navegador voltar: o fim é calculado, não veio de um evento.
    itens.push({ key: "fim", content: <Typography.Text>{fimDaSessao(sessao)}</Typography.Text> });
  }
  return <Timeline className="linha-do-tempo" items={itens} />;
}
