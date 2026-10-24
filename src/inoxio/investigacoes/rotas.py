"""API das investigações: investigar, listar e ver o resultado."""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from inoxio.auditoria import trilha
from inoxio.contas.modelos import Usuario
from inoxio.investigacoes import cota
from inoxio.investigacoes.classificar import LIMITE_ENTRADA
from inoxio.investigacoes.decidir import ROTULOS
from inoxio.investigacoes.grafo import dados_da_mente
from inoxio.investigacoes.ia.explicador import PRAZO
from inoxio.investigacoes.ia.filtro import para_exibir
from inoxio.investigacoes.modelos import Investigacao
from inoxio.plataforma import paginacao
from inoxio.plataforma.banco import agora
from inoxio.web.dependencias import (
    Contexto,
    banco,
    conferir_csrf,
    ip_do_cliente,
    sessao_atual,
    token_csrf,
)

INVESTIGACOES_POR_PAGINA = 5
FOLGA_PENDENTE = timedelta(seconds=30)
PEDIDOS_DE_EXPLICACAO_POR_HORA = 10
UMA_HORA = timedelta(hours=1)
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
def listar(
    busca: str = Query(default="", max_length=200),
    pagina: int = 1,
    ctx: Contexto = Depends(sessao_atual),
    db: Session = Depends(banco),
):
    """As investigações do usuário, da mais nova para a mais antiga; a busca procura no
    indicador."""
    filtro = [Investigacao.usuario_id == ctx.usuario.id]
    termo = busca.strip()
    if termo:
        filtro.append(Investigacao.valor.contains(termo, autoescape=True))
    consulta = (
        select(Investigacao)
        .where(*filtro)
        .order_by(Investigacao.criada_em.desc(), Investigacao.id.desc())
    )
    return paginacao.da_consulta(db, consulta, pagina, INVESTIGACOES_POR_PAGINA, _resumo)


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
    if cota.investigacao_excedida(db, ctx.usuario):
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
    trilha.registrar(
        db,
        "investigacao",
        ip_do_cliente(request),
        ctx.usuario.nome,
        f"{estado['tipo']} {estado['valor'][:200]} → {estado['veredito']}",
        sessao=ctx.sessao.ref,
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
    nome = ctx.usuario.nome
    if trilha.contar_da_conta(db, "investigacao_alheia", nome, JANELA_ALHEIA, detalhe):
        return
    ip = ip_do_cliente(request)
    trilha.registrar(db, "investigacao_alheia", ip, nome, detalhe, sessao=ctx.sessao.ref)
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
    if (
        trilha.contar_da_conta(db, "explicacao_pedida", ctx.usuario.nome, UMA_HORA)
        >= PEDIDOS_DE_EXPLICACAO_POR_HORA
    ):
        raise HTTPException(status_code=429)
    investigacao.analise_estado = "pendente"
    investigacao.analise_pedida_em = agora()
    trilha.registrar(
        db,
        "explicacao_pedida",
        ip_do_cliente(request),
        ctx.usuario.nome,
        investigacao.valor[:200],
        sessao=ctx.sessao.ref,
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
