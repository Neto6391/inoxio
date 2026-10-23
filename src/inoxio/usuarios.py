"""Regras para criar um usuário, as mesmas no terminal e na tela do admin."""

from __future__ import annotations

import hashlib
import re
import secrets
from datetime import timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from inoxio.db import (
    Ativacao,
    Evento,
    Investigacao,
    RedefinicaoSenha,
    Sessao,
    TentativaLogin,
    Usuario,
    agora,
)
from inoxio.seguranca import sessoes
from inoxio.seguranca.senhas import gerar_hash

PAPEIS = ("admin", "analista")
# Minúsculas, dígitos, ponto, hífen e sublinhado: o nome aparece na tela e nos logs.
NOME_VALIDO = re.compile(r"[a-z0-9._-]{3,32}")
NOME_INVALIDO = "O nome precisa ter de 3 a 32 caracteres: letras minúsculas, dígitos, ponto, hífen ou sublinhado."
EMAIL_VALIDO = re.compile(r"[^@\s]{1,64}@[a-z0-9.-]{1,185}\.[a-z]{2,63}")
EMAIL_INVALIDO = "Informe um e-mail válido."
# Quem se cadastra sozinho começa com esta cota; o admin pode mudar.
COTA_CADASTRO = 10
VALIDADE_ATIVACAO = timedelta(hours=24)
# O link de senha nova vale menos: ele dá acesso a uma conta que já existe.
VALIDADE_REDEFINICAO = timedelta(hours=1)
# Muda quando o texto dos Termos ou da Política mudar: quem aceitou outra versão
# precisa aceitar de novo.
VERSAO_TERMOS = "2026-10-22"


class Conflito(Exception):
    """A mudança deixaria o sistema sem quem o administre."""


def _conferir_papel(papel: str) -> None:
    if papel not in PAPEIS:
        raise ValueError(f"O papel precisa ser um de: {', '.join(PAPEIS)}.")


def normalizar_email(email: str) -> str:
    email = email.strip().lower()
    if len(email) > 254 or not EMAIL_VALIDO.fullmatch(email):
        raise ValueError(EMAIL_INVALIDO)
    return email


def criar(
    db: Session,
    nome: str,
    papel: str,
    senha: str,
    *,
    email: str | None = None,
    ativo: bool = True,
    cota_diaria: int | None = None,
    aceitou_termos: bool = False,
) -> Usuario:
    """Levanta ValueError com a mensagem para o usuário; nome ou e-mail repetido vira
    IntegrityError no commit. O admin e o cadastro público passam por aqui."""
    if not NOME_VALIDO.fullmatch(nome):
        raise ValueError(NOME_INVALIDO)
    _conferir_papel(papel)
    usuario = Usuario(
        nome=nome,
        senha_hash=gerar_hash(senha),
        papel=papel,
        email=normalizar_email(email) if email is not None else None,
        ativo=ativo,
        cota_diaria=cota_diaria,
    )
    if aceitou_termos:
        aceitar_termos(usuario)
    db.add(usuario)
    return usuario


def aceitar_termos(usuario: Usuario) -> None:
    usuario.termos_versao = VERSAO_TERMOS
    usuario.termos_aceitos_em = agora()


def termos_pendentes(usuario: Usuario) -> bool:
    return usuario.termos_versao != VERSAO_TERMOS


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def abrir_ativacao(db: Session, usuario: Usuario) -> str:
    """Token de uso único para o link do e-mail; o banco guarda só o hash.
    Um link novo cancela os anteriores da mesma conta, e os vencidos de todas saem do banco."""
    db.execute(
        delete(Ativacao).where((Ativacao.usuario_id == usuario.id) | (Ativacao.expira_em < agora()))
    )
    token = secrets.token_urlsafe(32)
    db.add(
        Ativacao(
            token_hash=_hash(token), usuario_id=usuario.id, expira_em=agora() + VALIDADE_ATIVACAO
        )
    )
    return token


def ativar(db: Session, token: str) -> Usuario | None:
    """Ativa a conta pendente do token. Token vencido ou desconhecido não ativa nada.

    O link é de uso único porque só conta que ainda espera o e-mail é ativada: depois
    da primeira vez o e-mail está confirmado, e uma conta desativada pelo admin não
    volta por aqui.
    """
    ativacao = db.get(Ativacao, _hash(token)) if token else None
    if ativacao is None or ativacao.expira_em < agora():
        return None
    usuario = db.get(Usuario, ativacao.usuario_id)
    if usuario is None or usuario.email_confirmado_em is not None:
        return None
    usuario.ativo = True
    usuario.email_confirmado_em = agora()
    db.execute(delete(Ativacao).where(Ativacao.usuario_id == usuario.id))
    return usuario


def pendente(usuario: Usuario) -> bool:
    return usuario.email is not None and usuario.email_confirmado_em is None


