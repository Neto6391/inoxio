"""Modelos e acesso ao banco SQLite.

Datas em UTC **sem fuso**: o SQLite devolve datetime sem fuso, e comparar um
datetime com fuso com outro sem fuso levanta TypeError.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool


def agora() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def novo_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    nome: Mapped[str] = mapped_column(String(64), unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    papel: Mapped[str] = mapped_column(String(16))
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=agora)


class Sessao(Base):
    __tablename__ = "sessoes"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    csrf: Mapped[str] = mapped_column(String(64))
    criada_em: Mapped[datetime] = mapped_column(DateTime, default=agora)
    ultimo_uso: Mapped[datetime] = mapped_column(DateTime, default=agora)


class TentativaLogin(Base):
    __tablename__ = "tentativas_login"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(64), index=True)
    ip: Mapped[str] = mapped_column(String(64), index=True)
    sucesso: Mapped[bool] = mapped_column(Boolean)
    criada_em: Mapped[datetime] = mapped_column(DateTime, default=agora, index=True)


class Investigacao(Base):
    __tablename__ = "investigacoes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(16))
    valor: Mapped[str] = mapped_column(String(300))
    veredito: Mapped[str] = mapped_column(String(16))
    nota: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evidencias: Mapped[list[Any]] = mapped_column(JSON, default=list)
    analise: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    reaproveitada: Mapped[bool] = mapped_column(Boolean, default=False)
    criada_em: Mapped[datetime] = mapped_column(DateTime, default=agora, index=True)


def criar_fabrica(url: str) -> sessionmaker:
    opcoes: dict[str, Any] = {}
    if url.startswith("sqlite"):
        opcoes["connect_args"] = {"check_same_thread": False}
    if url in ("sqlite://", "sqlite:///:memory:"):
        opcoes["poolclass"] = StaticPool
    motor = create_engine(url, **opcoes)
    Base.metadata.create_all(motor)
    return sessionmaker(motor, expire_on_commit=False)
