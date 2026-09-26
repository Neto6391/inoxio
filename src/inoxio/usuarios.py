"""Regras para criar um usuário, as mesmas no terminal e na tela do admin."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from inoxio.db import Usuario
from inoxio.seguranca.senhas import gerar_hash

PAPEIS = ("admin", "analista")
# Minúsculas, dígitos, ponto, hífen e sublinhado: o nome aparece na tela e nos logs.
NOME_VALIDO = re.compile(r"[a-z0-9._-]{3,32}")
NOME_INVALIDO = "O nome precisa ter de 3 a 32 caracteres: letras minúsculas, dígitos, ponto, hífen ou sublinhado."


def criar(db: Session, nome: str, papel: str, senha: str) -> Usuario:
    """Levanta ValueError com a mensagem para o usuário; nome repetido vira IntegrityError no commit."""
    if not NOME_VALIDO.fullmatch(nome):
        raise ValueError(NOME_INVALIDO)
    if papel not in PAPEIS:
        raise ValueError(f"O papel precisa ser um de: {', '.join(PAPEIS)}.")
    usuario = Usuario(nome=nome, senha_hash=gerar_hash(senha), papel=papel)
    db.add(usuario)
    return usuario
