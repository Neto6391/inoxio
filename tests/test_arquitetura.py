"""Fronteiras que o código não pode cruzar."""

import ast
from pathlib import Path

from inoxio.agente.decidir import ROTULOS
from inoxio.agente.mente import AnaliseMente, RespostaMente

RAIZ = Path(__file__).resolve().parents[1]
SRC = RAIZ / "src" / "inoxio"
FRONT = RAIZ / "frontend" / "src"


def _python():
    return sorted(SRC.rglob("*.py"))


def _frontend():
    """Código do React, sem os arquivos de teste (que carregam texto hostil de propósito)."""
    return sorted(p for p in FRONT.rglob("*.ts*") if ".test." not in p.name)


def test_nenhum_argumento_shell():
    usos = [
        f"{arquivo.relative_to(SRC)}:{no.lineno}"
        for arquivo in _python()
        for no in ast.walk(ast.parse(arquivo.read_text(encoding="utf-8")))
        if isinstance(no, ast.keyword) and no.arg == "shell"
    ]
    assert usos == []


def test_app_nao_executa_processo():
    proibidos = ("subprocess", "os.system", "os.popen")
    usam = [
        arquivo.relative_to(SRC).as_posix()
        for arquivo in _python()
        if any(p in arquivo.read_text(encoding="utf-8") for p in proibidos)
    ]
    assert usam == []


def test_mente_nao_tem_tools_nem_campo_de_veredito():
    fonte = (SRC / "agente" / "mente.py").read_text(encoding="utf-8")
    assert "bind_tools" not in fonte
    assert "tools=" not in fonte
    for esquema in (RespostaMente, AnaliseMente):
        assert not {"veredito", "nota"} & set(esquema.model_fields)


def test_frontend_nunca_injeta_html():
    assert _frontend(), "frontend/src não encontrado"
    for arquivo in _frontend():
        texto = arquivo.read_text(encoding="utf-8")
        assert "dangerouslySetInnerHTML" not in texto, arquivo.name
        assert "innerHTML" not in texto, arquivo.name


def test_interface_nunca_diz_seguro_ou_limpo():
    textos = " ".join(ROTULOS.values()).lower()
    telas = " ".join(p.read_text(encoding="utf-8").lower() for p in _frontend())
    for palavra in ("seguro", "limpo"):
        assert palavra not in textos
        assert palavra not in telas
