"""Aplicação web: a API JSON em /api. O React é servido pela borda (infra/borda/nginx.conf)."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from http import HTTPStatus

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy.orm import sessionmaker
from starlette.exceptions import HTTPException as StarletteHTTPException
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from inoxio.auditoria import rotas as auditoria
from inoxio.contas.rotas import autenticacao, cadastro, conta, senha, usuarios
from inoxio.investigacoes import rotas as investigacoes
from inoxio.investigacoes import rotas_estatisticas as estatisticas
from inoxio.investigacoes.fontes.abuseipdb import AbuseIPDB
from inoxio.investigacoes.fontes.dns import ResolucaoDNS
from inoxio.investigacoes.fontes.virustotal import VirusTotal
from inoxio.investigacoes.grafo import construir_grafo
from inoxio.investigacoes.historico import buscador
from inoxio.investigacoes.ia.explicador import Explicador
from inoxio.investigacoes.ia.mente import criar_invocar
from inoxio.plataforma.banco import criar_fabrica
from inoxio.plataforma.config import Config
from inoxio.plataforma.correio import Enviar, criar_envio

log = logging.getLogger("inoxio")

# O app só responde JSON (e o texto da saúde): nada nele carrega script, estilo ou imagem.
# A política da página do React, com o nonce, fica na borda.
POLITICA = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

MENSAGENS = {
    400: "Requisição inválida.",
    401: "Sessão ausente ou expirada.",
    403: "Acesso negado.",
    404: "Não encontrado.",
    405: "Método não permitido.",
    429: "Limite de uso atingido. Tente mais tarde.",
}


def grafo_de_producao(
    config: Config, fabrica: sessionmaker, cliente: httpx.Client
) -> CompiledStateGraph:
    abuseipdb = AbuseIPDB(config.abuseipdb_chave, cliente)
    fontes = [abuseipdb, VirusTotal(config.virustotal_chave, cliente), ResolucaoDNS(abuseipdb)]
    # Sem a IA no grafo: o veredito sai logo, e o Explicador escreve a explicação depois.
    return construir_grafo(fontes, None, buscador(fabrica))


def criar_app(
    config: Config | None = None,
    fabrica: sessionmaker | None = None,
    grafo: CompiledStateGraph | None = None,
    enviar_email: Enviar | None = None,
    explicador: Explicador | None = None,
) -> FastAPI:
    config = config or Config.do_ambiente()
    # Um cliente HTTP para todas as consultas às fontes, fechado quando o app para.
    cliente_http = httpx.Client()

    @asynccontextmanager
    async def ciclo_de_vida(app: FastAPI) -> AsyncIterator[None]:
        yield
        app.state.explicador.fechar()
        cliente_http.close()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=ciclo_de_vida)
    app.state.config = config
    app.state.fabrica = fabrica or criar_fabrica(config.banco_url)
    app.state.cliente_http = cliente_http
    app.state.enviar_email = enviar_email or criar_envio(config)
    app.state.grafo = grafo or grafo_de_producao(config, app.state.fabrica, cliente_http)
    app.state.explicador = explicador or Explicador(app.state.fabrica, criar_invocar(config))
    for modulo in (
        autenticacao,
        cadastro,
        senha,
        conta,
        usuarios,
        investigacoes,
        estatisticas,
        auditoria,
    ):
        app.include_router(modulo.rotas)
    _saude(app)
    # Só a borda declara o IP real; por isso o uvicorn roda com --no-proxy-headers.
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=config.proxies_confiaveis)
    _cabecalhos_de_seguranca(app)
    _respostas_de_erro(app)
    return app


def _saude(app: FastAPI) -> None:
    @app.api_route("/saude", methods=["GET", "HEAD"], response_class=PlainTextResponse)
    def saude() -> str:
        return "ok"


def _cabecalhos_de_seguranca(app: FastAPI) -> None:
    @app.middleware("http")
    async def cabecalhos_de_seguranca(request: Request, chamar):
        resposta = await chamar(request)
        resposta.headers["Content-Security-Policy"] = POLITICA
        resposta.headers["X-Content-Type-Options"] = "nosniff"
        resposta.headers["Referrer-Policy"] = "no-referrer"
        return resposta


def _respostas_de_erro(app: FastAPI) -> None:
    """Todo erro sai em JSON, com a mensagem no campo "erro" e sem detalhe interno."""

    @app.exception_handler(StarletteHTTPException)
    async def erro_http(request: Request, erro: StarletteHTTPException):
        mensagem = MENSAGENS.get(erro.status_code, HTTPStatus(erro.status_code).phrase)
        return JSONResponse({"erro": mensagem}, status_code=erro.status_code)

    @app.exception_handler(RequestValidationError)
    async def erro_validacao(request: Request, erro: RequestValidationError):
        # Não devolve o detalhe do Pydantic: ele ecoa a entrada do usuário.
        return JSONResponse({"erro": MENSAGENS[400]}, status_code=400)

    @app.exception_handler(Exception)
    async def erro_interno(request: Request, erro: Exception):
        log.error("erro_nao_tratado", exc_info=erro)
        mensagem = "Erro interno. O detalhe ficou registrado no servidor."
        return JSONResponse({"erro": mensagem}, status_code=500)
