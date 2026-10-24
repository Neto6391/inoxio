import { Progress } from "antd";

// Barra proporcional ao maior valor da lista: dá para comparar de relance.
export function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  return (
    <Progress percent={maximo ? (100 * valor) / maximo : 0} showInfo={false} size="small" status="normal" />
  );
}
