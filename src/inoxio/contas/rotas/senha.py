"""Esqueci a senha: link de uso único por e-mail, sem revelar quem tem conta."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from inoxio.auditoria import trilha
from inoxio.contas import credenciais, emails, regras
from inoxio.contas.modelos import Usuario
from inoxio.web.dependencias import banco, ip_do_cliente

rotas = APIRouter(prefix="/api/senha")


PEDIDOS_POR_IP = 5


# Por conta, de qualquer IP: ninguém enche a caixa de outra pessoa trocando de endereço.
EMAILS_POR_CONTA = 3
JANELA_PEDIDOS = timedelta(hours=1)
LINK_INVALIDO = "Link inválido ou vencido. Peça outro em Esqueci minha senha."


class PedidoSenha(BaseModel):
    email: str = Field(max_length=254)


class SenhaNova(BaseModel):
    token: str = Field(max_length=128)
    senha: str = Field(max_length=256)


@rotas.post("/esqueci", status_code=202)
def esqueci(
    request: Request, pedido: PedidoSenha, tarefas: BackgroundTasks, db: Session = Depends(banco)
):
    ip = ip_do_cliente(request)
    if trilha.contar_do_ip(db, "senha_pedida", ip, JANELA_PEDIDOS) >= PEDIDOS_POR_IP:
        return JSONResponse({"erro": "Muitos pedidos deste endereço. Tente mais tarde."}, 429)
    try:
        email = regras.normalizar_email(pedido.email)
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    enviar = request.app.state.enviar_email
    # A mesma resposta com ou sem conta: a tela não revela quem tem conta.
    resposta = {
        "mensagem": "Se houver uma conta ativa com esse e-mail, enviamos um link para criar "
        "uma senha nova. Ele vale por 1 hora."
        if enviar
        else "O envio de e-mail está desligado: peça ao administrador para trocar a sua senha."
    }
    usuario = db.scalar(select(Usuario).where(Usuario.email == email))
    token = None
    if (
        enviar
        and regras.pode_redefinir(usuario)
        # O evento leva o nome só quando há envio: conta os links mandados à conta.
        and trilha.contar_da_conta(db, "senha_pedida", usuario.nome, JANELA_PEDIDOS)
        < EMAILS_POR_CONTA
    ):
        token = credenciais.abrir_redefinicao(db, usuario)
    # O e-mail digitado não entra na auditoria: pode ser de quem nunca teve conta.
    trilha.registrar(db, "senha_pedida", ip, usuario.nome if token else None)
    db.commit()
    if token:
        aviso = emails.senha_nova(usuario.nome, emails.link(request, "redefinir", token))
        emails.agendar(tarefas, enviar, usuario.email, aviso)
    return resposta


@rotas.post("/redefinir")
def redefinir(request: Request, pedido: SenhaNova, db: Session = Depends(banco)):
    try:
        usuario = credenciais.redefinir_senha(db, pedido.token, pedido.senha)
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    if usuario is None:
        return JSONResponse({"erro": LINK_INVALIDO}, status_code=400)
    trilha.registrar(db, "senha_redefinida", ip_do_cliente(request), usuario.nome)
    db.commit()
    return {"mensagem": "Senha trocada. Já pode entrar com a senha nova."}
