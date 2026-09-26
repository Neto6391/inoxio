"""Sessões guardadas no servidor. O banco conhece só o SHA-256 do token."""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from inoxio.db import Sessao, Usuario, agora

NOME_COOKIE = "__Host-inoxio_sessao"
OCIOSIDADE = timedelta(minutes=30)
DURACAO_MAXIMA = timedelta(hours=8)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def abrir(db: Session, usuario: Usuario) -> tuple[str, Sessao]:
    token = secrets.token_urlsafe(32)
    sessao = Sessao(token_hash=_hash(token), usuario_id=usuario.id, csrf=secrets.token_urlsafe(32))
    db.add(sessao)
    return token, sessao


def validar(db: Session, token: str | None) -> tuple[Usuario, Sessao] | None:
    if not token:
        return None
    sessao = db.get(Sessao, _hash(token))
    if sessao is None:
        return None
    momento = agora()
    if momento - sessao.ultimo_uso > OCIOSIDADE or momento - sessao.criada_em > DURACAO_MAXIMA:
        db.delete(sessao)
        return None
    sessao.ultimo_uso = momento
    usuario = db.get(Usuario, sessao.usuario_id)
    return (usuario, sessao) if usuario and usuario.ativo else None


def fechar_todas(db: Session, usuario_id: str) -> None:
    """Derruba todas as sessões do usuário: senha trocada ou conta desativada."""
    db.execute(delete(Sessao).where(Sessao.usuario_id == usuario_id))


def fechar(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(Sessao).where(Sessao.token_hash == _hash(token)))
