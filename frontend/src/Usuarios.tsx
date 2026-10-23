import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Popconfirm,
  Segmented,
  Skeleton,
  Tag,
  Typography,
} from "antd";
import type { Rule } from "antd/es/form";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { Carregando } from "./Carregando";
import { type Filtros, FiltrosUsuarios, parametros, SEM_FILTRO } from "./FiltrosUsuarios";
import { Janela } from "./Janela";
import { Paginacao, usePagina } from "./Paginacao";
import { quando } from "./formato";
import type { Papel, UsuarioListado } from "./tipos";

type Cadastro = { nome: string; senha: string; confirmacao: string; papel: Papel };
type Edicao = { papel: Papel; senha?: string; confirmacao?: string; cota?: number | null };

const OPCOES_PAPEL = [
  { label: "Analista", value: "analista" as Papel },
  { label: "Admin", value: "admin" as Papel },
];

function confirmaSenha(obrigatoria: boolean): Rule[] {
  return [
    { required: obrigatoria, message: "Repita a senha" },
    ({ getFieldValue }) => ({
      validator: (_, valor) =>
        (valor ?? "") === (getFieldValue("senha") ?? "")
          ? Promise.resolve()
          : Promise.reject(new Error("As senhas não conferem")),
    }),
  ];
}

