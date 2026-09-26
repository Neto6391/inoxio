"""Hash e conferência de senhas com argon2id."""

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

TAMANHO_MINIMO = 12
_hasher = PasswordHasher()
# Usuário inexistente confere contra este hash, para o tempo de resposta não
# revelar quais usuários existem.
_SENHA_FALSA = "hash-falso-que-so-serve-para-gastar-tempo"
_HASH_FALSO = _hasher.hash(_SENHA_FALSA)


def gerar_hash(senha: str) -> str:
    if len(senha) < TAMANHO_MINIMO:
        raise ValueError(f"a senha precisa de pelo menos {TAMANHO_MINIMO} caracteres")
    return _hasher.hash(senha)


def conferir(senha_hash: str | None, senha: str) -> bool:
    try:
        certo = _hasher.verify(senha_hash or _HASH_FALSO, senha)
    except (VerificationError, InvalidHashError):
        return False
    return certo and senha_hash is not None
