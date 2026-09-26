"""API das investigações: investigar, listar e ver o resultado."""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from inoxio.agente.decidir import ROTULOS
from inoxio.db import Investigacao
from inoxio.seguranca import limites
from inoxio.web.dependencias import Contexto, banco, conferir_csrf, sessao_atual, token_csrf

rotas = APIRouter(prefix="/api")


class PedidoInvestigacao(BaseModel):
    entrada: str = Field(max_length=300)


def _resumo(investigacao: Investigacao) -> dict:
    return {
        "id": investigacao.id,
        "tipo": investigacao.tipo,
        "valor": investigacao.valor,
        "veredito": investigacao.veredito,
        "criada_em": investigacao.criada_em.isoformat(),
    }


@rotas.get("/investigacoes")
def listar(ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    recentes = db.scalars(
        select(Investigacao)
        .where(Investigacao.usuario_id == ctx.usuario.id)
        .order_by(Investigacao.criada_em.desc())
        .limit(10)
    ).all()
    return [_resumo(investigacao) for investigacao in recentes]


# A contagem do limite só enxerga investigações já gravadas, e o grafo leva
# segundos: pedidos em paralelo do mesmo usuário passariam todos. Uma por vez.
_em_andamento: set[str] = set()
_trava = threading.Lock()


@contextmanager
def _uma_por_usuario(usuario_id: str) -> Iterator[None]:
    with _trava:
        if usuario_id in _em_andamento:
            raise HTTPException(status_code=429)
        _em_andamento.add(usuario_id)
    try:
        yield
    finally:
        with _trava:
            _em_andamento.discard(usuario_id)


@rotas.post("/investigacoes", status_code=201)
def investigar(
    request: Request,
    pedido: PedidoInvestigacao,
    ctx: Contexto = Depends(sessao_atual),
    db: Session = Depends(banco),
):
    conferir_csrf(ctx, token_csrf(request))
    with _uma_por_usuario(ctx.usuario.id):
        return _investigar(request, pedido, ctx, db)


def _investigar(request: Request, pedido: PedidoInvestigacao, ctx: Contexto, db: Session):
    if limites.investigacao_excedida(db, ctx.usuario.id):
        raise HTTPException(status_code=429)
    estado = request.app.state.grafo.invoke({"entrada": pedido.entrada})
    if estado["tipo"] == "rejeitado":
        return JSONResponse({"erro": estado["motivo"]}, status_code=400)
    investigacao = Investigacao(
        usuario_id=ctx.usuario.id,
        tipo=estado["tipo"],
        valor=estado["valor"],
        veredito=estado["veredito"],
        nota=estado.get("nota"),
        evidencias=estado["evidencias"],
        analise=estado.get("analise"),
        reaproveitada=estado["reaproveitada"],
    )
    db.add(investigacao)
    db.commit()
    return {"id": investigacao.id}


@rotas.get("/investigacoes/{id_}")
def ver(id_: str, ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    investigacao = db.get(Investigacao, id_)
    alheia = investigacao is not None and investigacao.usuario_id != ctx.usuario.id
    if investigacao is None or (alheia and ctx.usuario.papel != "admin"):
        raise HTTPException(status_code=404)
    return _resumo(investigacao) | {
        "nota": investigacao.nota,
        "rotulo": ROTULOS[investigacao.veredito],
        "evidencias": investigacao.evidencias,
        "analise": investigacao.analise,
        "reaproveitada": investigacao.reaproveitada,
    }
