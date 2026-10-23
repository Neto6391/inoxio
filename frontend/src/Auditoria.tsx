import { Flex, Typography } from "antd";
import { AuditoriaPorUsuario } from "./AuditoriaPorUsuario";

// O nome de cada tipo de evento; um teste do servidor confere que todo tipo registrado
// (TIPOS_EVENTO) tem nome aqui.
export const NOMES_EVENTO: Record<string, { texto: string; cor: string }> = {
  login: { texto: "entrou", cor: "green" },
  login_falhou: { texto: "senha errada", cor: "orange" },
  login_bloqueado: { texto: "login bloqueado", cor: "red" },
  logout: { texto: "saiu", cor: "default" },
  cadastro: { texto: "cadastro", cor: "blue" },
  ativacao: { texto: "ativação", cor: "blue" },
  investigacao: { texto: "investigação", cor: "purple" },
  investigacao_alheia: { texto: "abriu investigação de outro", cor: "gold" },
  admin_cadastrou: { texto: "admin cadastrou", cor: "gold" },
  admin_alterou: { texto: "admin alterou", cor: "gold" },
  backup: { texto: "backup", cor: "cyan" },
  termos_aceitos: { texto: "aceitou os termos", cor: "blue" },
  conta_excluida: { texto: "conta excluída", cor: "red" },
  senha_pedida: { texto: "pediu senha nova", cor: "default" },
  senha_redefinida: { texto: "trocou a senha", cor: "default" },
  explicacao_pedida: { texto: "pediu a explicação de novo", cor: "purple" },
  sessao_encerrada: { texto: "sessão encerrada", cor: "default" },
  conta_alterada: { texto: "mudou a própria conta", cor: "blue" },
  email_troca_pedida: { texto: "pediu troca de e-mail", cor: "default" },
  email_trocado: { texto: "trocou o e-mail", cor: "blue" },
};

export function nomeDoEvento(tipo: string) {
  return NOMES_EVENTO[tipo] ?? { texto: tipo, cor: "default" };
}

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
