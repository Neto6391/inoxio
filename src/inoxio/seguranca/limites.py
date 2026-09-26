"""Limites de uso, contados no banco para sobreviver a reinícios."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inoxio.db import Investigacao, TentativaLogin, agora

JANELA_LOGIN = timedelta(minutes=15)
FALHAS_POR_CONTA = 5
FALHAS_POR_IP = 20
INVESTIGACOES_POR_HORA = 20
JANELA_INVESTIGACOES = timedelta(hours=1)


def login_bloqueado(db: Session, nome: str, ip: str) -> bool:
    falhas = (
        select(func.count())
        .select_from(TentativaLogin)
        .where(
            TentativaLogin.sucesso.is_(False), TentativaLogin.criada_em >= agora() - JANELA_LOGIN
        )
    )
    por_conta = db.scalar(falhas.where(TentativaLogin.nome == nome))
    por_ip = db.scalar(falhas.where(TentativaLogin.ip == ip))
    return por_conta >= FALHAS_POR_CONTA or por_ip >= FALHAS_POR_IP


def registrar_tentativa(db: Session, nome: str, ip: str, sucesso: bool) -> None:
    db.add(TentativaLogin(nome=nome[:64], ip=ip[:64], sucesso=sucesso))


def investigacao_excedida(db: Session, usuario_id: str) -> bool:
    feitas = db.scalar(
        select(func.count())
        .select_from(Investigacao)
        .where(
            Investigacao.usuario_id == usuario_id,
            Investigacao.criada_em >= agora() - JANELA_INVESTIGACOES,
        )
    )
    return feitas >= INVESTIGACOES_POR_HORA
