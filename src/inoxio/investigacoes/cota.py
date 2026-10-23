"""Créditos de investigação: o limite por hora e a cota diária, contados no banco."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inoxio.contas.modelos import Usuario
from inoxio.investigacoes.modelos import Investigacao
from inoxio.plataforma.banco import agora
from inoxio.plataforma.horario import inicio_do_dia

INVESTIGACOES_POR_HORA = 20
JANELA_INVESTIGACOES = timedelta(hours=1)


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
