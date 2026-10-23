import { Alert, Card, Empty, Flex, Input, List, Pagination, Skeleton, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "./api";
import { quando } from "./formato";

type Evento = { quando: string; tipo: string; usuario: string | null; ip: string; detalhe: string };
type Pagina = { total: number; por_pagina: number; tipos: string[]; itens: Evento[] };

// Os tipos que existem vêm do servidor (a lista dele é a fonte); aqui só o nome de cada um.
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
};

function nomeDoEvento(tipo: string) {
  return NOMES_EVENTO[tipo] ?? { texto: tipo, cor: "default" };
}

export function Auditoria() {
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");
  const [numero, setNumero] = useState(1);

  useEffect(() => {
    // Com cliques rápidos, a resposta de um filtro antigo não pode cobrir a do novo.
    let vigente = true;
    const parametros = new URLSearchParams({ pagina: String(numero) });
    if (tipo) parametros.set("tipo", tipo);
    if (usuario) parametros.set("usuario", usuario);
    chamar<Pagina>(`/api/auditoria?${parametros}`)
      .then((nova) => {
        if (!vigente) return;
        setPagina(nova);
        setErro(null);
      })
      .catch((falha) => {
        if (vigente) setErro(mensagemDeErro(falha));
      });
    return () => {
      vigente = false;
    };
  }, [tipo, usuario, numero]);

  function filtrarTipo(novo: string | null) {
    setTipo(novo);
    setNumero(1);
  }

  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={2}>Auditoria</Typography.Title>
        <Typography.Text type="secondary">
          Quem entrou, quem errou a senha, o que foi investigado e o que o admin mudou. Os eventos
          ficam guardados por 90 dias.
        </Typography.Text>
      </div>
      <Card>
        <Flex vertical gap="middle">
          <Flex gap={6} wrap>
            <Tag.CheckableTag checked={tipo === null} onChange={() => filtrarTipo(null)}>
              todos
            </Tag.CheckableTag>
            {(pagina?.tipos ?? []).map((chave) => (
              <Tag.CheckableTag key={chave} checked={tipo === chave} onChange={() => filtrarTipo(chave)}>
                {nomeDoEvento(chave).texto}
              </Tag.CheckableTag>
            ))}
          </Flex>
          <Input.Search
            allowClear
            placeholder="Filtrar por usuário"
            className="filtro-usuario"
            onSearch={(valor) => {
              setUsuario(valor.trim());
              setNumero(1);
            }}
          />
        </Flex>
      </Card>
      <Card title={pagina ? `${pagina.total} eventos` : "Eventos"}>
        {erro ? (
          <Alert type="error" showIcon title={erro} />
        ) : pagina === null ? (
          <Skeleton active />
        ) : pagina.itens.length === 0 ? (
          <Empty description="Nenhum evento com esses filtros." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            <List<Evento>
              dataSource={pagina.itens}
              renderItem={(evento) => {
                const nome = nomeDoEvento(evento.tipo);
                return (
                  <List.Item>
                    <Flex vertical gap={2} className="linha-evento">
                      <Flex gap="small" align="center" wrap>
                        <Tag color={nome.cor}>{nome.texto}</Tag>
                        <Typography.Text strong>{evento.usuario ?? "—"}</Typography.Text>
                        <Typography.Text type="secondary">{quando(evento.quando)}</Typography.Text>
                        <span className="indicador evento-ip">{evento.ip}</span>
                      </Flex>
                      {evento.detalhe && <span className="indicador evento-detalhe">{evento.detalhe}</span>}
                    </Flex>
                  </List.Item>
                );
              }}
            />
            <Flex justify="end" className="espaco-topo">
              <Pagination
                current={numero}
                pageSize={pagina.por_pagina}
                total={pagina.total}
                showSizeChanger={false}
                onChange={setNumero}
              />
            </Flex>
          </>
        )}
      </Card>
    </Flex>
  );
}
