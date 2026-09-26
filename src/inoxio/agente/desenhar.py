"""Gera o diagrama Mermaid do grafo e o grava no README. Um teste cobra a sincronia."""

import re
import sys
from pathlib import Path

from inoxio.agente.grafo import construir_grafo

README = Path(__file__).resolve().parents[3] / "README.md"
INICIO = "<!-- grafo:inicio -->"
FIM = "<!-- grafo:fim -->"
_BLOCO = re.compile(re.escape(INICIO) + r".*?" + re.escape(FIM), re.DOTALL)


def mermaid() -> str:
    grafo = construir_grafo([], None)
    return grafo.get_graph().draw_mermaid().strip()


def bloco() -> str:
    return f"{INICIO}\n```mermaid\n{mermaid()}\n```\n{FIM}"


def main() -> int:
    texto = README.read_text(encoding="utf-8")
    if not _BLOCO.search(texto):
        print("README sem os marcadores do grafo", file=sys.stderr)
        return 1
    README.write_text(_BLOCO.sub(lambda _: bloco(), texto), encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
