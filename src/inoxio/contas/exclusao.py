"""Exclusão da conta a pedido do titular (LGPD, art. 18)."""

from __future__ import annotations

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from inoxio.auditoria.modelos import Evento
from inoxio.contas.administracao import admins_ativos
from inoxio.contas.modelos import (
    Ativacao,
    RedefinicaoSenha,
    Sessao,
    TentativaLogin,
    TrocaEmail,
    Usuario,
)
from inoxio.contas.regras import Conflito
from inoxio.investigacoes.modelos import Investigacao


def excluir(db: Session, usuario: Usuario) -> None:
    """Exclusão a pedido do titular (LGPD, art. 18): apaga a conta, as investigações,
    as sessões, as ativações, os pedidos de senha nova e de troca de e-mail. Os eventos de segurança ficam, sem o nome."""
    if usuario.papel == "admin" and usuario.ativo and admins_ativos(db) <= 1:
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
