"""Regras das contas que não dependem do banco: nomes, e-mails, papéis, termos e situação."""

from __future__ import annotations

import hashlib
import re

from inoxio.contas.modelos import (
    Usuario,
)
from inoxio.plataforma.banco import agora

PAPEIS = ("admin", "analista")


# Minúsculas, dígitos, ponto, hífen e sublinhado: o nome aparece na tela e nos logs.
NOME_VALIDO = re.compile(r"[a-z0-9._-]{3,32}")
NOME_INVALIDO = "O nome precisa ter de 3 a 32 caracteres: letras minúsculas, dígitos, ponto, hífen ou sublinhado."
EMAIL_VALIDO = re.compile(r"[^@\s]{1,64}@[a-z0-9.-]{1,185}\.[a-z]{2,63}")
EMAIL_INVALIDO = "Informe um e-mail válido."


# Muda quando o texto dos Termos ou da Política mudar: quem aceitou outra versão
# precisa aceitar de novo.
VERSAO_TERMOS = "2026-10-23"


class Conflito(Exception):
    """A mudança deixaria o sistema sem quem o administre."""


def conferir_papel(papel: str) -> None:
    if papel not in PAPEIS:
        raise ValueError(f"O papel precisa ser um de: {', '.join(PAPEIS)}.")


def normalizar_email(email: str) -> str:
    email = email.strip().lower()
    if len(email) > 254 or not EMAIL_VALIDO.fullmatch(email):
        raise ValueError(EMAIL_INVALIDO)
    return email


def aceitar_termos(usuario: Usuario) -> None:
    usuario.termos_versao = VERSAO_TERMOS
    usuario.termos_aceitos_em = agora()


def termos_pendentes(usuario: Usuario) -> bool:
    return usuario.termos_versao != VERSAO_TERMOS


def hash_do_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


SITUACOES = ("ativa", "desativada", "aguardando", "recusada")


def situacao(usuario: Usuario) -> str:
    if usuario.ativo:
        return "ativa"
    if pendente(usuario):
        return "aguardando"
    return "recusada" if usuario.recusada_em is not None else "desativada"


def pendente(usuario: Usuario) -> bool:
    """Espera a confirmação do e-mail. Conta recusada pelo admin não espera mais nada."""
    return (
        usuario.email is not None
        and usuario.email_confirmado_em is None
        and usuario.recusada_em is None
    )


def pode_redefinir(usuario: Usuario | None) -> bool:
    """Só conta ativa com e-mail confirmado recebe o link: conta pendente se ativa pelo
    cadastro, e conta desativada pelo admin não volta por aqui."""
    return (
        usuario is not None
        and usuario.ativo
        and usuario.email is not None
        and usuario.email_confirmado_em is not None
    )
