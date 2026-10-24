import type { ReactNode } from "react";
import { Rodape } from "../compartilhado/Rodape";
import { Link } from "../app/rotas";

export function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="login">
      <div className="area-senha">
        <div className="marca espaco">
          <span className="marca-simbolo">I</span>
          Inóxio
        </div>
        {children}
        <div className="espaco-topo">
          <Link para="/entrar">← Voltar para entrar</Link>
        </div>
        <Rodape />
      </div>
    </div>
  );
}
