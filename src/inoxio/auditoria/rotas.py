"""Rotas da auditoria por usuário, só para o admin."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from inoxio.auditoria import linha_do_tempo
from inoxio.contas import administracao
from inoxio.contas.administracao import USUARIOS_POR_PAGINA
from inoxio.contas.modelos import Usuario
from inoxio.plataforma import paginacao
from inoxio.web.dependencias import (
    Contexto,
    banco,
    exigir_admin,
)

rotas = APIRouter(prefix="/api")


SESSOES_POR_PAGINA = 5


@rotas.get("/auditoria/usuarios")
def auditoria_por_usuario(
    busca: str = Query(default="", max_length=100),
    papel: str | None = None,
    situacao: str | None = None,
    pagina: int = 1,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    """A mesma busca e os mesmos filtros da tela de Usuários; a página é contada antes do
    resumo, que só sai para as contas da página."""
    contas = administracao.filtrar(db, busca, papel, situacao)
    pagina_ = paginacao.da_lista(contas, pagina, USUARIOS_POR_PAGINA)
    pagina_["itens"] = linha_do_tempo.resumo_por_usuario(db, pagina_["itens"])
    return pagina_


@rotas.get("/auditoria/usuarios/{nome}/sessoes")
def sessoes_do_usuario(
    nome: str,
    de: date | None = None,
    ate: date | None = None,
    pagina: int = 1,
    pagina_fora: int = 1,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    """As sessões e os eventos de fora de sessão vêm em páginas próprias, de 5 em 5."""
    if db.scalar(select(Usuario.id).where(Usuario.nome == nome)) is None:
        raise HTTPException(status_code=404)
    dados = linha_do_tempo.sessoes_de(db, nome, de, ate)
    return {
        "sessoes": paginacao.da_lista(dados["sessoes"], pagina, SESSOES_POR_PAGINA),
        "fora_de_sessao": paginacao.da_lista(
            dados["fora_de_sessao"], pagina_fora, SESSOES_POR_PAGINA
        ),
    }
