"""O forced command do deploy: o que ele recusa antes de tocar em qualquer coisa."""

import io
import os
import subprocess
import sys
import tarfile
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "infra" / "implantacao" / "implantar"
SHA = "0123456789abcdef0123456789abcdef01234567"

pytestmark = pytest.mark.skipif(
    sys.platform == "win32", reason="script de servidor; roda no CI Linux"
)


def rodar(comando: str, pacote: bytes, home: Path):
    ambiente = {"PATH": os.environ["PATH"], "HOME": str(home), "SSH_ORIGINAL_COMMAND": comando}
    return subprocess.run(
        ["bash", str(SCRIPT)],
        input=pacote,
        env=ambiente,
        capture_output=True,
        timeout=20,
        check=False,
    )


def pacote_com(*nomes: str) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for nome in nomes:
            dados = b"<!doctype html>"
            info = tarfile.TarInfo(nome)
            info.size = len(dados)
            tar.addfile(info, io.BytesIO(dados))
    return buffer.getvalue()


@pytest.mark.parametrize(
    "comando",
    [
        "",
        "rm -rf /",
        "$(id)",
        "g" * 40,
        "A" * 40,
        SHA[:-1],
        SHA + "; id",
    ],
)
def test_recusa_o_que_nao_e_sha(comando, tmp_path):
    resultado = rodar(comando, pacote_com("./index.html"), tmp_path)
    assert resultado.returncode == 2
    assert b"recusado" in resultado.stderr


def test_recusa_pacote_vazio(tmp_path):
    resultado = rodar(SHA, b"", tmp_path)
    assert resultado.returncode == 2
    assert b"pacote do frontend vazio" in resultado.stderr


def test_recusa_pacote_sem_index(tmp_path):
    resultado = rodar(SHA, pacote_com("./assets/app.js"), tmp_path)
    assert resultado.returncode == 2
    assert b"sem index.html" in resultado.stderr
    # Recusado antes de criar a pasta do frontend.
    assert not (tmp_path / "frontend").exists()
