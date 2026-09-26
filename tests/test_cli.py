import pytest
from sqlalchemy import select

from inoxio.cli import criar_usuario, main
from inoxio.db import Usuario


def test_cria_usuario_com_hash(fabrica):
    criar_usuario(fabrica, "ana", "analista", "senha-de-teste-longa")
    with fabrica() as db:
        usuario = db.scalar(select(Usuario).where(Usuario.nome == "ana"))
    assert usuario.papel == "analista"
    assert usuario.senha_hash.startswith("$argon2id$")


def test_papel_invalido_e_recusado(fabrica):
    with pytest.raises(ValueError):
        criar_usuario(fabrica, "xavier", "root", "senha-de-teste-longa")


def test_main_le_a_senha_do_terminal(monkeypatch, tmp_path):
    monkeypatch.setenv("INOXIO_BANCO_URL", f"sqlite:///{(tmp_path / 't.db').as_posix()}")
    monkeypatch.setattr("getpass.getpass", lambda _prompt="": "senha-de-teste-longa")
    assert main(["criar-usuario", "ana", "--papel", "admin"]) == 0
    assert main(["criar-usuario", "ana", "--papel", "admin"]) == 1


def test_main_recusa_senhas_diferentes(monkeypatch, tmp_path):
    monkeypatch.setenv("INOXIO_BANCO_URL", f"sqlite:///{(tmp_path / 't.db').as_posix()}")
    respostas = iter(["senha-de-teste-longa", "outra-senha-longa!"])
    monkeypatch.setattr("getpass.getpass", lambda _prompt="": next(respostas))
    assert main(["criar-usuario", "ana", "--papel", "admin"]) == 1
