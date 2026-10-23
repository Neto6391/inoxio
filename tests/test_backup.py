"""O backup do banco: cópia consistente, conferida, comprimida, com retenção e registro."""

import gzip
import importlib.util
import sqlite3
import stat
import sys
from pathlib import Path

import pytest

from inoxio.cli import criar_usuario
from inoxio.plataforma.banco import criar_fabrica

SCRIPT = Path(__file__).resolve().parents[1] / "infra" / "backup" / "backup-banco.py"
especificacao = importlib.util.spec_from_file_location("backup_banco", SCRIPT)
backup = importlib.util.module_from_spec(especificacao)
especificacao.loader.exec_module(backup)


@pytest.fixture
def banco(tmp_path):
    caminho = tmp_path / "inoxio.db"
    fabrica = criar_fabrica(f"sqlite:///{caminho}")
    for nome in ("ana", "beto"):
        criar_usuario(fabrica, nome, "analista", "senha-de-teste-longa")
    return caminho


def abrir_copia(arquivo: Path, pasta: Path) -> sqlite3.Connection:
    restaurado = pasta / "restaurado.db"
    restaurado.write_bytes(gzip.decompress(arquivo.read_bytes()))
    return sqlite3.connect(restaurado)


def test_backup_restaura_com_os_mesmos_dados(banco, tmp_path):
    destino = tmp_path / "backups"
    assert backup.main(["--banco", str(banco), "--destino", str(destino)]) == 0
    [arquivo] = destino.glob("inoxio-*.db.gz")
    copia = abrir_copia(arquivo, tmp_path)
    assert sorted(nome for (nome,) in copia.execute("SELECT nome FROM usuarios")) == ["ana", "beto"]
    assert copia.execute("PRAGMA integrity_check").fetchone()[0] == "ok"


@pytest.mark.skipif(sys.platform == "win32", reason="permissões POSIX")
def test_backup_so_o_dono_le(banco, tmp_path):
    destino = tmp_path / "backups"
    backup.main(["--banco", str(banco), "--destino", str(destino)])
    [arquivo] = destino.glob("inoxio-*.db.gz")
    assert stat.S_IMODE(arquivo.stat().st_mode) == 0o600


def test_retencao_guarda_so_os_mais_recentes(banco, tmp_path):
    destino = tmp_path / "backups"
    destino.mkdir()
    for dia in range(1, 6):
        (destino / f"inoxio-202610{dia:02d}-063000.db.gz").write_bytes(b"velho")
    backup.main(["--banco", str(banco), "--destino", str(destino), "--manter", "3"])
    restantes = sorted(arquivo.name for arquivo in destino.glob("inoxio-*.db.gz"))
    assert len(restantes) == 3
    assert "inoxio-20261001-063000.db.gz" not in restantes
    assert restantes[-1] > "inoxio-20261005"


def test_backup_fica_registrado_na_auditoria(banco, tmp_path):
    backup.main(["--banco", str(banco), "--destino", str(tmp_path / "backups")])
    with sqlite3.connect(banco) as conexao:
        [(tipo, detalhe)] = conexao.execute("SELECT tipo, detalhe FROM eventos").fetchall()
    assert tipo == "backup"
    assert detalhe.startswith("inoxio-") and "KB" in detalhe


def test_banco_corrompido_nao_vira_backup(tmp_path):
    banco = tmp_path / "inoxio.db"
    banco.write_bytes(b"isto nao e um banco sqlite" * 100)
    destino = tmp_path / "backups"
    assert backup.main(["--banco", str(banco), "--destino", str(destino)]) == 1
    assert list(destino.glob("inoxio-*")) == []


def test_copia_com_tabela_e_indice_divergentes_e_descartada(tmp_path):
    # Estrutura intacta, mas o texto de uma linha mudou só na tabela, não no índice.
    # A API de cópia não percebe; só o integrity_check pega.
    banco = tmp_path / "inoxio.db"
    with sqlite3.connect(banco) as conexao:
        conexao.execute(
            "CREATE TABLE eventos (id INTEGER PRIMARY KEY, quando, tipo, usuario, ip, detalhe)"
        )
        conexao.execute("CREATE TABLE dados (id INTEGER PRIMARY KEY, texto TEXT)")
        conexao.execute("CREATE INDEX ix_dados ON dados (texto)")
        conexao.executemany(
            "INSERT INTO dados (texto) VALUES (?)", [(f"linha {n:04d}",) for n in range(3000)]
        )
    conteudo = banco.read_bytes()
    posicao = conteudo.index(b"linha 1500")
    banco.write_bytes(conteudo[:posicao] + b"LINHA 1500" + conteudo[posicao + 10 :])
    with sqlite3.connect(banco) as conexao:
        assert conexao.execute("PRAGMA integrity_check").fetchone()[0] != "ok"
    destino = tmp_path / "backups"
    assert backup.main(["--banco", str(banco), "--destino", str(destino)]) == 1
    assert list(destino.glob("inoxio-*")) == []
