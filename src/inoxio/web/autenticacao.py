"""API de sessão: login, logout e quem está logado."""

from __future__ import annotations

import threading

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

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


def _ip(request: Request) -> str:
    # Com o ProxyHeadersMiddleware, só a borda confiável consegue declarar o IP.
    return request.client.host if request.client else "desconhecido"


def _sessao_json(usuario: Usuario, sessao: Sessao) -> dict:
    return {"usuario": {"nome": usuario.nome, "papel": usuario.papel}, "csrf": sessao.csrf}


@rotas.post("/login")
def entrar(request: Request, credenciais: Credenciais, db: Session = Depends(banco)):
    with _UM_LOGIN_POR_VEZ:
        return _entrar(request, credenciais, db)


def _entrar(request: Request, credenciais: Credenciais, db: Session):
    ip = _ip(request)
    if limites.login_bloqueado(db, credenciais.nome, ip):
        return JSONResponse({"erro": BLOQUEADO}, status_code=429)
    usuario = db.scalar(select(Usuario).where(Usuario.nome == credenciais.nome))
    senha_correta = senhas.conferir(usuario.senha_hash if usuario else None, credenciais.senha)
    limites.registrar_tentativa(db, credenciais.nome, ip, sucesso=senha_correta)
    if not senha_correta:
        db.commit()
        return JSONResponse({"erro": INVALIDO}, status_code=401)
    sessoes.fechar(db, request.cookies.get(sessoes.NOME_COOKIE))
    token, sessao = sessoes.abrir(db, usuario)
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
    db.commit()
    resposta = Response(status_code=204)
    resposta.delete_cookie(
        sessoes.NOME_COOKIE, path="/", secure=True, httponly=True, samesite="strict"
    )
    return resposta
