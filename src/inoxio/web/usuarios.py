"""API de usuários, só para o papel admin: listar, cadastrar, editar e desativar."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from inoxio import auditoria, estatisticas, linha_do_tempo, paginacao, usuarios
from inoxio.db import Evento, Usuario
from inoxio.seguranca import limites
from inoxio.web.autenticacao import ip_do_cliente
from inoxio.web.dependencias import Contexto, banco, conferir_csrf, exigir_admin, token_csrf

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
        "pendente": usuarios.pendente(usuario),
        "cota_diaria": limites.cota_de(usuario),
    }


USUARIOS_POR_PAGINA = 20
SESSOES_POR_PAGINA = 10


@rotas.get("/usuarios")
def listar(
    busca: str = Query(default="", max_length=100),
    papel: str | None = None,
    situacao: str | None = None,
    pagina: int = 1,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    contas = usuarios.filtrar(db, busca, papel, situacao)
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
        usuario = usuarios.criar(db, pedido.nome, pedido.papel, pedido.senha)
        auditoria.registrar(
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
        usuarios.alterar(
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
    except usuarios.Conflito as erro:
        return JSONResponse({"erro": str(erro)}, status_code=409)
    auditoria.registrar(
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


TIPOS_EVENTO = (
    "login",
    "login_falhou",
    "login_bloqueado",
    "logout",
    "cadastro",
    "ativacao",
    "investigacao",
    "investigacao_alheia",
    "admin_cadastrou",
    "admin_alterou",
    "backup",
    "termos_aceitos",
    "conta_excluida",
    "senha_pedida",
    "senha_redefinida",
    "explicacao_pedida",
    "sessao_encerrada",
    "conta_alterada",
    "email_troca_pedida",
    "email_trocado",
)
POR_PAGINA = 50


@rotas.get("/auditoria")
def listar_eventos(
    tipo: str | None = None,
    usuario: str | None = None,
    pagina: int = 1,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    filtro = []
    if tipo:
        filtro.append(Evento.tipo == tipo)
    if usuario:
        filtro.append(Evento.usuario == usuario)
    total = db.scalar(select(func.count()).select_from(Evento).where(*filtro))
    pagina = paginacao.numero(pagina)
    eventos = db.scalars(
        select(Evento)
        .where(*filtro)
        .order_by(Evento.quando.desc(), Evento.id.desc())
        .offset((pagina - 1) * POR_PAGINA)
        .limit(POR_PAGINA)
    )
    return {
        "total": total,
        "por_pagina": POR_PAGINA,
        "tipos": TIPOS_EVENTO,
        "itens": [
            {
                "quando": evento.quando.isoformat(),
                "tipo": evento.tipo,
                "usuario": evento.usuario,
                "ip": evento.ip,
                "detalhe": evento.detalhe,
            }
            for evento in eventos
        ],
    }


@rotas.get("/auditoria/usuarios")
def auditoria_por_usuario(
    busca: str = Query(default="", max_length=100),
    papel: str | None = None,
    situacao: str | None = None,
    pagina: int = 1,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    """A mesma busca e os mesmos filtros da tela de Usuários; a página é contada antes do
    resumo, que só sai para as contas da página."""
    contas = usuarios.filtrar(db, busca, papel, situacao)
    pagina_ = paginacao.da_lista(contas, pagina, USUARIOS_POR_PAGINA)
    pagina_["itens"] = linha_do_tempo.resumo_por_usuario(db, pagina_["itens"])
    return pagina_


@rotas.get("/auditoria/usuarios/{nome}/sessoes")
def sessoes_do_usuario(
    nome: str,
    de: date | None = None,
    ate: date | None = None,
    pagina: int = 1,
    ctx: Contexto = Depends(exigir_admin),
    db: Session = Depends(banco),
):
    if db.scalar(select(Usuario.id).where(Usuario.nome == nome)) is None:
        raise HTTPException(status_code=404)
    dados = linha_do_tempo.sessoes_de(db, nome, de, ate)
    dados["sessoes"] = paginacao.da_lista(dados["sessoes"], pagina, SESSOES_POR_PAGINA)
    return dados


@rotas.get("/estatisticas/geral")
def estatisticas_gerais(ctx: Contexto = Depends(exigir_admin), db: Session = Depends(banco)):
    return estatisticas.geral(db)
