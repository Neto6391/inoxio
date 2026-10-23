"""Senhas: o hash, o link de senha nova e a troca da própria senha."""

from __future__ import annotations

import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import delete
from sqlalchemy.orm import Session

from inoxio.contas import sessoes
from inoxio.contas.modelos import (
    RedefinicaoSenha,
    Usuario,
)
from inoxio.contas.regras import hash_do_token, pode_redefinir
from inoxio.plataforma.banco import agora

# O link de senha nova vale menos: ele dá acesso a uma conta que já existe.
VALIDADE_REDEFINICAO = timedelta(hours=1)


def abrir_redefinicao(db: Session, usuario: Usuario) -> str:
    """Token de uso único para o link de senha nova. Os links anteriores da conta continuam
    valendo até vencer ou até a senha ser trocada: qualquer um pode pedir com o e-mail de
    outra pessoa, e isso não pode derrubar o link que a dona pediu. Os vencidos de todas
    as contas saem do banco."""
    db.execute(delete(RedefinicaoSenha).where(RedefinicaoSenha.expira_em < agora()))
    token = secrets.token_urlsafe(32)
    db.add(
        RedefinicaoSenha(
            token_hash=hash_do_token(token),
            usuario_id=usuario.id,
            expira_em=agora() + VALIDADE_REDEFINICAO,
        )
    )
    return token


def redefinir_senha(db: Session, token: str, senha: str) -> Usuario | None:
    """Troca a senha da conta do token e derruba as sessões. Token vencido, desconhecido
    ou de conta que deixou de poder redefinir não troca nada. Senha curta levanta
    ValueError antes de gastar o link."""
    pedido = db.get(RedefinicaoSenha, hash_do_token(token)) if token else None
    if pedido is None or pedido.expira_em < agora():
        return None
    usuario = db.get(Usuario, pedido.usuario_id)
    if not pode_redefinir(usuario):
        return None
    usuario.senha_hash = gerar_hash(senha)
    db.execute(delete(RedefinicaoSenha).where(RedefinicaoSenha.usuario_id == usuario.id))
    sessoes.fechar_todas(db, usuario.id, "senha redefinida pelo e-mail")
    return usuario


def trocar_propria_senha(db: Session, usuario: Usuario, nova: str, sessao_mantida: str) -> None:
    """Quem trocou segue nesta sessão; as outras caem."""
    usuario.senha_hash = gerar_hash(nova)
    sessoes.fechar_todas(db, usuario.id, "senha trocada pelo titular", exceto=sessao_mantida)


TAMANHO_MINIMO = 12


_hasher = PasswordHasher()


# Usuário inexistente confere contra este hash, para o tempo de resposta não
# revelar quais usuários existem.
_SENHA_FALSA = "hash-falso-que-so-serve-para-gastar-tempo"
_HASH_FALSO = _hasher.hash(_SENHA_FALSA)


def gerar_hash(senha: str) -> str:
    if len(senha) < TAMANHO_MINIMO:
        raise ValueError(f"A senha precisa de pelo menos {TAMANHO_MINIMO} caracteres.")
    return _hasher.hash(senha)


def conferir(senha_hash: str | None, senha: str) -> bool:
    try:
        certo = _hasher.verify(senha_hash or _HASH_FALSO, senha)
    except (VerificationError, InvalidHashError):
        return False
    return certo and senha_hash is not None
