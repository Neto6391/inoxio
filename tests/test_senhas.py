import pytest

from inoxio.seguranca import senhas


def test_hash_e_argon2id():
    assert senhas.gerar_hash("uma-senha-bem-longa").startswith("$argon2id$")


def test_senha_curta_e_recusada():
    with pytest.raises(ValueError):
        senhas.gerar_hash("curta")


def test_confere_certa_e_errada():
    senha_hash = senhas.gerar_hash("uma-senha-bem-longa")
    assert senhas.conferir(senha_hash, "uma-senha-bem-longa")
    assert not senhas.conferir(senha_hash, "outra-senha-longa")


def test_usuario_inexistente_nunca_confere():
    assert not senhas.conferir(None, "qualquer-coisa-aqui")
