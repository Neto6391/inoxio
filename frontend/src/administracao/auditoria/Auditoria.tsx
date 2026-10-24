import { Flex, Typography } from "antd";
import { AuditoriaPorUsuario } from "./AuditoriaPorUsuario";

export function Auditoria() {
  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Auditoria</Typography.Title>
        <Typography.Text type="secondary">
          Quem entrou, quem errou a senha, o que foi investigado e o que o admin mudou, por
          usuário. Os eventos ficam guardados por 90 dias.
        </Typography.Text>
      </div>
      <AuditoriaPorUsuario />
    </Flex>
  );
}
