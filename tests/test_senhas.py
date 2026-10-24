import pytest

from inoxio.contas import credenciais


def test_hash_e_argon2id():
    assert credenciais.gerar_hash("uma-senha-bem-longa").startswith("$argon2id$")


def test_senha_curta_e_recusada():
    with pytest.raises(ValueError):
        credenciais.gerar_hash("curta")


def test_confere_certa_e_errada():
    senha_hash = credenciais.gerar_hash("uma-senha-bem-longa")
    assert credenciais.conferir(senha_hash, "uma-senha-bem-longa")
    assert not credenciais.conferir(senha_hash, "outra-senha-longa")


def test_usuario_inexistente_nunca_confere():
    assert not credenciais.conferir(None, "qualquer-coisa-aqui")
    # Nem com a senha do hash usado para gastar tempo.
    assert not credenciais.conferir(None, credenciais._SENHA_FALSA)
