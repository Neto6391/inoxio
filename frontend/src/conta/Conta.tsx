import { Alert, Button, Card, Col, Descriptions, Flex, Row, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";
import { dataPorExtenso, quando } from "../compartilhado/formato";
import { Janela } from "../compartilhado/Janela";
import { ExcluirConta } from "./ExcluirConta";
import { CartaoPerfil, type Perfil } from "./Perfil";
import { TrocarEmail } from "./TrocarEmail";
import { TrocarSenha } from "./TrocarSenha";

function CartaoEmail({ perfil, aoTrocar }: { perfil: Perfil; aoTrocar: () => void }) {
  return (
    <Card title="E-mail">
      <Flex justify="space-between" align="center" gap="middle" wrap>
        <div>
          <Typography.Text strong>{perfil.email ?? "Nenhum e-mail cadastrado"}</Typography.Text>
          <div>
            <Typography.Text type="secondary" className="nota-campo">
              {perfil.email_confirmado_em
                ? `Confirmado em ${quando(perfil.email_confirmado_em)}. Serve para recuperar a senha.`
                : "Serve para recuperar a senha."}
            </Typography.Text>
          </div>
        </div>
        <Button onClick={aoTrocar}>{perfil.email ? "Trocar o e-mail" : "Informar um e-mail"}</Button>
      </Flex>
      {perfil.email_pendente && (
        <Alert
          type="info"
          showIcon
          className="espaco-topo"
          title={`Esperando a confirmação de ${perfil.email_pendente}: abra o link que mandamos para ele.`}
        />
      )}
    </Card>
  );
}

function CartaoSenha({ aoTrocar }: { aoTrocar: () => void }) {
  return (
    <Card title="Senha">
      <Flex justify="space-between" align="center" gap="middle" wrap>
        <Typography.Text type="secondary">
          Pedimos a senha atual. Você continua nesta sessão; as dos outros navegadores caem.
        </Typography.Text>
        <Button onClick={aoTrocar}>Trocar a senha</Button>
      </Flex>
    </Card>
  );
}

function SeusDados({ perfil }: { perfil: Perfil }) {
  const itens = [
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
    <Card title="Seus dados">
      <Descriptions column={1} size="small" items={itens} />
      <Flex justify="space-between" align="center" gap="middle" wrap className="espaco-topo">
        <Typography.Text type="secondary">
          Um arquivo JSON com a sua conta, as suas investigações e os seus registros de segurança.
        </Typography.Text>
        <Button href="/api/conta/dados" download>
          Baixar meus dados
        </Button>
      </Flex>
    </Card>
  );
}

type PropsConta = { aoExcluir: () => void; aoMudarNome: (nome: string | null) => void };

export function Conta({ aoExcluir, aoMudarNome }: PropsConta) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [janela, setJanela] = useState<"email" | "senha" | null>(null);

  useEffect(() => {
    chamar<Perfil>("/api/conta")
      .then(setPerfil)
      .catch((falha) => setErro(mensagemDeErro(falha)));
  }, []);

  if (erro) return <Alert type="error" showIcon title={erro} />;
  if (!perfil) return <Skeleton active />;

  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Minha conta</Typography.Title>
        <Typography.Text type="secondary">
          Os seus dados e os seus direitos pela LGPD: ver, corrigir, levar e excluir.
        </Typography.Text>
      </div>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={9}>
          <CartaoPerfil
            perfil={perfil}
            aoSalvar={(novo) => {
              setPerfil({ ...perfil, ...novo });
              aoMudarNome(novo.nome_exibicao);
            }}
          />
        </Col>
        <Col xs={24} lg={15}>
          <Flex vertical gap="large">
            <CartaoEmail perfil={perfil} aoTrocar={() => setJanela("email")} />
            <CartaoSenha aoTrocar={() => setJanela("senha")} />
            <SeusDados perfil={perfil} />
            <ExcluirConta aoExcluir={aoExcluir} />
          </Flex>
        </Col>
      </Row>
      {janela === "email" && (
        <Janela titulo={perfil.email ? "Trocar o e-mail" : "Informar um e-mail"} larga={false} aoFechar={() => setJanela(null)}>
          <TrocarEmail
            aoPedir={(email) => setPerfil({ ...perfil, email_pendente: email })}
            aoTerminar={() => setJanela(null)}
          />
        </Janela>
      )}
      {janela === "senha" && (
        <Janela titulo="Trocar a senha" larga={false} aoFechar={() => setJanela(null)}>
          <TrocarSenha aoTerminar={() => setJanela(null)} />
        </Janela>
      )}
    </Flex>
  );
}
