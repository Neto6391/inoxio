"""Limites de uso, contados no banco para sobreviver a reinícios."""

from __future__ import annotations

import ipaddress
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from inoxio.db import Investigacao, TentativaLogin, agora

JANELA_LOGIN = timedelta(minutes=15)
# Por conta e origem juntas: senhas erradas vindas de outro lugar não trancam o
# dono. Quem tenta de muitos lugares esbarra no teto por origem.
FALHAS_POR_CONTA_E_ORIGEM = 5
# Teto de qualquer origem somada: alto o bastante para só um ataque distribuído
# chegar nele, e ainda assim um limite para quem tenta de muitos lugares.
FALHAS_POR_CONTA = 100
FALHAS_POR_IP = 20
INVESTIGACOES_POR_HORA = 20
JANELA_INVESTIGACOES = timedelta(hours=1)
# A cota zera à meia-noite de Brasília. O Brasil está sem horário de verão desde
# 2019; se ele voltar, o deslocamento fixo precisa virar o fuso America/Sao_Paulo.
FUSO_BRASILIA = timezone(timedelta(hours=-3))


def origem(ip: str) -> str:
    """IPv6 conta pela rede /64: quem tem uma tem milhões de endereços para trocar."""
    try:
        endereco = ipaddress.ip_address(ip)
    except ValueError:
        return ip[:64]
    if endereco.version == 6:
        return str(ipaddress.ip_network(f"{endereco}/64", strict=False))
    return str(endereco)


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


def inicio_do_dia(momento: datetime | None = None) -> datetime:
    """Meia-noite de Brasília do dia de `momento`, em UTC sem fuso, como o banco guarda."""
    em_brasilia = (momento or agora()).replace(tzinfo=UTC).astimezone(FUSO_BRASILIA)
    meia_noite = em_brasilia.replace(hour=0, minute=0, second=0, microsecond=0)
    return meia_noite.astimezone(UTC).replace(tzinfo=None)


def _feitas_desde(db: Session, usuario_id: str, desde: datetime) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Investigacao)
        .where(Investigacao.usuario_id == usuario_id, Investigacao.criada_em >= desde)
    )


def investigacao_excedida(db: Session, usuario_id: str, cota_diaria: int | None = None) -> bool:
    if _feitas_desde(db, usuario_id, agora() - JANELA_INVESTIGACOES) >= INVESTIGACOES_POR_HORA:
        return True
    return cota_diaria is not None and _feitas_desde(db, usuario_id, inicio_do_dia()) >= cota_diaria


def creditos(db: Session, usuario_id: str, cota_diaria: int | None) -> dict[str, Any]:
    """Uso da cota de hoje. Sem cota (o admin, por padrão), não há restantes."""
    inicio = inicio_do_dia()
    usados = _feitas_desde(db, usuario_id, inicio)
    return {
        "cota": cota_diaria,
        "usados": usados,
        "restantes": None if cota_diaria is None else max(cota_diaria - usados, 0),
        "renova_em": (inicio + timedelta(days=1)).isoformat(),
    }
