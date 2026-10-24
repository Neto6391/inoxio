"""Rotas dos números: as estatísticas do usuário e do sistema, e os créditos."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from inoxio.investigacoes import cota, estatisticas
from inoxio.web.dependencias import (
    Contexto,
    banco,
    exigir_admin,
    sessao_atual,
)

rotas = APIRouter(prefix="/api")


@rotas.get("/estatisticas/geral")
def estatisticas_gerais(ctx: Contexto = Depends(exigir_admin), db: Session = Depends(banco)):
    return estatisticas.geral(db)


@rotas.get("/estatisticas")
def minhas_estatisticas(ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    return estatisticas.do_usuario(db, ctx.usuario.id)


@rotas.get("/creditos")
def meus_creditos(ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    return cota.creditos(db, ctx.usuario)
