"""Minha conta: os direitos do titular na LGPD (art. 18) — ver, levar e excluir os dados."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from inoxio import auditoria, usuarios
from inoxio.db import Evento, Investigacao, Usuario, agora
from inoxio.seguranca import senhas, sessoes
from inoxio.web.autenticacao import ip_do_cliente
from inoxio.web.dependencias import Contexto, banco, conferir_csrf, sessao_atual, token_csrf

rotas = APIRouter(prefix="/api/conta")


class PedidoExclusao(BaseModel):
    senha: str = Field(max_length=256)


def _data(valor) -> str | None:
    return valor.isoformat() if valor else None


def _perfil(usuario: Usuario) -> dict:
    return {
        "nome": usuario.nome,
        "email": usuario.email,
        "papel": usuario.papel,
        "criado_em": _data(usuario.criado_em),
        "email_confirmado_em": _data(usuario.email_confirmado_em),
        "cota_diaria": usuario.cota_diaria,
        "termos_versao": usuario.termos_versao,
        "termos_aceitos_em": _data(usuario.termos_aceitos_em),
    }


@rotas.get("")
def minha_conta(ctx: Contexto = Depends(sessao_atual)):
    return _perfil(ctx.usuario)


@rotas.get("/dados")
def baixar_meus_dados(ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    """Portabilidade: tudo o que o sistema guarda sobre a pessoa, num JSON só."""
    investigacoes = db.scalars(
        select(Investigacao)
        .where(Investigacao.usuario_id == ctx.usuario.id)
        .order_by(Investigacao.criada_em)
    )
    eventos = db.scalars(
        select(Evento).where(Evento.usuario == ctx.usuario.nome).order_by(Evento.quando)
    )
    dados = {
        "gerado_em": agora().isoformat(),
        "conta": _perfil(ctx.usuario),
        "investigacoes": [
            {
                "tipo": investigacao.tipo,
                "valor": investigacao.valor,
                "veredito": investigacao.veredito,
                "nota": investigacao.nota,
                "criada_em": _data(investigacao.criada_em),
                "evidencias": investigacao.evidencias,
                "analise": investigacao.analise,
            }
            for investigacao in investigacoes
        ],
        "eventos_de_seguranca": [
            {
                "quando": _data(evento.quando),
                "tipo": evento.tipo,
                "ip": evento.ip,
                "detalhe": evento.detalhe,
            }
            for evento in eventos
        ],
    }
    conteudo = json.dumps(dados, ensure_ascii=False, indent=2)
    nome = f"inoxio-meus-dados-{ctx.usuario.nome}.json"
    return Response(
        conteudo,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )


@rotas.post("/excluir", status_code=204)
def excluir_minha_conta(
    request: Request,
    pedido: PedidoExclusao,
    ctx: Contexto = Depends(sessao_atual),
    db: Session = Depends(banco),
):
    conferir_csrf(ctx, token_csrf(request))
    # A senha confirma que é o titular, e não alguém com a sessão aberta num computador alheio.
    if not senhas.conferir(ctx.usuario.senha_hash, pedido.senha):
        return JSONResponse({"erro": "Senha incorreta."}, status_code=403)
    try:
        usuarios.excluir(db, ctx.usuario)
    except usuarios.Conflito as erro:
        return JSONResponse({"erro": str(erro)}, status_code=409)
    # Sem o nome: o evento fica como prova de que o pedido foi atendido.
    auditoria.registrar(db, "conta_excluida", ip_do_cliente(request), None, "a pedido do titular")
    db.commit()
    resposta = Response(status_code=204)
    resposta.delete_cookie(
        sessoes.NOME_COOKIE, path="/", secure=True, httponly=True, samesite="strict"
    )
    return resposta
