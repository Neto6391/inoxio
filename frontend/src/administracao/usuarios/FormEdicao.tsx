import { Alert, App, Button, Flex, Form, Input, InputNumber, Popconfirm, Segmented, Typography } from "antd";
import { useState } from "react";
import { chamar, mensagemDeErro } from "../../compartilhado/api";
import type { Papel, UsuarioListado } from "../../compartilhado/tipos";
import { confirmaSenha, OPCOES_PAPEL } from "./campos";

type Edicao = { papel: Papel; senha?: string; confirmacao?: string; cota?: number | null };
type Mudanca = { papel?: Papel; senha?: string; cota_diaria?: number | null };
type Acao = { zerar_uso?: true; encerrar_sessoes?: true };
type PropsEdicao = { alvo: UsuarioListado; eu: string; aoTerminar: (salvou: boolean) => void };

// Só vai o que mudou: senha em branco mantém a atual.
function oQueMudou(alvo: UsuarioListado, { papel, senha, cota }: Edicao): Mudanca {
  const corpo: Mudanca = {};
  if (papel !== alvo.papel) corpo.papel = papel;
  if (senha) corpo.senha = senha;
  // Campo apagado tira a cota: o servidor entende null como "sem cota".
  const novaCota = cota ?? null;
  if (papel !== "admin" && novaCota !== alvo.cota_diaria) corpo.cota_diaria = novaCota;
  return corpo;
}

function AcoesRapidas({ alvo, proprio, aoAgir }: { alvo: UsuarioListado; proprio: boolean; aoAgir: (corpo: Acao, feito: string) => void }) {
  return (
    <Flex gap="small" wrap className="espaco">
      {alvo.cota_diaria !== null && (
        <Popconfirm
          title={`Zerar o uso de hoje de ${alvo.nome}?`}
          description="Os créditos de hoje voltam inteiros; a cota continua a mesma."
          okText="Zerar"
          cancelText="Cancelar"
          onConfirm={() => aoAgir({ zerar_uso: true }, `Uso de hoje de ${alvo.nome} zerado.`)}
        >
          <Button size="small">Zerar uso de hoje</Button>
        </Popconfirm>
      )}
      <Popconfirm
        title={proprio ? "Encerrar as suas outras sessões?" : `Encerrar as sessões de ${alvo.nome}?`}
        description={
          proprio
            ? "Os outros navegadores saem; este continua."
            : "Ele sai de todos os navegadores na hora, mas a conta continua ativa."
        }
        okText="Encerrar"
        cancelText="Cancelar"
        onConfirm={() => aoAgir({ encerrar_sessoes: true }, `Sessões de ${alvo.nome} encerradas.`)}
      >
        <Button size="small" danger>
          {proprio ? "Encerrar as outras sessões" : "Encerrar sessões"}
        </Button>
      </Popconfirm>
    </Flex>
  );
}

export function FormEdicao({ alvo, eu, aoTerminar }: PropsEdicao) {
  const proprio = alvo.nome === eu;
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formulario] = Form.useForm<Edicao>();
  // O admin não tem cota: escolher Admin esconde o campo.
  const papelEscolhido = Form.useWatch("papel", formulario) ?? alvo.papel;
  const { message } = App.useApp();
  const caminho = `/api/usuarios/${encodeURIComponent(alvo.nome)}`;

  async function salvar(valores: Edicao) {
    const corpo = oQueMudou(alvo, valores);
    if (Object.keys(corpo).length === 0) {
      aoTerminar(false);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await chamar(caminho, { metodo: "PATCH", corpo });
      message.success(`Usuário ${alvo.nome} atualizado.`);
      aoTerminar(true);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  async function agir(corpo: Acao, feito: string) {
    setErro(null);
    try {
      await chamar(caminho, { metodo: "PATCH", corpo });
      message.success(feito);
      aoTerminar(true);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    }
  }

  return (
    <>
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <AcoesRapidas alvo={alvo} proprio={proprio} aoAgir={agir} />
      <Form<Edicao>
        form={formulario}
        layout="vertical"
        requiredMark={false}
        initialValues={{ papel: alvo.papel, cota: alvo.cota_diaria }}
        onFinish={salvar}
      >
        <Form.Item
          label="Papel"
          name="papel"
          extra={proprio ? "O próprio papel só outro admin muda." : undefined}
        >
          <Segmented<Papel> options={OPCOES_PAPEL} disabled={proprio} />
        </Form.Item>
        {papelEscolhido === "admin" ? (
          <Typography.Paragraph type="secondary">O admin não tem cota diária.</Typography.Paragraph>
        ) : (
          <Form.Item
            label="Cota diária"
            name="cota"
            extra="Apague o número para tirar a cota. Sem cota, vale só o limite por hora."
          >
            <InputNumber min={1} max={10000} placeholder="sem cota" />
          </Form.Item>
        )}
        <Form.Item
          label="Nova senha"
          name="senha"
          extra={
            proprio
              ? "Deixe em branco para manter a atual. Você continua nesta sessão; as outras caem."
              : "Deixe em branco para manter a atual. Trocar a senha encerra as sessões abertas dele."
          }
          rules={[{ min: 12, message: "Pelo menos 12 caracteres" }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="Repita a nova senha" name="confirmacao" dependencies={["senha"]} rules={confirmaSenha(false)}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Flex gap="small">
          <Button type="primary" htmlType="submit" loading={enviando}>
            Salvar
          </Button>
          <Button onClick={() => aoTerminar(false)}>Cancelar</Button>
        </Flex>
      </Form>
    </>
  );
}
