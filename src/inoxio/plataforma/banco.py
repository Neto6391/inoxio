"""Banco SQLite: a base dos modelos, a fábrica de sessões e as colunas novas.

Datas em UTC **sem fuso**: o SQLite devolve datetime sem fuso, e comparar um
datetime com fuso com outro sem fuso levanta TypeError.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool


def agora() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def novo_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


def criar_fabrica(url: str) -> sessionmaker:
    opcoes: dict[str, Any] = {}
    if url.startswith("sqlite"):
        opcoes["connect_args"] = {"check_same_thread": False}
    if url in ("sqlite://", "sqlite:///:memory:"):
        opcoes["poolclass"] = StaticPool
    motor = create_engine(url, **opcoes)
    # Cada contexto declara as próprias tabelas; importá-los aqui registra todas na Base.
    from inoxio.auditoria import modelos as _auditoria  # noqa: F401
    from inoxio.contas import modelos as _contas  # noqa: F401
    from inoxio.investigacoes import modelos as _investigacoes  # noqa: F401

    Base.metadata.create_all(motor)
    _migrar(motor)
    return sessionmaker(motor, expire_on_commit=False)


# O create_all não acrescenta coluna em tabela que já existe. Bancos criados antes
# de cada coluna ganham a coluna aqui; quem já existia continua ativo.
_COLUNAS_NOVAS = {
    "usuarios": {
        "ativo": "BOOLEAN NOT NULL DEFAULT 1",
        "email": "VARCHAR(254)",
        "email_confirmado_em": "DATETIME",
        "recusada_em": "DATETIME",
        "cota_diaria": "INTEGER",
        "uso_zerado_em": "DATETIME",
        "nome_exibicao": "VARCHAR(80)",
        "onboarding_visto": "BOOLEAN NOT NULL DEFAULT 0",
        "termos_versao": "VARCHAR(16)",
        "termos_aceitos_em": "DATETIME",
    },
    "investigacoes": {
        "analise_estado": "VARCHAR(16)",
        "analise_pedida_em": "DATETIME",
    },
    "sessoes": {"ref": "VARCHAR(16)"},
    "eventos": {"sessao": "VARCHAR(16)"},
}


def _migrar(motor: Engine) -> None:
    inspetor = inspect(motor)
    with motor.begin() as conexao:
        for tabela, novas in _COLUNAS_NOVAS.items():
            colunas = {coluna["name"] for coluna in inspetor.get_columns(tabela)}
            for coluna, tipo in novas.items():
                if coluna not in colunas:
                    conexao.execute(text(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {tipo}"))
        # Índice à parte: o SQLite não aceita UNIQUE em ALTER TABLE ADD COLUMN.
        conexao.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_email ON usuarios (email)")
        )