def pode_redefinir(usuario: Usuario | None) -> bool:
    """Só conta ativa com e-mail confirmado recebe o link: conta pendente se ativa pelo
    cadastro, e conta desativada pelo admin não volta por aqui."""
    return (
        usuario is not None
        and usuario.ativo
        and usuario.email is not None
        and usuario.email_confirmado_em is not None
    )


def abrir_redefinicao(db: Session, usuario: Usuario) -> str:
    """Token de uso único para o link de senha nova. Os links anteriores da conta continuam
    valendo até vencer ou até a senha ser trocada: qualquer um pode pedir com o e-mail de
    outra pessoa, e isso não pode derrubar o link que a dona pediu. Os vencidos de todas
    as contas saem do banco."""
    db.execute(delete(RedefinicaoSenha).where(RedefinicaoSenha.expira_em < agora()))
    token = secrets.token_urlsafe(32)
    db.add(
        RedefinicaoSenha(
            token_hash=_hash(token),
            usuario_id=usuario.id,
            expira_em=agora() + VALIDADE_REDEFINICAO,
        )
    )
    return token


def redefinir_senha(db: Session, token: str, senha: str) -> Usuario | None:
    """Troca a senha da conta do token e derruba as sessões. Token vencido, desconhecido
    ou de conta que deixou de poder redefinir não troca nada. Senha curta levanta
    ValueError antes de gastar o link."""
    pedido = db.get(RedefinicaoSenha, _hash(token)) if token else None
    if pedido is None or pedido.expira_em < agora():
        return None
    usuario = db.get(Usuario, pedido.usuario_id)
    if not pode_redefinir(usuario):
        return None
    usuario.senha_hash = gerar_hash(senha)
    db.execute(delete(RedefinicaoSenha).where(RedefinicaoSenha.usuario_id == usuario.id))
    sessoes.fechar_todas(db, usuario.id)
    return usuario


def alterar(
    db: Session,
    alvo: Usuario,
    quem_altera: Usuario,
    *,
    papel: str | None = None,
    senha: str | None = None,
    ativo: bool | None = None,
    cota_diaria: int | None = None,
) -> None:
    """Muda papel, senha, cota ou situação. Senha nova ou desativação derruba as sessões."""
    if papel is not None:
        _conferir_papel(papel)
    if cota_diaria is not None and not 1 <= cota_diaria <= 10_000:
        raise ValueError("A cota diária precisa ficar entre 1 e 10.000 investigações.")
    novo_hash = gerar_hash(senha) if senha is not None else None
    if ativo is False and alvo.id == quem_altera.id:
        raise Conflito("Você não pode desativar a própria conta.")
    deixa_de_ser_admin = (
        alvo.papel == "admin"
        and alvo.ativo
        and (ativo is False or (papel is not None and papel != "admin"))
    )
    if deixa_de_ser_admin and _admins_ativos(db) <= 1:
        raise Conflito("Precisa sobrar pelo menos um admin ativo.")
    if papel is not None:
        alvo.papel = papel
    if novo_hash is not None:
        alvo.senha_hash = novo_hash
    if ativo is not None:
        alvo.ativo = ativo
        # Ativar pela tela também vale como confirmação para quem ainda esperava o e-mail.
        if ativo and pendente(alvo):
            alvo.email_confirmado_em = agora()
    if cota_diaria is not None:
        alvo.cota_diaria = cota_diaria
    if novo_hash is not None or ativo is False:
        sessoes.fechar_todas(db, alvo.id)


def _admins_ativos(db: Session) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Usuario)
        .where(Usuario.papel == "admin", Usuario.ativo.is_(True))
    )


def excluir(db: Session, usuario: Usuario) -> None:
    """Exclusão a pedido do titular (LGPD, art. 18): apaga a conta, as investigações,
    as sessões, as ativações e os pedidos de senha nova. Os eventos de segurança ficam, sem o nome."""
    if usuario.papel == "admin" and usuario.ativo and _admins_ativos(db) <= 1:
        raise Conflito("O último admin ativo não pode excluir a própria conta.")
    db.execute(delete(Investigacao).where(Investigacao.usuario_id == usuario.id))
    db.execute(delete(Sessao).where(Sessao.usuario_id == usuario.id))
    db.execute(delete(Ativacao).where(Ativacao.usuario_id == usuario.id))
    db.execute(delete(RedefinicaoSenha).where(RedefinicaoSenha.usuario_id == usuario.id))
    db.execute(delete(TentativaLogin).where(TentativaLogin.nome == usuario.nome))
    db.execute(update(Evento).where(Evento.usuario == usuario.nome).values(usuario=None))
    # O admin que cadastrou ou alterou a conta deixou o nome dela no detalhe:
    # "nome (papel)" e "nome: o que mudou".
    prefixos = (f"{usuario.nome} (", f"{usuario.nome}:")
    for evento in db.scalars(
        select(Evento).where(Evento.tipo.in_(("admin_cadastrou", "admin_alterou")))
    ):
        if (evento.detalhe or "").startswith(prefixos):
            evento.detalhe = "conta excluída" + evento.detalhe[len(usuario.nome) :]
    db.delete(usuario)
