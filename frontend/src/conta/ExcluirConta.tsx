import { Alert, Button, Card, Flex, Input, Popconfirm, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";

// A exclusão pede a senha de novo: uma sessão esquecida aberta não basta.
export function ExcluirConta({ aoExcluir }: { aoExcluir: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    setErro(null);
    try {
      await chamar("/api/conta/excluir", { metodo: "POST", corpo: { senha } });
      aoExcluir();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Card title="Excluir minha conta" className="cartao-perigo">
      <Typography.Paragraph>
        Apaga a conta, as investigações e as sessões abertas. Os registros de segurança ficam
        pelo prazo da Política de Privacidade, sem o seu nome. As cópias de segurança do banco
        vencem em até 14 dias. Não dá para desfazer.
      </Typography.Paragraph>
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Flex gap="small" wrap>
        <Input.Password
          placeholder="Sua senha, para confirmar"
          autoComplete="current-password"
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          className="campo-senha"
        />
        <Popconfirm
          title="Excluir a sua conta?"
          description="Não dá para desfazer."
          okText="Excluir"
          okButtonProps={{ danger: true }}
          cancelText="Cancelar"
          onConfirm={excluir}
          disabled={!senha}
        >
          <Button danger disabled={!senha} loading={excluindo}>
            Excluir minha conta
          </Button>
        </Popconfirm>
      </Flex>
    </Card>
  );
}
