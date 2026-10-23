"""Tabelas das contas: usuário, links de e-mail, sessões e tentativas de login."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from inoxio.plataforma.banco import Base, agora, novo_id


class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    nome: Mapped[str] = mapped_column(String(64), unique=True)
    # Como a pessoa quer ser chamada na tela. O login e a auditoria seguem pelo `nome`.
    nome_exibicao: Mapped[str | None] = mapped_column(String(80), nullable=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    papel: Mapped[str] = mapped_column(String(16))
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=agora)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    # Só quem se cadastrou sozinho tem e-mail; a conta fica inativa até ele ser confirmado.
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    email_confirmado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # O admin barrou a conta antes da confirmação: o link do e-mail não a ativa mais.
    recusada_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Investigações por dia; nulo é sem cota além do limite por hora. O admin não tem cota.
    cota_diaria: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # O admin zerou o uso de hoje: a cota conta só o que veio depois.
    uso_zerado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    onboarding_visto: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    # Versão dos Termos e da Política de Privacidade que o usuário aceitou, e quando.
    termos_versao: Mapped[str | None] = mapped_column(String(16), nullable=True)
    termos_aceitos_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Ativacao(Base):
    """Link de ativação do cadastro. O banco guarda só o SHA-256 do token."""

    __tablename__ = "ativacoes"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime)


class RedefinicaoSenha(Base):
    """Link de "esqueci a senha". O banco guarda só o SHA-256 do token."""

    __tablename__ = "redefinicoes_senha"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime)


class TrocaEmail(Base):
    """Pedido de troca de e-mail: só vale depois do clique no link mandado ao e-mail novo."""

    __tablename__ = "trocas_email"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    email_novo: Mapped[str] = mapped_column(String(254))
    expira_em: Mapped[datetime] = mapped_column(DateTime)


class Sessao(Base):
    __tablename__ = "sessoes"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    # Identifica a sessão na auditoria sem expor nada do token.
    ref: Mapped[str | None] = mapped_column(String(16), nullable=True)
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
