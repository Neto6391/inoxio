"""O repositório é público: nada do sistema coabitante pode aparecer nele."""

from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
# Fragmentos montados em tempo de execução para este arquivo não casar consigo mesmo.
PROIBIDOS = ("senti" + "nela", "aegis" + "blue", "ss" + "lip")
PULAR = {
    ".git",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "node_modules",
    "dist",
    "tls",
    "webroot",
}
SUFIXOS = {
    ".py",
    ".md",
    ".yml",
    ".yaml",
    ".conf",
    ".html",
    ".toml",
    ".sh",
    ".service",
    ".css",
    ".ts",
    ".tsx",
    "",
}


def test_repositorio_nao_nomeia_o_coabitante():
    encontrados = []
    for caminho in RAIZ.rglob("*"):
        if not caminho.is_file() or PULAR & set(caminho.relative_to(RAIZ).parts):
            continue
        if caminho.suffix not in SUFIXOS:
            continue
        texto = caminho.read_text(encoding="utf-8", errors="ignore").lower()
        encontrados += [f"{caminho.relative_to(RAIZ)}: {p}" for p in PROIBIDOS if p in texto]
    assert encontrados == []
