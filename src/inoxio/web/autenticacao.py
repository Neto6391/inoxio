"""API de sessão: login, logout e quem está logado."""

from __future__ import annotations

import threading

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from inoxio import auditoria, usuarios
from inoxio.db import Sessao, Usuario
from inoxio.seguranca import limites, senhas, sessoes
from inoxio.web.dependencias import (
    Contexto,
    banco,
    conferir_csrf,
    sessao_atual,
    sessao_opcional,
    token_csrf,
)

rotas = APIRouter(prefix="/api")
INVALIDO = "Usuário ou senha inválidos."
BLOQUEADO = "Muitas tentativas. Tente de novo em 15 minutos."
# Conferir o limite, verificar a senha e registrar a tentativa precisam ser
# uma coisa só: em paralelo, várias tentativas leriam a mesma contagem. De
# quebra, só um argon2 roda por vez, o que limita a memória de um ataque.
_UM_LOGIN_POR_VEZ = threading.Lock()


class Credenciais(BaseModel):
    nome: str = Field(max_length=64)
    senha: str = Field(max_length=256)


def ip_do_cliente(request: Request) -> str:
    # Com o ProxyHeadersMiddleware, só a borda confiável consegue declarar o IP.
    return request.client.host if request.client else "desconhecido"


def _sessao_json(usuario: Usuario, sessao: Sessao) -> dict:
    return {
        "usuario": {
            "nome": usuario.nome,
            "nome_exibicao": usuario.nome_exibicao,
            "papel": usuario.papel,
            "onboarding_visto": usuario.onboarding_visto,
            "termos_pendentes": usuarios.termos_pendentes(usuario),
        },
        "csrf": sessao.csrf,
    }


@rotas.post("/login")
def entrar(request: Request, credenciais: Credenciais, db: Session = Depends(banco)):
    with _UM_LOGIN_POR_VEZ:
        return _entrar(request, credenciais, db)


def _entrar(request: Request, credenciais: Credenciais, db: Session):
    ip = ip_do_cliente(request)
    if limites.login_bloqueado(db, credenciais.nome, ip):
        auditoria.registrar(db, "login_bloqueado", ip, credenciais.nome)
        db.commit()
        return JSONResponse({"erro": BLOQUEADO}, status_code=429)
    usuario = db.scalar(select(Usuario).where(Usuario.nome == credenciais.nome))
    # Conta desativada responde como senha errada, e também passa pelo argon2.
    if usuario is not None and not usuario.ativo:
        usuario = None
    senha_correta = senhas.conferir(usuario.senha_hash if usuario else None, credenciais.senha)
    limites.registrar_tentativa(db, credenciais.nome, ip, sucesso=senha_correta)
    if not senha_correta:
        auditoria.registrar(db, "login_falhou", ip, credenciais.nome)
        db.commit()
        return JSONResponse({"erro": INVALIDO}, status_code=401)
    sessoes.fechar(db, request.cookies.get(sessoes.NOME_COOKIE), "outra entrada neste navegador")
    token, sessao = sessoes.abrir(db, usuario)
    auditoria.registrar(db, "login", ip, usuario.nome, sessao=sessao.ref)
    db.commit()
    resposta = JSONResponse(_sessao_json(usuario, sessao))
    resposta.set_cookie(
        sessoes.NOME_COOKIE, token, httponly=True, secure=True, samesite="strict", path="/"
    )
    return resposta


@rotas.get("/sessao")
def sessao_ativa(ctx: Contexto | None = Depends(sessao_opcional)):
    # Sem sessão é 200 com usuário nulo: é a pergunta normal da tela de login.
    if ctx is None:
        return {"usuario": None, "csrf": None}
    return _sessao_json(ctx.usuario, ctx.sessao)


@rotas.post("/logout", status_code=204)
def sair(request: Request, ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    conferir_csrf(ctx, token_csrf(request))
    sessoes.fechar(db, request.cookies.get(sessoes.NOME_COOKIE))
    auditoria.registrar(
        db, "logout", ip_do_cliente(request), ctx.usuario.nome, sessao=ctx.sessao.ref
    )
    db.commit()
    resposta = Response(status_code=204)
    resposta.delete_cookie(
        sessoes.NOME_COOKIE, path="/", secure=True, httponly=True, samesite="strict"
    )
    return resposta


@rotas.post("/sessao/onboarding", status_code=204)
def onboarding_visto(
    request: Request, ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)
):
    """A apresentação de primeiro acesso não volta mais para este usuário."""
    conferir_csrf(ctx, token_csrf(request))
    ctx.usuario.onboarding_visto = True
    db.commit()
    return Response(status_code=204)


@rotas.post("/sessao/termos", status_code=204)
def aceitar_termos(
    request: Request, ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)
):
    """Quem já tinha conta aceita a versão atual dos Termos e da Política."""
    conferir_csrf(ctx, token_csrf(request))
    usuarios.aceitar_termos(ctx.usuario)
    auditoria.registrar(
        db,
        "termos_aceitos",
        ip_do_cliente(request),
        ctx.usuario.nome,
        usuarios.VERSAO_TERMOS,
        sessao=ctx.sessao.ref,
    )
    db.commit()
    return Response(status_code=204)


@rotas.get("/publico")
def informacoes_publicas(request: Request):
    """O que as páginas públicas (Política de Privacidade) precisam saber do servidor."""
    config = request.app.state.config
    return {
        "contato_privacidade": config.contato_privacidade,
        "versao_termos": usuarios.VERSAO_TERMOS,
    }
