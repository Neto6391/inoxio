"""Modelos e acesso ao banco SQLite.

Datas em UTC **sem fuso**: o SQLite devolve datetime sem fuso, e comparar um
datetime com fuso com outro sem fuso levanta TypeError.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.engine import Engine
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
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    # Só quem se cadastrou sozinho tem e-mail; a conta fica inativa até ele ser confirmado.
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    email_confirmado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Investigações por dia; nulo é sem cota além do limite por hora.
    cota_diaria: Mapped[int | None] = mapped_column(Integer, nullable=True)
    onboarding_visto: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")


class Ativacao(Base):
    """Link de ativação do cadastro. O banco guarda só o SHA-256 do token."""

    __tablename__ = "ativacoes"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime)


class Evento(Base):
    """Trilha de auditoria: quem fez o quê, de onde e quando."""

    __tablename__ = "eventos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quando: Mapped[datetime] = mapped_column(DateTime, default=agora, index=True)
    tipo: Mapped[str] = mapped_column(String(32), index=True)
    usuario: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    ip: Mapped[str] = mapped_column(String(64), index=True)
    detalhe: Mapped[str] = mapped_column(String(300), default="")


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
    valor: Mapped[str] = mapped_column(String(2048))
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
    _migrar(motor)
    return sessionmaker(motor, expire_on_commit=False)


# O create_all não acrescenta coluna em tabela que já existe. Bancos criados antes
# de cada coluna ganham a coluna aqui; quem já existia continua ativo.
_COLUNAS_NOVAS = {
    "ativo": "BOOLEAN NOT NULL DEFAULT 1",
    "email": "VARCHAR(254)",
    "email_confirmado_em": "DATETIME",
    "cota_diaria": "INTEGER",
    "onboarding_visto": "BOOLEAN NOT NULL DEFAULT 0",
}


def _migrar(motor: Engine) -> None:
    colunas = {coluna["name"] for coluna in inspect(motor).get_columns("usuarios")}
    with motor.begin() as conexao:
        for coluna, tipo in _COLUNAS_NOVAS.items():
            if coluna not in colunas:
                conexao.execute(text(f"ALTER TABLE usuarios ADD COLUMN {coluna} {tipo}"))
        # Índice à parte: o SQLite não aceita UNIQUE em ALTER TABLE ADD COLUMN.
        conexao.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_email ON usuarios (email)")
        )
