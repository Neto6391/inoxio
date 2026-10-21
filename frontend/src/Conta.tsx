import { Alert, Button, Card, Descriptions, Flex, Input, Popconfirm, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { dataPorExtenso, quando } from "./formato";

type Perfil = {
  nome: string;
  email: string | null;
  papel: string;
  criado_em: string | null;
  email_confirmado_em: string | null;
  cota_diaria: number | null;
  termos_versao: string | null;
  termos_aceitos_em: string | null;
};

export function Conta({ aoExcluir }: { aoExcluir: () => void }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    chamar<Perfil>("/api/conta")
      .then(setPerfil)
      .catch((falha) => setErro(mensagemDeErro(falha)));
  }, []);

  async function excluir() {
    setExcluindo(true);
    setErroExclusao(null);
    try {
      await chamar("/api/conta/excluir", { metodo: "POST", corpo: { senha } });
      aoExcluir();
    } catch (falha) {
      setErroExclusao(mensagemDeErro(falha));
    } finally {
      setExcluindo(false);
    }
  }

  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (!perfil) return <Skeleton active />;

  const itens = [
    { key: "nome", label: "Usuário", children: perfil.nome },
    { key: "email", label: "E-mail", children: perfil.email ?? "—" },
    { key: "papel", label: "Papel", children: perfil.papel },
    { key: "criado", label: "Conta criada em", children: perfil.criado_em ? quando(perfil.criado_em) : "—" },
    { key: "cota", label: "Cota diária", children: perfil.cota_diaria ? `${perfil.cota_diaria} investigações` : "sem cota diária" },
    {
      key: "termos",
      label: "Termos aceitos",
      children: perfil.termos_aceitos_em && perfil.termos_versao
        ? `versão de ${dataPorExtenso(perfil.termos_versao)}, em ${quando(perfil.termos_aceitos_em)}`
        : "ainda não",
    },
  ];

  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Minha conta</Typography.Title>
        <Typography.Text type="secondary">
          Os seus dados e os seus direitos pela LGPD: ver, levar e excluir.
        </Typography.Text>
      </div>
      <Card title="Seus dados">
        <Descriptions column={1} size="small" items={itens} />
      </Card>
      <Card title="Baixar meus dados">
        <Typography.Paragraph>
          Um arquivo JSON com a sua conta, as suas investigações e os seus registros de segurança.
        </Typography.Paragraph>
        <Button href="/api/conta/dados" download>
          Baixar meus dados
        </Button>
      </Card>
      <Card title="Excluir minha conta" className="cartao-perigo">
        <Typography.Paragraph>
          Apaga a conta, as investigações e as sessões abertas. Os registros de segurança ficam pelo
          prazo da Política de Privacidade, sem o seu nome. As cópias de segurança do banco vencem
          em até 14 dias. Não dá para desfazer.
        </Typography.Paragraph>
        {erroExclusao && <Alert type="error" showIcon title={erroExclusao} className="espaco" />}
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
    </Flex>
  );
}
