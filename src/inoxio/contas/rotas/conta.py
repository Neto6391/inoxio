"""Minha conta: os direitos do titular na LGPD (art. 18) — ver, corrigir, levar e excluir
os dados — e a troca do nome de exibição, da senha e do e-mail."""

from __future__ import annotations

import json
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from inoxio.auditoria import trilha
from inoxio.auditoria.modelos import Evento
from inoxio.contas import (
    credenciais,
    emails,
    exclusao,
    perfil,
    regras,
    sessoes,
    tentativas,
    troca_de_email,
)
from inoxio.contas.modelos import Usuario
from inoxio.investigacoes import cota
from inoxio.investigacoes.modelos import Investigacao
from inoxio.plataforma.banco import agora
from inoxio.plataforma.horario import iso
from inoxio.web.dependencias import (
    Contexto,
    banco,
    conferir_csrf,
    ip_do_cliente,
    sessao_atual,
    token_csrf,
)

rotas = APIRouter(prefix="/api/conta")


class PedidoExclusao(BaseModel):
    senha: str = Field(max_length=256)


class Dados(BaseModel):
    nome_exibicao: str = Field(max_length=200)


class TrocaSenha(BaseModel):
    atual: str = Field(max_length=256)
    nova: str = Field(max_length=256)


class PedidoTrocaEmail(BaseModel):
    senha: str = Field(max_length=256)
    email: str = Field(max_length=254)


class ConfirmacaoEmail(BaseModel):
    token: str = Field(max_length=128)


SENHA_ERRADA = "Senha atual incorreta."


# Por conta: ninguém usa uma sessão aberta para encher a caixa de outra pessoa.
TROCAS_DE_EMAIL_POR_HORA = 3
UMA_HORA = timedelta(hours=1)
LINK_INVALIDO = "Link inválido ou vencido. Peça a troca de novo em Minha conta."


def _perfil(usuario: Usuario) -> dict:
    return {
        "nome": usuario.nome,
        "nome_exibicao": usuario.nome_exibicao,
        "email": usuario.email,
        "papel": usuario.papel,
        "criado_em": iso(usuario.criado_em),
        "email_confirmado_em": iso(usuario.email_confirmado_em),
        "cota_diaria": cota.cota_de(usuario),
        "termos_versao": usuario.termos_versao,
        "termos_aceitos_em": iso(usuario.termos_aceitos_em),
    }


