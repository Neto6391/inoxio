"""Criar uma conta e ativá-la pelo link do e-mail."""

from __future__ import annotations

import secrets
from datetime import timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from inoxio.contas.credenciais import gerar_hash
from inoxio.contas.modelos import (
    Ativacao,
    Usuario,
)
from inoxio.contas.regras import (
    NOME_INVALIDO,
    NOME_VALIDO,
    aceitar_termos,
    conferir_papel,
    hash_do_token,
    normalizar_email,
    pendente,
)
from inoxio.plataforma.banco import agora

# Quem se cadastra sozinho começa com esta cota; o admin pode mudar.
COTA_CADASTRO = 10
VALIDADE_ATIVACAO = timedelta(hours=24)


def criar(
    db: Session,
    nome: str,
    papel: str,
    senha: str,
    *,
    email: str | None = None,
    ativo: bool = True,
    cota_diaria: int | None = None,
    aceitou_termos: bool = False,
) -> Usuario:
    """Levanta ValueError com a mensagem para o usuário; nome ou e-mail repetido vira
    IntegrityError no commit. O admin e o cadastro público passam por aqui."""
    if not NOME_VALIDO.fullmatch(nome):
        raise ValueError(NOME_INVALIDO)
    conferir_papel(papel)
    usuario = Usuario(
        nome=nome,
        senha_hash=gerar_hash(senha),
        papel=papel,
        email=normalizar_email(email) if email is not None else None,
        ativo=ativo,
        cota_diaria=cota_diaria,
    )
    if aceitou_termos:
        aceitar_termos(usuario)
    db.add(usuario)
    return usuario


def abrir_ativacao(db: Session, usuario: Usuario) -> str:
    """Token de uso único para o link do e-mail; o banco guarda só o hash.
    Um link novo cancela os anteriores da mesma conta, e os vencidos de todas saem do banco."""
    db.execute(
        delete(Ativacao).where((Ativacao.usuario_id == usuario.id) | (Ativacao.expira_em < agora()))
    )
    token = secrets.token_urlsafe(32)
    db.add(
        Ativacao(
            token_hash=hash_do_token(token),
            usuario_id=usuario.id,
            expira_em=agora() + VALIDADE_ATIVACAO,
        )
    )
    return token


def ativar(db: Session, token: str) -> Usuario | None:
    """Ativa a conta pendente do token. Token vencido ou desconhecido não ativa nada.

    O link é de uso único porque só conta que ainda espera o e-mail é ativada: depois
    da primeira vez o e-mail está confirmado, e uma conta desativada ou recusada pelo
    admin não volta por aqui.
    """
    ativacao = db.get(Ativacao, hash_do_token(token)) if token else None
    if ativacao is None or ativacao.expira_em < agora():
        return None
    usuario = db.get(Usuario, ativacao.usuario_id)
    if usuario is None or not pendente(usuario):
        return None
    usuario.ativo = True
    usuario.email_confirmado_em = agora()
    db.execute(delete(Ativacao).where(Ativacao.usuario_id == usuario.id))
    return usuario
