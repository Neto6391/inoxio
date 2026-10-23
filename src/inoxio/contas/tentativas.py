"""Limite de tentativas de login, contado no banco para sobreviver a reinícios."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from inoxio.contas.modelos import TentativaLogin
from inoxio.plataforma.banco import agora
from inoxio.plataforma.rede import origem

JANELA_LOGIN = timedelta(minutes=15)


# Por conta e origem juntas: senhas erradas vindas de outro lugar não trancam o
# dono. Quem tenta de muitos lugares esbarra no teto por origem.
FALHAS_POR_CONTA_E_ORIGEM = 5


# Teto de qualquer origem somada: alto o bastante para só um ataque distribuído
# chegar nele, e ainda assim um limite para quem tenta de muitos lugares.
FALHAS_POR_CONTA = 100
FALHAS_POR_IP = 20


def login_bloqueado(db: Session, nome: str, ip: str) -> bool:
    falhas = (
        select(func.count())
        .select_from(TentativaLogin)
        .where(
            TentativaLogin.sucesso.is_(False), TentativaLogin.criada_em >= agora() - JANELA_LOGIN
        )
    )
    daqui = falhas.where(TentativaLogin.ip == origem(ip))
    por_conta = db.scalar(daqui.where(TentativaLogin.nome == nome))
    por_origem = db.scalar(daqui)
    por_conta_total = db.scalar(falhas.where(TentativaLogin.nome == nome))
    return (
        por_conta >= FALHAS_POR_CONTA_E_ORIGEM
        or por_origem >= FALHAS_POR_IP
        or por_conta_total >= FALHAS_POR_CONTA
    )


def registrar_tentativa(db: Session, nome: str, ip: str, sucesso: bool) -> None:
    # Só a janela importa para o bloqueio; o resto é apagado para a tabela não crescer.
    db.execute(delete(TentativaLogin).where(TentativaLogin.criada_em < agora() - JANELA_LOGIN))
    db.add(TentativaLogin(nome=nome[:64], ip=origem(ip), sucesso=sucesso))
