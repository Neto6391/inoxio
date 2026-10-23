"""Tabela da trilha de auditoria."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from inoxio.plataforma.banco import Base, agora


class Evento(Base):
    """Trilha de auditoria: quem fez o quê, de onde e quando."""

    __tablename__ = "eventos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quando: Mapped[datetime] = mapped_column(DateTime, default=agora, index=True)
    tipo: Mapped[str] = mapped_column(String(32), index=True)
    usuario: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    ip: Mapped[str] = mapped_column(String(64), index=True)
    detalhe: Mapped[str] = mapped_column(String(300), default="")
    # A sessão em que aconteceu (Sessao.ref). Nulo fora de sessão e nos eventos antigos.
    sessao: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
