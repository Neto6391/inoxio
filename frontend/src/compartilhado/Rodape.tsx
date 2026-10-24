import { Link } from "../app/rotas";

export function Rodape() {
  return (
    <footer className="rodape">
      <span>Inóxio</span>
      <Link para="/termos">Termos de Uso</Link>
      <Link para="/privacidade">Política de Privacidade</Link>
      <a href="https://github.com/Neto6391/inoxio" target="_blank" rel="noopener noreferrer">
        Código no GitHub
      </a>
    </footer>
  );
}
