import { Card, Tag, Typography } from "antd";
import { useState } from "react";
import { comoTexto, corDaNota } from "../../compartilhado/formato";
import { Paginacao } from "../../compartilhado/Paginacao";
import type { Evidencia, IpDoDominio } from "../../compartilhado/tipos";
import { statusDe } from "./Fonte";

const IPS_POR_PAGINA = 5;

function LinhaDoIp({ item }: { item: IpDoDominio }) {
  return (
    <div className="linha-ip">
      <span className="indicador">{item.ip}</span>
      {item.abuseipdb === "ok" ? (
        <>
          <span>
            <Tag color={corDaNota(item.score ?? 0)}>{item.score} de 100</Tag>
          </span>
          <span>{comoTexto(item.relatos)}</span>
          <span>
            {comoTexto(item.isp)} · {comoTexto(item.pais)}
          </span>
        </>
      ) : item.abuseipdb === "nao_consultado" ? (
        <Typography.Text type="secondary">não consultado no AbuseIPDB</Typography.Text>
      ) : (
        <Typography.Text type="secondary">AbuseIPDB indisponível</Typography.Text>
      )}
    </div>
  );
}

export function IpsDoDominio({ evidencia }: { evidencia: Evidencia }) {
  const status = statusDe(evidencia);
  const consultados = (evidencia.dados.ips as IpDoDominio[] | undefined) ?? [];
  // Os IPs além dos consultados vêm só listados: o AbuseIPDB não foi perguntado sobre eles.
  const outros = (evidencia.dados.outros_ips as string[] | undefined) ?? [];
  const ips: IpDoDominio[] = [...consultados, ...outros.map((ip) => ({ ip, abuseipdb: "nao_consultado" }))];
  const [numero, setNumero] = useState(1);
  const pagina = {
    total: ips.length,
    pagina: numero,
    por_pagina: IPS_POR_PAGINA,
    itens: ips.slice((numero - 1) * IPS_POR_PAGINA, numero * IPS_POR_PAGINA),
  };
  return (
    <Card size="small" title="IPs do site (DNS)" extra={<Tag color={status.cor}>{status.texto}</Tag>}>
      {ips.length === 0 ? (
        <Typography.Text type="secondary">
          {evidencia.status === "falha"
            ? "O DNS não respondeu a tempo."
            : "O domínio não aponta para nenhum IP público."}
        </Typography.Text>
      ) : (
        <div className="tabela-rolagem">
          <div className="tabela-ips">
            <div className="linha-ip cabecalho">
              <span>IP</span>
              <span>Nota no AbuseIPDB</span>
              <span>Relatos</span>
              <span>Quem opera</span>
            </div>
            {pagina.itens.map((item) => (
              <LinhaDoIp key={item.ip} item={item} />
            ))}
          </div>
          {outros.length > 0 && (
            <Typography.Paragraph type="secondary" className="espaco-topo">
              O AbuseIPDB é consultado só para os {consultados.length} primeiros IPs, para poupar a
              cota de consultas; os outros {outros.length} aparecem aqui para você saber que existem.
            </Typography.Paragraph>
          )}
          <Paginacao pagina={pagina} aoMudar={setNumero} rotulo={["IP", "IPs"]} />
        </div>
      )}
    </Card>
  );
}
