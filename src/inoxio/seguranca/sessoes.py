"""Sessões guardadas no servidor. O banco conhece só o SHA-256 do token."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from inoxio import auditoria
from inoxio.db import Sessao, Usuario, agora

NOME_COOKIE = "__Host-inoxio_sessao"
OCIOSIDADE = timedelta(hours=1)
DURACAO_MAXIMA = timedelta(hours=8)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def abrir(db: Session, usuario: Usuario) -> tuple[str, Sessao]:
    token = secrets.token_urlsafe(32)
    sessao = Sessao(
        token_hash=_hash(token),
        usuario_id=usuario.id,
        csrf=secrets.token_urlsafe(32),
        ref=secrets.token_hex(8),
    )
    db.add(sessao)
    return token, sessao


def fim_por_validade(sessao: Sessao) -> tuple[datetime, str]:
    """Quando a sessão vence, ou venceu, se ninguém sair antes, e por qual dos limites."""
    parada = sessao.ultimo_uso + OCIOSIDADE
    teto = sessao.criada_em + DURACAO_MAXIMA
    if parada <= teto:
        return parada, f"expirou: {_horas(OCIOSIDADE)} sem uso"
    return teto, f"expirou: {_horas(DURACAO_MAXIMA)} de duração"


def _horas(duracao: timedelta) -> str:
    minutos = int(duracao.total_seconds() // 60)
    return f"{minutos // 60} h" if minutos % 60 == 0 else f"{minutos} min"


def _encerrar(db: Session, sessao: Sessao, motivo: str, quando: datetime | None = None) -> None:
    """Apaga a sessão e deixa na auditoria quando e por que ela acabou."""
    usuario = db.get(Usuario, sessao.usuario_id)
    auditoria.registrar(
        db,
        "sessao_encerrada",
        "-",
        usuario.nome if usuario else None,
        motivo,
        sessao=sessao.ref,
        quando=quando,
    )
    db.delete(sessao)


def validar(db: Session, token: str | None) -> tuple[Usuario, Sessao] | None:
    if not token:
        return None
    sessao = db.get(Sessao, _hash(token))
    if sessao is None:
        return None
    momento = agora()
    if momento - sessao.ultimo_uso > OCIOSIDADE or momento - sessao.criada_em > DURACAO_MAXIMA:
        fim, motivo = fim_por_validade(sessao)
        _encerrar(db, sessao, motivo, fim)
        return None
    sessao.ultimo_uso = momento
    usuario = db.get(Usuario, sessao.usuario_id)
    return (usuario, sessao) if usuario and usuario.ativo else None


def fechar_todas(db: Session, usuario_id: str, motivo: str, exceto: str | None = None) -> None:
    """Derruba todas as sessões do usuário: senha trocada, conta desativada ou pedido do
    admin. `exceto` é o hash da sessão que fica: a de quem trocou a própria senha."""
    filtro = [Sessao.usuario_id == usuario_id]
    if exceto is not None:
        filtro.append(Sessao.token_hash != exceto)
    for sessao in db.scalars(select(Sessao).where(*filtro)).all():
        _encerrar(db, sessao, motivo)


def fechar(db: Session, token: str | None, motivo: str | None = None) -> None:
    """Fecha a sessão deste navegador. Sem `motivo` (o logout, que já é um evento),
    não registra o fim de novo."""
    sessao = db.get(Sessao, _hash(token)) if token else None
    if sessao is None:
        return
    if motivo:
        _encerrar(db, sessao, motivo)
    else:
        db.delete(sessao)
