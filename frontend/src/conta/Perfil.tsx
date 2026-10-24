import { Alert, App, Button, Card, Flex, Input, Tag, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../compartilhado/api";

export type Perfil = {
  nome: string;
  nome_exibicao: string | null;
  email: string | null;
  // E-mail novo que espera o clique no link.
  email_pendente?: string | null;
  papel: string;
  criado_em: string | null;
  email_confirmado_em: string | null;
  cota_diaria: number | null;
  termos_versao: string | null;
  termos_aceitos_em: string | null;
};

function iniciais(texto: string): string {
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : texto.slice(0, 2);
  return letras.toUpperCase();
}

function NomeDeExibicao({ perfil, aoSalvar }: { perfil: Perfil; aoSalvar: (novo: Perfil) => void }) {
  const [nome, setNome] = useState(perfil.nome_exibicao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { message } = App.useApp();

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const novo = await chamar<Perfil>("/api/conta", { metodo: "PATCH", corpo: { nome_exibicao: nome } });
      aoSalvar(novo);
      message.success("Nome salvo.");
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Flex vertical gap={8}>
      <label htmlFor="nome-exibicao" className="rotulo-campo">
        Nome de exibição
      </label>
      <Input
        id="nome-exibicao"
        placeholder={perfil.nome}
        maxLength={80}
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
      />
      <Typography.Text type="secondary" className="nota-campo">
        Como você quer ser chamado no Inóxio. Para entrar, continua valendo o usuário {perfil.nome}.
      </Typography.Text>
      {erro && <Alert type="error" showIcon title={erro} />}
      <Button
        type="primary"
        onClick={salvar}
        loading={salvando}
        disabled={nome.trim() === (perfil.nome_exibicao ?? "")}
        className="botao-salvar"
      >
        Salvar nome
      </Button>
    </Flex>
  );
}

// O cartão da esquerda: quem é a pessoa, e o nome com que ela quer ser chamada.
export function CartaoPerfil({ perfil, aoSalvar }: { perfil: Perfil; aoSalvar: (novo: Perfil) => void }) {
  const nomeNaTela = perfil.nome_exibicao ?? perfil.nome;
  return (
    <Card className="cartao-perfil">
      <Flex vertical gap="large">
        <Flex align="center" gap="middle">
          <span className="avatar" aria-hidden="true">
            {iniciais(nomeNaTela)}
          </span>
          <div className="perfil-identidade">
            <Typography.Title level={4} className="sem-margem">
              {nomeNaTela}
            </Typography.Title>
            <Typography.Text type="secondary">Usuário para entrar: {perfil.nome}</Typography.Text>
            <div>
              <Tag color={perfil.papel === "admin" ? "gold" : "default"}>{perfil.papel}</Tag>
              <Typography.Text type="secondary" className="nota-campo">
                o papel só o admin muda
              </Typography.Text>
            </div>
          </div>
        </Flex>
        <NomeDeExibicao perfil={perfil} aoSalvar={aoSalvar} />
      </Flex>
    </Card>
  );
}
