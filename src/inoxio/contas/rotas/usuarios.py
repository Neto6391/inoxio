"""API de usuários, só para o papel admin: listar, cadastrar, editar e desativar."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from inoxio.auditoria import trilha
from inoxio.contas import administracao, registro, regras
from inoxio.contas.administracao import USUARIOS_POR_PAGINA
from inoxio.contas.modelos import Usuario
from inoxio.investigacoes import cota
from inoxio.plataforma import paginacao
from inoxio.web.dependencias import (
    Contexto,
    banco,
    conferir_csrf,
    exigir_admin,
    ip_do_cliente,
    token_csrf,
)

rotas = APIRouter(prefix="/api")


class Alteracao(BaseModel):
    papel: str | None = Field(default=None, max_length=16)
    senha: str | None = Field(default=None, max_length=256)
    ativo: bool | None = None
    # Ausente deixa como está; null tira a cota.
    cota_diaria: int | None = None
    # Devolve os créditos de hoje sem mudar a cota.
    zerar_uso: bool = False
    # Derruba as sessões abertas sem desativar a conta.
    encerrar_sessoes: bool = False

    @property
    def sem_cota(self) -> bool:
        return "cota_diaria" in self.model_fields_set and self.cota_diaria is None


class NovoUsuario(BaseModel):
    nome: str = Field(max_length=64)
    senha: str = Field(max_length=256)
    papel: str = Field(max_length=16)


def _publico(usuario: Usuario) -> dict:
    return {
        "nome": usuario.nome,
        "nome_exibicao": usuario.nome_exibicao,
        "papel": usuario.papel,
        "criado_em": usuario.criado_em.isoformat(),
        "ativo": usuario.ativo,
        "email": usuario.email,
        "pendente": regras.pendente(usuario),
        "cota_diaria": cota.cota_de(usuario),
    }


@rotas.get("/usuarios")
def listar(
    busca: str = Query(default="", max_length=100),
    papel: str | None = None,
    situacao: str | None = None,
    pagina: int = 1,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    contas = administracao.filtrar(db, busca, papel, situacao)
    return paginacao.da_lista(contas, pagina, USUARIOS_POR_PAGINA, _publico)


@rotas.post("/usuarios", status_code=201)
def cadastrar(
    request: Request,
    pedido: NovoUsuario,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    conferir_csrf(ctx, token_csrf(request))
    try:
        usuario = registro.criar(db, pedido.nome, pedido.papel, pedido.senha)
        trilha.registrar(
            db,
            "admin_cadastrou",
            ip_do_cliente(request),
            ctx.usuario.nome,
            f"{pedido.nome} ({pedido.papel})",
            sessao=ctx.sessao.ref,
        )
        db.commit()
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    except IntegrityError:
        db.rollback()
        return JSONResponse({"erro": "Já existe um usuário com esse nome."}, status_code=409)
    return _publico(usuario)


@rotas.patch("/usuarios/{nome}")
def alterar(
    nome: str,
    request: Request,
    pedido: Alteracao,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    conferir_csrf(ctx, token_csrf(request))
    alvo = db.scalar(select(Usuario).where(Usuario.nome == nome))
    if alvo is None:
        raise HTTPException(status_code=404)
    try:
        administracao.alterar(
            db,
            alvo,
            ctx.usuario,
            papel=pedido.papel,
            senha=pedido.senha,
            ativo=pedido.ativo,
            cota_diaria=pedido.cota_diaria,
            sem_cota=pedido.sem_cota,
            zerar_uso=pedido.zerar_uso,
            encerrar_sessoes=pedido.encerrar_sessoes,
            sessao_mantida=ctx.sessao.token_hash,
        )
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    except regras.Conflito as erro:
        return JSONResponse({"erro": str(erro)}, status_code=409)
    trilha.registrar(
        db,
        "admin_alterou",
        ip_do_cliente(request),
        ctx.usuario.nome,
        _o_que_mudou(nome, pedido),
        sessao=ctx.sessao.ref,
    )
    db.commit()
    return _publico(alvo)


def _o_que_mudou(nome: str, pedido: Alteracao) -> str:
    """Resumo da alteração para a auditoria. A senha nova nunca entra, só o fato."""
    partes = []
    if pedido.papel is not None:
        partes.append(f"papel {pedido.papel}")
    if pedido.senha is not None:
        partes.append("senha trocada")
    if pedido.ativo is not None:
        partes.append("ativada" if pedido.ativo else "desativada")
    if pedido.cota_diaria is not None:
        partes.append(f"cota {pedido.cota_diaria}/dia")
    if pedido.sem_cota:
        partes.append("sem cota")
    if pedido.zerar_uso:
        partes.append("uso de hoje zerado")
    if pedido.encerrar_sessoes:
        partes.append("sessões encerradas")
    return f"{nome}: {', '.join(partes) or 'nada'}"
