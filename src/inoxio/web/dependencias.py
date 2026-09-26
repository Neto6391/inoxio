"""Dependências de acesso: banco, sessão e CSRF."""

from __future__ import annotations

import hmac
from collections.abc import Iterator
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from inoxio.db import Sessao, Usuario
from inoxio.seguranca import sessoes

CABECALHO_CSRF = "X-CSRF-Token"


def banco(request: Request) -> Iterator[Session]:
    with request.app.state.fabrica() as db:
        yield db


@dataclass
class Contexto:
    usuario: Usuario
    sessao: Sessao


def sessao_opcional(request: Request, db: Session = Depends(banco)) -> Contexto | None:
    valida = sessoes.validar(db, request.cookies.get(sessoes.NOME_COOKIE))
    db.commit()  # grava o último uso, ou a remoção da sessão vencida
    return Contexto(*valida) if valida else None


def sessao_atual(ctx: Contexto | None = Depends(sessao_opcional)) -> Contexto:
    if ctx is None:
        raise HTTPException(status_code=401)
    return ctx


def exigir_admin(ctx: Contexto = Depends(sessao_atual)) -> Contexto:
    if ctx.usuario.papel != "admin":
        raise HTTPException(status_code=403)
    return ctx


def conferir_csrf(ctx: Contexto, token: str) -> None:
    if not hmac.compare_digest(ctx.sessao.csrf.encode(), token.encode()):
        raise HTTPException(status_code=403)


def token_csrf(request: Request) -> str:
    return request.headers.get(CABECALHO_CSRF, "")
