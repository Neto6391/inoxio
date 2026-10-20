"""Cadastro público com ativação por e-mail. Usa a mesma regra de criação do admin."""

from __future__ import annotations

import logging
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from inoxio import auditoria, usuarios
from inoxio.db import Usuario
from inoxio.web.autenticacao import ip_do_cliente
from inoxio.web.dependencias import banco

rotas = APIRouter(prefix="/api")
log = logging.getLogger("inoxio.cadastro")

CADASTROS_POR_IP = 5
JANELA_CADASTRO = timedelta(hours=1)
NOME_EM_USO = "Esse nome de usuário já existe. Escolha outro."
LINK_INVALIDO = "Link de ativação inválido ou vencido. Faça o cadastro de novo."


class NovoCadastro(BaseModel):
    nome: str = Field(max_length=64)
    email: str = Field(max_length=254)
    senha: str = Field(max_length=256)


class PedidoAtivacao(BaseModel):
    token: str = Field(max_length=128)


def _texto_do_email(nome: str, link: str) -> str:
    return (
        f"Olá, {nome}.\n\n"
        "Recebemos um cadastro no Inóxio com este e-mail. Para ativar a conta, abra o link "
        f"abaixo nas próximas 24 horas:\n\n{link}\n\n"
        "Se não foi você, ignore esta mensagem: sem a ativação, a conta não entra.\n"
    )


@rotas.post("/cadastro", status_code=202)
def cadastrar(
    request: Request, pedido: NovoCadastro, tarefas: BackgroundTasks, db: Session = Depends(banco)
):
    ip = ip_do_cliente(request)
    if auditoria.contar(db, "cadastro", ip, JANELA_CADASTRO) >= CADASTROS_POR_IP:
        return JSONResponse({"erro": "Muitos cadastros deste endereço. Tente mais tarde."}, 429)
    try:
        email = usuarios.normalizar_email(pedido.email)
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    enviar = request.app.state.enviar_email
    resposta = {
        "mensagem": "Enviamos um link de ativação para o seu e-mail. Ele vale por 24 horas."
        if enviar
        else "Cadastro recebido. O envio de e-mail está desligado: peça ao administrador "
        "para ativar a sua conta."
    }
    # E-mail já cadastrado responde igual a um cadastro novo: a tela não revela quem tem conta.
    if db.scalar(select(Usuario.id).where(Usuario.email == email)):
        auditoria.registrar(db, "cadastro", ip, pedido.nome, "e-mail já cadastrado")
        db.commit()
        return resposta
    try:
        usuario = usuarios.criar(
            db,
            pedido.nome,
            "analista",
            pedido.senha,
            email=email,
            ativo=False,
            cota_diaria=usuarios.COTA_CADASTRO,
        )
        db.flush()
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    except IntegrityError:
        db.rollback()
        return JSONResponse({"erro": NOME_EM_USO}, status_code=409)
    token = usuarios.abrir_ativacao(db, usuario)
    auditoria.registrar(db, "cadastro", ip, usuario.nome)
    db.commit()
    if enviar:
        link = f"{request.app.state.config.url_publica}/ativar#{token}"
        tarefas.add_task(
            enviar, email, "Ative sua conta no Inóxio", _texto_do_email(usuario.nome, link)
        )
    return resposta


@rotas.post("/ativar")
def ativar(request: Request, pedido: PedidoAtivacao, db: Session = Depends(banco)):
    usuario = usuarios.ativar(db, pedido.token)
    if usuario is None:
        return JSONResponse({"erro": LINK_INVALIDO}, status_code=400)
    auditoria.registrar(db, "ativacao", ip_do_cliente(request), usuario.nome)
    db.commit()
    return {"mensagem": "Conta ativada. Já pode entrar."}
