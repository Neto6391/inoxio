"""Trilha de auditoria: registra os eventos que importam e apaga os de mais de 90 dias."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from inoxio.db import Evento, agora
from inoxio.seguranca.limites import origem

RETENCAO = timedelta(days=90)


def registrar(
    db: Session, tipo: str, ip: str, usuario: str | None = None, detalhe: str = ""
) -> None:
    db.execute(delete(Evento).where(Evento.quando < agora() - RETENCAO))
    db.add(Evento(tipo=tipo, usuario=usuario, ip=origem(ip), detalhe=detalhe[:300]))


def contar(db: Session, tipo: str, ip: str, janela: timedelta) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Evento)
        .where(Evento.tipo == tipo, Evento.ip == origem(ip), Evento.quando >= agora() - janela)
    )
