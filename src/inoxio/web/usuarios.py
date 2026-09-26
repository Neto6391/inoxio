"""API de usuários, só para o papel admin: listar e cadastrar."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from inoxio import usuarios
from inoxio.db import Usuario
from inoxio.web.dependencias import Contexto, banco, conferir_csrf, exigir_admin, token_csrf

rotas = APIRouter(prefix="/api")


class NovoUsuario(BaseModel):
    nome: str = Field(max_length=64)
    senha: str = Field(max_length=256)
    papel: str = Field(max_length=16)


def _publico(usuario: Usuario) -> dict:
    return {
        "nome": usuario.nome,
        "papel": usuario.papel,
        "criado_em": usuario.criado_em.isoformat(),
    }


@rotas.get("/usuarios")
def listar(ctx: Contexto = Depends(exigir_admin), db: Session = Depends(banco)):
    return [_publico(usuario) for usuario in db.scalars(select(Usuario).order_by(Usuario.nome))]


@rotas.post("/usuarios", status_code=201)
def cadastrar(
    request: Request,
    pedido: NovoUsuario,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    conferir_csrf(ctx, token_csrf(request))
    try:
        usuario = usuarios.criar(db, pedido.nome, pedido.papel, pedido.senha)
        db.commit()
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    except IntegrityError:
        db.rollback()
        return JSONResponse({"erro": "Já existe um usuário com esse nome."}, status_code=409)
    return _publico(usuario)
