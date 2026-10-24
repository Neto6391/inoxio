import { Card, Flex, Typography } from "antd";
import type { Evidencia, IpDoDominio } from "../../compartilhado/tipos";
import { provedoresDe } from "./provedores";

// O ISP vem do AbuseIPDB: dos IPs do site (contexto) e, numa investigação de IP, da própria fonte.
function ispsDe(evidencias: Evidencia[]): string[] {
  return evidencias.flatMap((evidencia) => {
    const dados = evidencia.dados ?? {};
    const ips = (dados.ips as IpDoDominio[] | undefined) ?? [];
    return [...ips.map((ip) => ip.isp ?? ""), typeof dados.isp === "string" ? dados.isp : ""];
  });
}

export function QuemOpera({ evidencias }: { evidencias: Evidencia[] }) {
  const provedores = provedoresDe(ispsDe(evidencias));
  if (provedores.length === 0) return null;
  return (
    <Card title="Quem opera estes IPs" size="small">
      <Flex vertical gap="middle">
        {provedores.map((provedor) => (
          <div key={provedor.nome}>
            <Typography.Text strong>{provedor.nome}</Typography.Text>
            <Typography.Paragraph type="secondary" className="sem-margem">
              {provedor.texto}
            </Typography.Paragraph>
          </div>
        ))}
      </Flex>
    </Card>
  );
}
