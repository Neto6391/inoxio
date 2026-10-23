"""Fronteiras que o código não pode cruzar."""

import ast
import re
from pathlib import Path

from inoxio.investigacoes.decidir import ROTULOS
from inoxio.investigacoes.ia.esquema import AnaliseMente, RespostaMente

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
    # Todo o pacote da IA, não só o arquivo da chamada.
    fonte = "".join(
        a.read_text(encoding="utf-8") for a in (SRC / "investigacoes" / "ia").glob("*.py")
    )
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


def test_servico_nao_ganha_privilegios():
    unidade = (RAIZ / "infra" / "implantacao" / "inoxio.service").read_text(encoding="utf-8")
    assert "NoNewPrivileges=true" in unidade.splitlines()


def test_readme_so_cita_arquivos_e_testes_que_existem():
    # Mover um arquivo ou renomear um teste sem atualizar o README quebra aqui.
    texto = (RAIZ / "README.md").read_text(encoding="utf-8")
    caminhos = set(re.findall(r"`((?:src|frontend|infra|tests)/[\w./-]+)`", texto))
    faltam = sorted(c for c in caminhos if not (RAIZ / c).exists())
    testes, arquivo = set(), None
    for nome, funcao in re.findall(r"(test_\w+\.py)?::(test_\w+)", texto):
        arquivo = nome or arquivo
        testes.add((arquivo, funcao))
    for nome, funcao in sorted(testes):
        fonte = (RAIZ / "tests" / nome).read_text(encoding="utf-8")
        if not re.search(rf"^def {funcao}\(", fonte, re.MULTILINE):
            faltam.append(f"{nome}::{funcao}")
    assert caminhos and testes
    assert faltam == []
