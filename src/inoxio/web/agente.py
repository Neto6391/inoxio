"""API das investigações: investigar, listar e ver o resultado."""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inoxio import auditoria, estatisticas
from inoxio.agente.classificar import LIMITE_ENTRADA
from inoxio.agente.decidir import ROTULOS
from inoxio.agente.grafo import dados_da_mente
from inoxio.agente.mente import para_exibir
from inoxio.db import Evento, Investigacao, Usuario, agora
from inoxio.explicador import PRAZO
from inoxio.seguranca import limites
from inoxio.web.autenticacao import ip_do_cliente
from inoxio.web.dependencias import Contexto, banco, conferir_csrf, sessao_atual, token_csrf

# A página de investigações mostra as mais recentes; o painel, as primeiras delas.
LISTA = 50
FOLGA_PENDENTE = timedelta(seconds=30)
PEDIDOS_DE_EXPLICACAO_POR_HORA = 10
JANELA_ALHEIA = timedelta(minutes=30)

rotas = APIRouter(prefix="/api")


class PedidoInvestigacao(BaseModel):
    entrada: str = Field(max_length=LIMITE_ENTRADA)


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
        .limit(LISTA)
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
    if limites.investigacao_excedida(db, ctx.usuario.id, ctx.usuario.cota_diaria):
        raise HTTPException(status_code=429)
    estado = request.app.state.grafo.invoke({"entrada": pedido.entrada})
    if estado["tipo"] == "rejeitado":
        return JSONResponse({"erro": estado["motivo"]}, status_code=400)
    analise = estado.get("analise")
    explicador = request.app.state.explicador
    explicar = analise is None and explicador.ativo
    investigacao = Investigacao(
        usuario_id=ctx.usuario.id,
        tipo=estado["tipo"],
        valor=estado["valor"],
        veredito=estado["veredito"],
        nota=estado.get("nota"),
        evidencias=estado["evidencias"],
        analise=analise,
        analise_estado="pronta" if analise else ("pendente" if explicar else "indisponivel"),
        reaproveitada=estado["reaproveitada"],
    )
    db.add(investigacao)
    auditoria.registrar(
        db,
        "investigacao",
        ip_do_cliente(request),
        ctx.usuario.nome,
        f"{estado['tipo']} {estado['valor'][:200]} → {estado['veredito']}",
    )
    db.commit()
    # Depois do commit: o explicador grava a análise numa linha que já existe.
    if explicar:
        explicador.pedir(investigacao.id, dados_da_mente(estado))
    return {"id": investigacao.id}


def _estado_da_analise(investigacao: Investigacao) -> str:
    estado = investigacao.analise_estado
    if estado is None:
        # Investigação de antes da explicação em segundo plano.
        return "pronta" if investigacao.analise else "indisponivel"
    # Uma pendente além do prazo não chega mais (o processo reiniciou, por exemplo).
    pedida_em = investigacao.analise_pedida_em or investigacao.criada_em
    vencida = pedida_em < agora() - PRAZO - FOLGA_PENDENTE
    return "indisponivel" if estado == "pendente" and vencida else estado


@rotas.get("/investigacoes/{id_}")
def ver(
    id_: str,
    request: Request,
    ctx: Contexto = Depends(sessao_atual),
    db: Session = Depends(banco),
):
    investigacao = db.get(Investigacao, id_)
    alheia = investigacao is not None and investigacao.usuario_id != ctx.usuario.id
    if investigacao is None or (alheia and ctx.usuario.papel != "admin"):
        raise HTTPException(status_code=404)
    if alheia:
        _registrar_abertura_alheia(db, request, ctx, investigacao)
    return _resumo(investigacao) | {
        "nota": investigacao.nota,
        "rotulo": ROTULOS[investigacao.veredito],
        "evidencias": investigacao.evidencias,
        "analise": para_exibir(investigacao.analise),
        "analise_estado": _estado_da_analise(investigacao),
        "reaproveitada": investigacao.reaproveitada,
        # Só a dona pede a explicação de novo; o admin que abre a de outra pessoa, não.
        "minha": not alheia,
    }


def _registrar_abertura_alheia(
    db: Session, request: Request, ctx: Contexto, investigacao: Investigacao
) -> None:
    """O admin abrindo a investigação de outra pessoa fica registrado, com a dona e o id:
    o mesmo indicador pode ter sido investigado por várias contas. A tela consulta de novo
    a cada 3 s enquanto a IA escreve; dentro de JANELA_ALHEIA a mesma abertura conta uma vez."""
    dona = db.get(Usuario, investigacao.usuario_id)
    detalhe = f"{investigacao.valor[:200]} (de {dona.nome if dona else '?'}, {investigacao.id})"
    repetida = db.scalar(
        select(func.count())
        .select_from(Evento)
        .where(
            Evento.tipo == "investigacao_alheia",
            Evento.usuario == ctx.usuario.nome,
            Evento.detalhe == detalhe,
            Evento.quando >= agora() - JANELA_ALHEIA,
        )
    )
    if repetida:
        return
    auditoria.registrar(
        db, "investigacao_alheia", ip_do_cliente(request), ctx.usuario.nome, detalhe
    )
    db.commit()


@rotas.post("/investigacoes/{id_}/explicar", status_code=202)
def explicar_de_novo(
    id_: str,
    request: Request,
    ctx: Contexto = Depends(sessao_atual),
    db: Session = Depends(banco),
):
    """Pede de novo a explicação que ficou indisponível. Não gasta crédito: as fontes
    já foram consultadas, só a IA escreve outra vez."""
    conferir_csrf(ctx, token_csrf(request))
    investigacao = db.get(Investigacao, id_)
    if investigacao is None or investigacao.usuario_id != ctx.usuario.id:
        raise HTTPException(status_code=404)
    explicador = request.app.state.explicador
    if not explicador.ativo or _estado_da_analise(investigacao) != "indisponivel":
        return JSONResponse({"erro": "Esta explicação já está pronta ou sendo escrita."}, 409)
    if _pedidos_de_explicacao(db, ctx.usuario.nome) >= PEDIDOS_DE_EXPLICACAO_POR_HORA:
        raise HTTPException(status_code=429)
    investigacao.analise_estado = "pendente"
    investigacao.analise_pedida_em = agora()
    auditoria.registrar(
        db, "explicacao_pedida", ip_do_cliente(request), ctx.usuario.nome, investigacao.valor[:200]
    )
    db.commit()
    estado = {
        "tipo": investigacao.tipo,
        "valor": investigacao.valor,
        "veredito": investigacao.veredito,
        "nota": investigacao.nota,
        "evidencias": investigacao.evidencias,
    }
    explicador.pedir(investigacao.id, dados_da_mente(estado))
    return {"analise_estado": "pendente"}


def _pedidos_de_explicacao(db: Session, nome: str) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Evento)
        .where(
            Evento.tipo == "explicacao_pedida",
            Evento.usuario == nome,
            Evento.quando >= agora() - timedelta(hours=1),
        )
    )


@rotas.get("/estatisticas")
def minhas_estatisticas(ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    return estatisticas.do_usuario(db, ctx.usuario.id)


@rotas.get("/creditos")
def meus_creditos(ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    return limites.creditos(db, ctx.usuario.id, ctx.usuario.cota_diaria)
