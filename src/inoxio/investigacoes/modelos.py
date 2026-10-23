"""Tabela das investigações."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from inoxio.plataforma.banco import Base, agora, novo_id


class Investigacao(Base):
    __tablename__ = "investigacoes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(16))
    valor: Mapped[str] = mapped_column(String(2048))
    veredito: Mapped[str] = mapped_column(String(16))
    nota: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evidencias: Mapped[list[Any]] = mapped_column(JSON, default=list)
    analise: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    # pendente (a IA ainda escreve), pronta ou indisponivel. Nulo nas investigações
    # anteriores à explicação em segundo plano.
    analise_estado: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Quando a explicação foi pedida de novo; o prazo dela conta daqui.
    analise_pedida_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reaproveitada: Mapped[bool] = mapped_column(Boolean, default=False)
    criada_em: Mapped[datetime] = mapped_column(DateTime, default=agora, index=True)