@rotas.get("")
def minha_conta(ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    return _perfil(ctx.usuario) | {
        "email_pendente": troca_de_email.troca_email_pendente(db, ctx.usuario)
    }


@rotas.patch("")
def corrigir_dados(
    request: Request,
    pedido: Dados,
    ctx: Contexto = Depends(sessao_atual),
    db: Session = Depends(banco),
):
    """O titular corrige o nome de exibição. Papel e cota só o admin muda."""
    conferir_csrf(ctx, token_csrf(request))
    try:
        perfil.definir_nome_exibicao(ctx.usuario, pedido.nome_exibicao)
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    _registrar(db, request, ctx, "conta_alterada", "nome de exibição")
    db.commit()
    return _perfil(ctx.usuario)


def _registrar(db: Session, request: Request, ctx: Contexto, tipo: str, detalhe: str) -> None:
    trilha.registrar(
        db, tipo, ip_do_cliente(request), ctx.usuario.nome, detalhe, sessao=ctx.sessao.ref
    )


def _senha_confere(db: Session, request: Request, ctx: Contexto, senha: str) -> JSONResponse | None:
    """A senha atual passa pelo mesmo limite do login: a sessão aberta não vira um jeito de
    testar senhas. Devolve a resposta de erro, ou None quando confere."""
    ip = ip_do_cliente(request)
    if tentativas.login_bloqueado(db, ctx.usuario.nome, ip):
        return JSONResponse({"erro": "Muitas tentativas. Tente mais tarde."}, status_code=429)
    certa = credenciais.conferir(ctx.usuario.senha_hash, senha)
    tentativas.registrar_tentativa(db, ctx.usuario.nome, ip, sucesso=certa)
    if certa:
        return None
    db.commit()
    return JSONResponse({"erro": SENHA_ERRADA}, status_code=403)


@rotas.post("/senha", status_code=204)
def trocar_senha(
    request: Request,
    pedido: TrocaSenha,
    ctx: Contexto = Depends(sessao_atual),
    db: Session = Depends(banco),
):
    conferir_csrf(ctx, token_csrf(request))
    if recusa := _senha_confere(db, request, ctx, pedido.atual):
        return recusa
    try:
        credenciais.trocar_propria_senha(db, ctx.usuario, pedido.nova, ctx.sessao.token_hash)
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    _registrar(db, request, ctx, "conta_alterada", "senha trocada")
    db.commit()
    return Response(status_code=204)


def _mandar_links_da_troca(
    request: Request, tarefas: BackgroundTasks, usuario: Usuario, email: str, token: str
) -> None:
    """O link vai para o e-mail novo; o atual, se houver, recebe só o aviso."""
    enviar = request.app.state.enviar_email
    confirmar = emails.confirmar_email_novo(
        usuario.nome, emails.link(request, "confirmar-email", token)
    )
    emails.agendar(tarefas, enviar, email, confirmar)
    if usuario.email:
        emails.agendar(tarefas, enviar, usuario.email, emails.aviso_de_troca_de_email(usuario.nome))


@rotas.post("/email", status_code=202)
def pedir_troca_de_email(
    request: Request,
    pedido: PedidoTrocaEmail,
    tarefas: BackgroundTasks,
    ctx: Contexto = Depends(sessao_atual),
    db: Session = Depends(banco),
):
    """O e-mail novo só vale depois do clique no link mandado a ele; até lá, o atual segue."""
    conferir_csrf(ctx, token_csrf(request))
    enviar = request.app.state.enviar_email
    if enviar is None:
        erro = "O envio de e-mail está desligado: peça ao administrador para trocar o seu e-mail."
        return JSONResponse({"erro": erro}, status_code=503)
    if recusa := _senha_confere(db, request, ctx, pedido.senha):
        return recusa
    try:
        email = regras.normalizar_email(pedido.email)
    except ValueError as erro:
        return JSONResponse({"erro": str(erro)}, status_code=400)
    if email == ctx.usuario.email:
        return JSONResponse({"erro": "Esse já é o seu e-mail."}, status_code=400)
    if (
        trilha.contar_da_conta(db, "email_troca_pedida", ctx.usuario.nome, UMA_HORA)
        >= TROCAS_DE_EMAIL_POR_HORA
    ):
        return JSONResponse({"erro": "Muitos pedidos de troca. Tente mais tarde."}, 429)
    # E-mail de outra conta: mesma resposta e nenhum envio, para não revelar quem tem conta.
    tomado = db.scalar(select(Usuario.id).where(Usuario.email == email))
    token = None if tomado else troca_de_email.abrir_troca_email(db, ctx.usuario, email)
    _registrar(db, request, ctx, "email_troca_pedida", "")
    db.commit()
    if token:
        _mandar_links_da_troca(request, tarefas, ctx.usuario, email, token)
    return {
        "mensagem": "Enviamos um link para o e-mail novo. Ele vale por 24 horas; até a "
        "confirmação, o e-mail atual continua valendo."
    }


@rotas.post("/email/confirmar")
def confirmar_troca_de_email(
    request: Request, pedido: ConfirmacaoEmail, db: Session = Depends(banco)
):
    """O link do e-mail novo vale sem sessão: ele pode ser aberto em outro aparelho."""
    trocado = troca_de_email.confirmar_troca_email(db, pedido.token)
    if trocado is None:
        return JSONResponse({"erro": LINK_INVALIDO}, status_code=400)
    usuario, _antigo = trocado
    trilha.registrar(db, "email_trocado", ip_do_cliente(request), usuario.nome)
    db.commit()
    return {"mensagem": "E-mail trocado. Ele já vale para entrar e para recuperar a senha."}


def _meus_dados(db: Session, usuario: Usuario) -> dict:
    investigacoes = db.scalars(
        select(Investigacao)
        .where(Investigacao.usuario_id == usuario.id)
        .order_by(Investigacao.criada_em)
    )
    eventos = db.scalars(
        select(Evento).where(Evento.usuario == usuario.nome).order_by(Evento.quando)
    )
    return {
        "gerado_em": agora().isoformat(),
        "conta": _perfil(usuario),
        "investigacoes": [
            {
                "tipo": investigacao.tipo,
                "valor": investigacao.valor,
                "veredito": investigacao.veredito,
                "nota": investigacao.nota,
                "criada_em": iso(investigacao.criada_em),
                "evidencias": investigacao.evidencias,
                "analise": investigacao.analise,
            }
            for investigacao in investigacoes
        ],
        "eventos_de_seguranca": [
            {
                "quando": iso(evento.quando),
                "tipo": evento.tipo,
                "ip": evento.ip,
                "detalhe": evento.detalhe,
            }
            for evento in eventos
        ],
    }


@rotas.get("/dados")
def baixar_meus_dados(ctx: Contexto = Depends(sessao_atual), db: Session = Depends(banco)):
    """Portabilidade: tudo o que o sistema guarda sobre a pessoa, num JSON só."""
    conteudo = json.dumps(_meus_dados(db, ctx.usuario), ensure_ascii=False, indent=2)
    nome = f"inoxio-meus-dados-{ctx.usuario.nome}.json"
    return Response(
        conteudo,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )


@rotas.post("/excluir", status_code=204)
def excluir_minha_conta(
    request: Request,
    pedido: PedidoExclusao,
    ctx: Contexto = Depends(sessao_atual),
    db: Session = Depends(banco),
):
    conferir_csrf(ctx, token_csrf(request))
    # A senha confirma que é o titular, e não alguém com a sessão aberta num computador alheio.
    if not credenciais.conferir(ctx.usuario.senha_hash, pedido.senha):
        return JSONResponse({"erro": "Senha incorreta."}, status_code=403)
    try:
        exclusao.excluir(db, ctx.usuario)
    except regras.Conflito as erro:
        return JSONResponse({"erro": str(erro)}, status_code=409)
    # Sem o nome: o evento fica como prova de que o pedido foi atendido.
    trilha.registrar(db, "conta_excluida", ip_do_cliente(request), None, "a pedido do titular")
    db.commit()
    resposta = Response(status_code=204)
    resposta.delete_cookie(
        sessoes.NOME_COOKIE, path="/", secure=True, httponly=True, samesite="strict"
    )
    return resposta
