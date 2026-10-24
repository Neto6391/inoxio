"""Esqueci a senha: link de uso único por e-mail, sem revelar quem tem conta."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inoxio.auditoria import trilha
from inoxio.auditoria.modelos import Evento
from inoxio.contas import credenciais, regras
from inoxio.contas.modelos import Usuario
from inoxio.plataforma.banco import agora
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


def _texto_do_email(nome: str, link: str) -> str:
    return (
        f"Olá, {nome}.\n\n"
        "Recebemos um pedido para criar uma senha nova para a sua conta no Inóxio. "
        f"Abra o link abaixo na próxima hora:\n\n{link}\n\n"
        "Se não foi você, ignore esta mensagem: a senha atual continua valendo.\n"
    )


def _emails_recentes(db: Session, nome: str) -> int:
    """Links mandados para a conta na última hora (o evento leva o nome só quando há envio)."""
    return db.scalar(
        select(func.count())
        .select_from(Evento)
        .where(
            Evento.tipo == "senha_pedida",
            Evento.usuario == nome,
            Evento.quando >= agora() - JANELA_PEDIDOS,
        )
    )


@rotas.post("/esqueci", status_code=202)
def esqueci(
    request: Request, pedido: PedidoSenha, tarefas: BackgroundTasks, db: Session = Depends(banco)
):
    ip = ip_do_cliente(request)
    if trilha.contar(db, "senha_pedida", ip, JANELA_PEDIDOS) >= PEDIDOS_POR_IP:
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
        and _emails_recentes(db, usuario.nome) < EMAILS_POR_CONTA
    ):
        token = credenciais.abrir_redefinicao(db, usuario)
    # O e-mail digitado não entra na auditoria: pode ser de quem nunca teve conta.
    trilha.registrar(db, "senha_pedida", ip, usuario.nome if token else None)
    db.commit()
    if token:
        link = f"{request.app.state.config.url_publica}/redefinir#{token}"
        tarefas.add_task(
            enviar, usuario.email, "Senha nova no Inóxio", _texto_do_email(usuario.nome, link)
        )
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
