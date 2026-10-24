import { Card, Flex, Skeleton, Spin, Typography } from "antd";

type Props = {
  titulo: string;
  descricao?: string;
  // Linhas do esqueleto: o tamanho aproximado do que vai aparecer no lugar.
  linhas?: number;
  // Dentro de um cartão que já existe (a troca de página de uma lista), sem outro em volta.
  solto?: boolean;
};

// Espera com texto: diz o que está acontecendo enquanto a resposta não chega.
// O leitor de tela anuncia o título (role="status").
export function Carregando({ titulo, descricao, linhas = 3, solto = false }: Props) {
  const conteudo = (
    <>
      <div role="status" aria-live="polite">
        <Flex gap="middle" align="center" className="espaco">
          <Spin />
          <div>
            <Typography.Text strong>{titulo}</Typography.Text>
            {descricao && <div className="numero-nota">{descricao}</div>}
          </div>
        </Flex>
      </div>
      <Skeleton active title={false} paragraph={{ rows: linhas }} />
    </>
  );
  return solto ? <div className="carregando-solto">{conteudo}</div> : <Card>{conteudo}</Card>;
}
