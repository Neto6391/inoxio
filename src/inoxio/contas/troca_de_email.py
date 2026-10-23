"""Troca de e-mail: só vale depois do clique no link mandado ao e-mail novo."""

from __future__ import annotations

import secrets
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from inoxio.contas.modelos import (
    TrocaEmail,
    Usuario,
)
from inoxio.contas.regras import hash_do_token
from inoxio.plataforma.banco import agora

VALIDADE_TROCA_EMAIL = timedelta(hours=24)


def abrir_troca_email(db: Session, usuario: Usuario, email_novo: str) -> str:
    """Token de uso único para o link mandado ao e-mail novo; o banco guarda só o hash.
    Um pedido novo da mesma conta cancela o anterior, e os vencidos de todas saem."""
    db.execute(
        delete(TrocaEmail).where(
            (TrocaEmail.usuario_id == usuario.id) | (TrocaEmail.expira_em < agora())
        )
    )
    token = secrets.token_urlsafe(32)
    db.add(
        TrocaEmail(
            token_hash=hash_do_token(token),
            usuario_id=usuario.id,
            email_novo=email_novo,
            expira_em=agora() + VALIDADE_TROCA_EMAIL,
        )
    )
    return token


def troca_email_pendente(db: Session, usuario: Usuario) -> str | None:
    pedido = db.scalar(
        select(TrocaEmail).where(
            TrocaEmail.usuario_id == usuario.id, TrocaEmail.expira_em >= agora()
        )
    )
    return pedido.email_novo if pedido else None


def confirmar_troca_email(db: Session, token: str) -> tuple[Usuario, str | None] | None:
    """Troca o e-mail da conta do token e devolve (conta, e-mail antigo). Token vencido ou
    desconhecido, conta desativada ou e-mail tomado por outra conta nesse meio-tempo não
    trocam nada."""
    pedido = db.get(TrocaEmail, hash_do_token(token)) if token else None
    if pedido is None or pedido.expira_em < agora():
        return None
    usuario = db.get(Usuario, pedido.usuario_id)
    tomado = db.scalar(select(Usuario.id).where(Usuario.email == pedido.email_novo))
    if usuario is None or not usuario.ativo or tomado is not None:
        return None
    antigo = usuario.email
    usuario.email = pedido.email_novo
    usuario.email_confirmado_em = agora()
    db.execute(delete(TrocaEmail).where(TrocaEmail.usuario_id == usuario.id))
    return usuario, antigo
