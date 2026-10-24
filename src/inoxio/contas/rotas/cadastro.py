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

from inoxio.auditoria import trilha
from inoxio.contas import emails, registro, regras
from inoxio.contas.modelos import Usuario
from inoxio.plataforma.correio import Enviar
from inoxio.web.dependencias import banco, ip_do_cliente

rotas = APIRouter(prefix="/api")


log = logging.getLogger("inoxio.cadastro")


CADASTROS_POR_IP = 5
JANELA_CADASTRO = timedelta(hours=1)
NOME_EM_USO = "Esse nome de usuário já existe. Escolha outro."
LINK_INVALIDO = "Link de ativação inválido ou vencido. Faça o cadastro de novo."
TERMOS_OBRIGATORIOS = "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade."


class NovoCadastro(BaseModel):
    nome: str = Field(max_length=64)
    email: str = Field(max_length=254)
    senha: str = Field(max_length=256)
    aceite_termos: bool = False


class PedidoAtivacao(BaseModel):
    token: str = Field(max_length=128)


def _resposta(enviar: Enviar | None) -> dict[str, str]:
    if enviar:
        return {
            "mensagem": "Enviamos um link de ativação para o seu e-mail. Ele vale por 24 horas."
        }
    return {
        "mensagem": "Cadastro recebido. O envio de e-mail está desligado: peça ao administrador "
        "para ativar a sua conta."
    }


def _email_ja_cadastrado(
    request: Request, tarefas: BackgroundTasks, db: Session, existente: Usuario
) -> None:
    """Se a conta ainda espera a confirmação, o dono do e-mail recebe um link novo."""
    enviar = request.app.state.enviar_email
    reenviar = enviar is not None and regras.pendente(existente)
    token = registro.abrir_ativacao(db, existente) if reenviar else None
    detalhe = "e-mail já cadastrado, link reenviado" if token else "e-mail já cadastrado"
    # Em nome da dona do e-mail: o nome digitado no formulário ninguém conferiu.
    trilha.registrar(db, "cadastro", ip_do_cliente(request), existente.nome, detalhe)
    db.commit()
    if token:
        aviso = emails.ativacao(existente.nome, emails.link(request, "ativar", token))
        emails.agendar(tarefas, enviar, existente.email, aviso)


@rotas.post("/cadastro", status_code=202)
def cadastrar(
    request: Request, pedido: NovoCadastro, tarefas: BackgroundTasks, db: Session = Depends(banco)
):
    ip = ip_do_cliente(request)
    if not pedido.aceite_termos:
        return JSONResponse({"erro": TERMOS_OBRIGATORIOS}, status_code=400)
    if trilha.contar_do_ip(db, "cadastro", ip, JANELA_CADASTRO) >= CADASTROS_POR_IP:
        return JSONResponse({"erro": "Muitos cadastros deste endereço. Tente mais tarde."}, 429)
    try:
        email = regras.normalizar_email(pedido.email)
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    enviar = request.app.state.enviar_email
    # E-mail já cadastrado responde igual a um cadastro novo: a tela não revela quem tem conta.
    existente = db.scalar(select(Usuario).where(Usuario.email == email))
    if existente:
        _email_ja_cadastrado(request, tarefas, db, existente)
        return _resposta(enviar)
    return _conta_nova(request, tarefas, db, pedido, email) or _resposta(enviar)


def _conta_nova(
    request: Request, tarefas: BackgroundTasks, db: Session, pedido: NovoCadastro, email: str
) -> JSONResponse | None:
    """Cria a conta inativa e manda o link de ativação; devolve a recusa, se houver."""
    try:
        usuario = registro.criar(
            db,
            pedido.nome,
            "analista",
            pedido.senha,
            email=email,
            ativo=False,
            cota_diaria=registro.COTA_CADASTRO,
            aceitou_termos=True,
        )
        db.flush()
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    except IntegrityError:
        db.rollback()
        return JSONResponse({"erro": NOME_EM_USO}, status_code=409)
    token = registro.abrir_ativacao(db, usuario)
    detalhe = f"aceitou os termos {regras.VERSAO_TERMOS}"
    trilha.registrar(db, "cadastro", ip_do_cliente(request), usuario.nome, detalhe)
    db.commit()
    enviar = request.app.state.enviar_email
    if enviar:
        aviso = emails.ativacao(usuario.nome, emails.link(request, "ativar", token))
        emails.agendar(tarefas, enviar, email, aviso)
    return None


@rotas.post("/ativar")
def ativar(request: Request, pedido: PedidoAtivacao, db: Session = Depends(banco)):
    usuario = registro.ativar(db, pedido.token)
    if usuario is None:
        return JSONResponse({"erro": LINK_INVALIDO}, status_code=400)
    trilha.registrar(db, "ativacao", ip_do_cliente(request), usuario.nome)
    db.commit()
    return {"mensagem": "Conta ativada. Já pode entrar."}
