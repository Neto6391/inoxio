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
    TrocaEmail,
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
VALIDADE_TROCA_EMAIL = timedelta(hours=24)
NOME_EXIBICAO_MAXIMO = 80
# Muda quando o texto dos Termos ou da Política mudar: quem aceitou outra versão
# precisa aceitar de novo.
VERSAO_TERMOS = "2026-10-23"


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
    da primeira vez o e-mail está confirmado, e uma conta desativada ou recusada pelo
    admin não volta por aqui.
    """
    ativacao = db.get(Ativacao, _hash(token)) if token else None
    if ativacao is None or ativacao.expira_em < agora():
        return None
    usuario = db.get(Usuario, ativacao.usuario_id)
    if usuario is None or not pendente(usuario):
        return None
    usuario.ativo = True
    usuario.email_confirmado_em = agora()
    db.execute(delete(Ativacao).where(Ativacao.usuario_id == usuario.id))
    return usuario


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
    sessoes.fechar_todas(db, usuario.id, "senha redefinida pelo e-mail")
    return usuario


def definir_nome_exibicao(usuario: Usuario, texto: str) -> None:
    """Em branco volta a mostrar o nome de usuário."""
    limpo = " ".join(texto.split())
    if len(limpo) > NOME_EXIBICAO_MAXIMO:
        raise ValueError(f"O nome pode ter até {NOME_EXIBICAO_MAXIMO} caracteres.")
    if any(not caractere.isprintable() for caractere in limpo):
        raise ValueError("O nome tem caracteres que não aparecem na tela.")
    usuario.nome_exibicao = limpo or None


def trocar_propria_senha(db: Session, usuario: Usuario, nova: str, sessao_mantida: str) -> None:
    """Quem trocou segue nesta sessão; as outras caem."""
    usuario.senha_hash = gerar_hash(nova)
    sessoes.fechar_todas(db, usuario.id, "senha trocada pelo titular", exceto=sessao_mantida)


def abrir_troca_email(db: Session, usuario: Usuario, email_novo: str) -> str:
    """Token de uso único para o link mandado ao e-mail novo; o banco guarda só o hash.
    Um pedido novo da mesma conta cancela o anterior, e os vencidos de todas saem."""
    db.execute(
        delete(TrocaEmail).where(
            (TrocaEmail.usuario_id == usuario.id) | (TrocaEmail.expira_em < agora())
        )
    )
    token = secrets.token_urlsafe(32)
    db.add(
        TrocaEmail(
            token_hash=_hash(token),
            usuario_id=usuario.id,
            email_novo=email_novo,
            expira_em=agora() + VALIDADE_TROCA_EMAIL,
        )
    )
    return token


def troca_email_pendente(db: Session, usuario: Usuario) -> str | None:
    pedido = db.scalar(
        select(TrocaEmail).where(
            TrocaEmail.usuario_id == usuario.id, TrocaEmail.expira_em >= agora()
        )
    )
    return pedido.email_novo if pedido else None


def confirmar_troca_email(db: Session, token: str) -> tuple[Usuario, str | None] | None:
    """Troca o e-mail da conta do token e devolve (conta, e-mail antigo). Token vencido ou
    desconhecido, conta desativada ou e-mail tomado por outra conta nesse meio-tempo não
    trocam nada."""
    pedido = db.get(TrocaEmail, _hash(token)) if token else None
    if pedido is None or pedido.expira_em < agora():
        return None
    usuario = db.get(Usuario, pedido.usuario_id)
    tomado = db.scalar(select(Usuario.id).where(Usuario.email == pedido.email_novo))
    if usuario is None or not usuario.ativo or tomado is not None:
        return None
    antigo = usuario.email
    usuario.email = pedido.email_novo
    usuario.email_confirmado_em = agora()
    db.execute(delete(TrocaEmail).where(TrocaEmail.usuario_id == usuario.id))
    return usuario, antigo


def alterar(
    db: Session,
    alvo: Usuario,
    quem_altera: Usuario,
    *,
    papel: str | None = None,
    senha: str | None = None,
    ativo: bool | None = None,
    cota_diaria: int | None = None,
    sem_cota: bool = False,
    zerar_uso: bool = False,
    encerrar_sessoes: bool = False,
    sessao_mantida: str | None = None,
) -> None:
    """Muda papel, senha, cota ou situação. Senha nova ou desativação derruba as sessões,
    menos a `sessao_mantida` (o hash do token): o admin que troca a própria senha segue
    dentro. `sem_cota` tira a cota diária; `cota_diaria=None` só deixa como está.
    `zerar_uso` devolve os créditos de hoje; `encerrar_sessoes` derruba as sessões sem
    desativar a conta. O admin não tem cota: virar admin tira a que havia."""
    if papel is not None:
        _conferir_papel(papel)
    if cota_diaria is not None and not 1 <= cota_diaria <= 10_000:
        raise ValueError("A cota diária precisa ficar entre 1 e 10.000 investigações.")
    if sem_cota and cota_diaria is not None:
        raise ValueError("Informe a cota ou peça para tirá-la, não as duas coisas.")
    if cota_diaria is not None and (papel or alvo.papel) == "admin":
        raise ValueError("O admin não tem cota diária.")
    novo_hash = gerar_hash(senha) if senha is not None else None
    if ativo is False and alvo.id == quem_altera.id:
        raise Conflito("Você não pode desativar a própria conta.")
    if papel is not None and papel != alvo.papel and alvo.id == quem_altera.id:
        # Trocar o próprio papel tranca o admin do lado de fora, como desativar a conta.
        raise Conflito("Você não pode mudar o próprio papel. Peça a outro admin.")
    deixa_de_ser_admin = (
        alvo.papel == "admin"
        and alvo.ativo
        and (ativo is False or (papel is not None and papel != "admin"))
    )
    if deixa_de_ser_admin and _admins_ativos(db) <= 1:
        raise Conflito("Precisa sobrar pelo menos um admin ativo.")
    if papel is not None:
        alvo.papel = papel
        if papel == "admin":
            alvo.cota_diaria = None
    if novo_hash is not None:
        alvo.senha_hash = novo_hash
    if ativo is not None:
        # Ativar pela tela também vale como confirmação para quem ainda esperava o e-mail,
        # ou para a conta que o admin tinha recusado.
        if ativo and (pendente(alvo) or alvo.recusada_em is not None):
            alvo.email_confirmado_em = agora()
            alvo.recusada_em = None
        # Desativar quem ainda esperava o e-mail é recusar: o link e um cadastro novo
        # com o mesmo e-mail não a ativam mais.
        if not ativo and pendente(alvo):
            alvo.recusada_em = agora()
        alvo.ativo = ativo
    if cota_diaria is not None:
        alvo.cota_diaria = cota_diaria
    if sem_cota:
        alvo.cota_diaria = None
    if zerar_uso:
        alvo.uso_zerado_em = agora()
    if ativo is False:
        motivo = "conta desativada pelo admin"
    elif novo_hash is not None:
        motivo = "senha trocada pelo admin"
    elif encerrar_sessoes:
        motivo = "encerrada pelo admin"
    else:
        return
    sessoes.fechar_todas(db, alvo.id, motivo, exceto=sessao_mantida)


def _admins_ativos(db: Session) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Usuario)
        .where(Usuario.papel == "admin", Usuario.ativo.is_(True))
    )


def excluir(db: Session, usuario: Usuario) -> None:
    """Exclusão a pedido do titular (LGPD, art. 18): apaga a conta, as investigações,
    as sessões, as ativações, os pedidos de senha nova e de troca de e-mail. Os eventos de segurança ficam, sem o nome."""
    if usuario.papel == "admin" and usuario.ativo and _admins_ativos(db) <= 1:
        raise Conflito("O último admin ativo não pode excluir a própria conta.")
    db.execute(delete(Investigacao).where(Investigacao.usuario_id == usuario.id))
    db.execute(delete(Sessao).where(Sessao.usuario_id == usuario.id))
    db.execute(delete(Ativacao).where(Ativacao.usuario_id == usuario.id))
    db.execute(delete(RedefinicaoSenha).where(RedefinicaoSenha.usuario_id == usuario.id))
    db.execute(delete(TrocaEmail).where(TrocaEmail.usuario_id == usuario.id))
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
    # O admin que abriu uma investigação dela deixou "indicador (de nome, id)".
    for evento in db.scalars(select(Evento).where(Evento.tipo == "investigacao_alheia")):
        dela = f"(de {usuario.nome}, "
        if dela in (evento.detalhe or ""):
            evento.detalhe = evento.detalhe.replace(dela, "(de conta excluída, ")
    db.delete(usuario)
