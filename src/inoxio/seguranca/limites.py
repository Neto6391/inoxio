"""Limites de uso, contados no banco para sobreviver a reinícios."""

from __future__ import annotations

import ipaddress
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from inoxio.db import Investigacao, TentativaLogin, Usuario, agora

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


def cota_de(usuario: Usuario) -> int | None:
    """O admin não tem cota diária, mesmo que a conta tenha uma guardada de antes."""
    return None if usuario.papel == "admin" else usuario.cota_diaria


def _uso_conta_desde(usuario: Usuario) -> datetime:
    """Meia-noite de Brasília, ou o momento em que o admin zerou o uso de hoje."""
    inicio = inicio_do_dia()
    zerado = usuario.uso_zerado_em
    return zerado if zerado is not None and zerado > inicio else inicio


def investigacao_excedida(db: Session, usuario: Usuario) -> bool:
    if _feitas_desde(db, usuario.id, agora() - JANELA_INVESTIGACOES) >= INVESTIGACOES_POR_HORA:
        return True
    cota = cota_de(usuario)
    return cota is not None and _feitas_desde(db, usuario.id, _uso_conta_desde(usuario)) >= cota


def creditos(db: Session, usuario: Usuario) -> dict[str, Any]:
    """Uso da cota de hoje. Sem cota (o admin), não há restantes."""
    cota = cota_de(usuario)
    usados = _feitas_desde(db, usuario.id, _uso_conta_desde(usuario))
    return {
        "cota": cota,
        "usados": usados,
        "restantes": None if cota is None else max(cota - usados, 0),
        "renova_em": (inicio_do_dia() + timedelta(days=1)).isoformat(),
        "por_hora": INVESTIGACOES_POR_HORA,
    }