function FormCadastro({ aoCadastrar }: { aoCadastrar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formulario] = Form.useForm<Cadastro>();
  const { message } = App.useApp();

  async function cadastrar({ nome, senha, papel }: Cadastro) {
    setEnviando(true);
    setErro(null);
    try {
      await chamar("/api/usuarios", { metodo: "POST", corpo: { nome, senha, papel } });
      formulario.resetFields();
      message.success(`Usuário ${nome} cadastrado.`);
      aoCadastrar();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Form<Cadastro>
        form={formulario}
        layout="vertical"
        requiredMark={false}
        initialValues={{ papel: "analista" }}
        onFinish={cadastrar}
      >
        <Form.Item
          label="Nome de usuário"
          name="nome"
          extra="De 3 a 32 caracteres: letras minúsculas, dígitos, ponto, hífen ou sublinhado."
          rules={[
            { required: true, message: "Informe o nome" },
            { pattern: /^[a-z0-9._-]{3,32}$/, message: "Nome fora do formato" },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          label="Senha"
          name="senha"
          rules={[
            { required: true, message: "Informe a senha" },
            { min: 12, message: "Pelo menos 12 caracteres" },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="Repita a senha" name="confirmacao" dependencies={["senha"]} rules={confirmaSenha(true)}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="Papel" name="papel">
          <Segmented<Papel> options={OPCOES_PAPEL} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={enviando}>
          Cadastrar
        </Button>
      </Form>
    </>
  );
}

type PropsEdicao = { alvo: UsuarioListado; eu: string; aoTerminar: (salvou: boolean) => void };

function textoCota(cota: number | null): string {
  return cota === null ? "sem cota diária" : `cota ${cota}/dia`;
}

function FormEdicao({ alvo, eu, aoTerminar }: PropsEdicao) {
  const proprio = alvo.nome === eu;
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formulario] = Form.useForm<Edicao>();
  // O admin não tem cota: escolher Admin esconde o campo.
  const papelEscolhido = Form.useWatch("papel", formulario) ?? alvo.papel;
  const { message } = App.useApp();

  async function salvar({ papel, senha, cota }: Edicao) {
    // Só vai o que mudou: senha em branco mantém a atual.
    const corpo: { papel?: Papel; senha?: string; cota_diaria?: number | null } = {};
    if (papel !== alvo.papel) corpo.papel = papel;
    if (senha) corpo.senha = senha;
    // Campo apagado tira a cota: o servidor entende null como "sem cota".
    const novaCota = cota ?? null;
    if (papel !== "admin" && novaCota !== alvo.cota_diaria) corpo.cota_diaria = novaCota;
    if (Object.keys(corpo).length === 0) {
      aoTerminar(false);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await chamar(`/api/usuarios/${encodeURIComponent(alvo.nome)}`, { metodo: "PATCH", corpo });
      message.success(`Usuário ${alvo.nome} atualizado.`);
      aoTerminar(true);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  async function agir(corpo: { zerar_uso?: true; encerrar_sessoes?: true }, feito: string) {
    setErro(null);
    try {
      await chamar(`/api/usuarios/${encodeURIComponent(alvo.nome)}`, { metodo: "PATCH", corpo });
      message.success(feito);
      aoTerminar(true);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    }
  }

  return (
    <>
      {erro && <Alert type="error" showIcon title={erro} className="espaco" />}
      <Flex gap="small" wrap className="espaco">
        {alvo.cota_diaria !== null && (
          <Popconfirm
            title={`Zerar o uso de hoje de ${alvo.nome}?`}
            description="Os créditos de hoje voltam inteiros; a cota continua a mesma."
            okText="Zerar"
            cancelText="Cancelar"
            onConfirm={() => agir({ zerar_uso: true }, `Uso de hoje de ${alvo.nome} zerado.`)}
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
          onConfirm={() => agir({ encerrar_sessoes: true }, `Sessões de ${alvo.nome} encerradas.`)}
        >
          <Button size="small" danger>
            {proprio ? "Encerrar as outras sessões" : "Encerrar sessões"}
          </Button>
        </Popconfirm>
      </Flex>
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

export function Usuarios({ eu }: { eu: string }) {
  const [numero, setNumero] = useState(1);
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTRO);
  // Sobe para ler a lista de novo depois de uma mudança.
  const [releitura, setReleitura] = useState(0);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [editando, setEditando] = useState<UsuarioListado | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const { message } = App.useApp();
  const {
    pagina,
    erro: erroLista,
    carregando,
  } = usePagina<UsuarioListado>(`/api/usuarios?${parametros(filtros, numero)}`, releitura);

  function carregar() {
    setReleitura((n) => n + 1);
  }

  async function mudarSituacao(usuario: UsuarioListado, ativo: boolean) {
    setErroAcao(null);
    try {
      const caminho = `/api/usuarios/${encodeURIComponent(usuario.nome)}`;
      await chamar(caminho, { metodo: "PATCH", corpo: { ativo } });
      const feito = ativo ? "ativado" : usuario.pendente ? "recusado" : "desativado";
      message.success(`Usuário ${usuario.nome} ${feito}.`);
      carregar();
    } catch (falha) {
      setErroAcao(mensagemDeErro(falha));
    }
  }

  function acoes(usuario: UsuarioListado) {
    const botoes = [
      <Button key="editar" size="small" onClick={() => setEditando(usuario)}>
        Editar
      </Button>,
    ];
    if (usuario.nome === eu) return botoes;
    if (usuario.pendente) {
      botoes.push(
        <Button key="ativar" size="small" onClick={() => mudarSituacao(usuario, true)}>
          Ativar
        </Button>,
        <Popconfirm
          key="recusar"
          title={`Recusar ${usuario.nome}?`}
          description="O link do e-mail deixa de valer. Dá para reativar depois."
          okText="Recusar"
          cancelText="Cancelar"
          onConfirm={() => mudarSituacao(usuario, false)}
        >
          <Button size="small" danger>
            Recusar
          </Button>
        </Popconfirm>,
      );
    } else if (usuario.ativo) {
      botoes.push(
        <Popconfirm
          key="desativar"
          title={`Desativar ${usuario.nome}?`}
          description="Ele não entra mais, e as sessões abertas dele caem na hora."
          okText="Desativar"
          cancelText="Cancelar"
          onConfirm={() => mudarSituacao(usuario, false)}
        >
          <Button size="small" danger>
            Desativar
          </Button>
        </Popconfirm>,
      );
    } else {
      botoes.push(
        <Button key="reativar" size="small" onClick={() => mudarSituacao(usuario, true)}>
          Reativar
        </Button>,
      );
    }
    return botoes;
  }

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="end" gap="middle" wrap>
        <div>
          <Typography.Title level={2}>Usuários</Typography.Title>
          <Typography.Text type="secondary">
            Só o admin vê esta tela. Cada usuário vê apenas as próprias investigações; o admin abre
            qualquer uma.
          </Typography.Text>
        </div>
        <Button type="primary" onClick={() => setCadastrando(true)}>
          Novo usuário
        </Button>
      </Flex>
      <Card>
        <FiltrosUsuarios
          filtros={filtros}
          aoMudar={(novos) => {
            setFiltros(novos);
            setNumero(1);
          }}
        />
        {erroAcao && <Alert type="error" showIcon title={erroAcao} className="espaco-topo" />}
        {erroLista ? (
          <Alert type="error" showIcon title={erroLista} className="espaco-topo" />
        ) : pagina === null ? (
          <Skeleton active />
        ) : carregando ? (
          <>
            <Carregando solto titulo={`Carregando a página ${numero}`} linhas={5} />
            <Paginacao pagina={pagina} aoMudar={setNumero} rotulo={["usuário", "usuários"]} />
          </>
        ) : pagina.itens.length === 0 ? (
          <Empty description="Nenhum usuário com esses filtros." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            <List<UsuarioListado>
              dataSource={pagina.itens}
              renderItem={(usuario) => (
                <List.Item actions={acoes(usuario)}>
                  <List.Item.Meta
                    title={
                      <Flex gap="small" align="center" wrap>
                        <span className={usuario.ativo ? undefined : "inativo"}>{usuario.nome}</span>
                        {usuario.nome_exibicao && (
                          <Typography.Text type="secondary">({usuario.nome_exibicao})</Typography.Text>
                        )}
                        <Tag color={usuario.papel === "admin" ? "gold" : "default"}>{usuario.papel}</Tag>
                        {usuario.pendente && <Tag color="orange">aguardando e-mail</Tag>}
                        {!usuario.ativo && !usuario.pendente && <Tag color="red">desativado</Tag>}
                        {usuario.nome === eu && <Tag color="blue">você</Tag>}
                      </Flex>
                    }
                    description={[
                      usuario.email,
                      textoCota(usuario.cota_diaria),
                      `desde ${quando(usuario.criado_em)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                </List.Item>
              )}
            />
            <Paginacao pagina={pagina} aoMudar={setNumero} rotulo={["usuário", "usuários"]} />
          </>
        )}
      </Card>
      {cadastrando && (
        <Janela titulo="Novo usuário" larga={false} aoFechar={() => setCadastrando(false)}>
          <FormCadastro
            aoCadastrar={() => {
              setCadastrando(false);
              carregar();
            }}
          />
        </Janela>
      )}
      {editando && (
        <Janela titulo={`Editar ${editando.nome}`} larga={false} aoFechar={() => setEditando(null)}>
          <FormEdicao
            key={editando.nome}
            alvo={editando}
            eu={eu}
            aoTerminar={(salvou) => {
              setEditando(null);
              if (salvou) carregar();
            }}
          />
        </Janela>
      )}
    </Flex>
  );
}
