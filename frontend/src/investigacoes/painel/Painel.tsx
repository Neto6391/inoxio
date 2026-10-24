import { Card, Flex, Typography } from "antd";
import { Link } from "../../app/rotas";
import type { Creditos } from "../../compartilhado/tipos";
import { ListaInvestigacoes } from "../Investigacoes";
import { MinhasEstatisticas } from "./Estatisticas";
import { Investigar } from "./Investigar";

function saudacao(agora = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(agora),
  );
  if (hora < 12) return "Bom dia";
  return hora < 18 ? "Boa tarde" : "Boa noite";
}

export function Painel({ creditos, nome }: { creditos: Creditos | null; nome: string }) {
  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>
          {saudacao()}, {nome}!
        </Typography.Title>
        <Typography.Text type="secondary">
          Boas-vindas ao Inóxio. Aqui estão as suas investigações e o que elas encontraram; o
          veredito sai de regras fixas sobre o VirusTotal e o AbuseIPDB.
        </Typography.Text>
      </div>
      <Investigar creditos={creditos} />
      <MinhasEstatisticas creditos={creditos} />
      <Card title="Investigações recentes" extra={<Link para="/investigacoes">Ver todas</Link>}>
        <ListaInvestigacoes limite={5} />
      </Card>
    </Flex>
  );
}
