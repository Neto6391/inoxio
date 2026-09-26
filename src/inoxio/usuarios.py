"""Regras para criar um usuário, as mesmas no terminal e na tela do admin."""

from __future__ import annotations

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inoxio.db import Usuario
from inoxio.seguranca import sessoes
from inoxio.seguranca.senhas import gerar_hash

PAPEIS = ("admin", "analista")
# Minúsculas, dígitos, ponto, hífen e sublinhado: o nome aparece na tela e nos logs.
NOME_VALIDO = re.compile(r"[a-z0-9._-]{3,32}")
NOME_INVALIDO = "O nome precisa ter de 3 a 32 caracteres: letras minúsculas, dígitos, ponto, hífen ou sublinhado."


class Conflito(Exception):
    """A mudança deixaria o sistema sem quem o administre."""


def _conferir_papel(papel: str) -> None:
    if papel not in PAPEIS:
        raise ValueError(f"O papel precisa ser um de: {', '.join(PAPEIS)}.")


def criar(db: Session, nome: str, papel: str, senha: str) -> Usuario:
    """Levanta ValueError com a mensagem para o usuário; nome repetido vira IntegrityError no commit."""
    if not NOME_VALIDO.fullmatch(nome):
        raise ValueError(NOME_INVALIDO)
    _conferir_papel(papel)
    usuario = Usuario(nome=nome, senha_hash=gerar_hash(senha), papel=papel)
    db.add(usuario)
    return usuario


def alterar(
    db: Session,
    alvo: Usuario,
    quem_altera: Usuario,
    *,
    papel: str | None = None,
    senha: str | None = None,
    ativo: bool | None = None,
) -> None:
    """Muda papel, senha ou situação. Senha nova ou desativação derruba as sessões do alvo."""
    if papel is not None:
        _conferir_papel(papel)
    novo_hash = gerar_hash(senha) if senha is not None else None
    if ativo is False and alvo.id == quem_altera.id:
        raise Conflito("Você não pode desativar a própria conta.")
    deixa_de_ser_admin = (
        alvo.papel == "admin"
        and alvo.ativo
        and (ativo is False or (papel is not None and papel != "admin"))
    )
    if deixa_de_ser_admin and _admins_ativos(db) <= 1:
        raise Conflito("Precisa sobrar pelo menos um admin ativo.")
    if papel is not None:
        alvo.papel = papel
    if novo_hash is not None:
        alvo.senha_hash = novo_hash
    if ativo is not None:
        alvo.ativo = ativo
    if novo_hash is not None or ativo is False:
        sessoes.fechar_todas(db, alvo.id)


def _admins_ativos(db: Session) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Usuario)
        .where(Usuario.papel == "admin", Usuario.ativo.is_(True))
    )
