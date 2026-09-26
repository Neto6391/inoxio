"""Aplicação web: API JSON em /api e o frontend React em todo o resto."""

from __future__ import annotations

import logging
import mimetypes
from http import HTTPStatus
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy.orm import sessionmaker
from starlette.exceptions import HTTPException as StarletteHTTPException
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from inoxio.agente.fontes import AbuseIPDB, VirusTotal
from inoxio.agente.grafo import construir_grafo
from inoxio.agente.mente import criar_invocar
from inoxio.config import Config
from inoxio.db import criar_fabrica
from inoxio.historico import buscador
from inoxio.web import agente as rotas_agente
from inoxio.web import autenticacao, spa

log = logging.getLogger("inoxio")

# No Windows, o mimetypes lê o registro e pode servir .js como text/plain; com o
# nosniff, o navegador recusa o script e a tela fica em branco. Fixa os tipos aqui.
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")

MENSAGENS = {
    400: "Requisição inválida.",
    401: "Sessão ausente ou expirada.",
    403: "Acesso negado.",
    404: "Não encontrado.",
    405: "Método não permitido.",
    429: "Limite de uso atingido. Tente mais tarde.",
}


def grafo_de_producao(config: Config, fabrica: sessionmaker) -> CompiledStateGraph:
    cliente = httpx.Client()
    fontes = [
        AbuseIPDB(config.abuseipdb_chave, cliente),
        VirusTotal(config.virustotal_chave, cliente),
    ]
    return construir_grafo(fontes, criar_invocar(config), buscador(fabrica))


def criar_app(
    config: Config | None = None,
    fabrica: sessionmaker | None = None,
    grafo: CompiledStateGraph | None = None,
) -> FastAPI:
    config = config or Config.do_ambiente()
    frontend = Path(config.frontend_dir)
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    app.state.config = config
    app.state.fabrica = fabrica or criar_fabrica(config.banco_url)
    app.state.grafo = grafo or grafo_de_producao(config, app.state.fabrica)
    app.include_router(autenticacao.rotas)
    app.include_router(rotas_agente.rotas)
    app.mount("/assets", StaticFiles(directory=frontend / "assets", check_dir=False), "assets")
    # Só a borda declara o IP real; por isso o uvicorn roda com --no-proxy-headers.
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=config.proxies_confiaveis)

    @app.api_route("/saude", methods=["GET", "HEAD"], response_class=PlainTextResponse)
    def saude() -> str:
        return "ok"

    @app.api_route("/api/{_resto:path}", methods=["GET", "HEAD"])
    def api_inexistente(_resto: str):
        return JSONResponse({"erro": MENSAGENS[404]}, status_code=404)

    @app.api_route("/{_caminho:path}", methods=["GET", "HEAD"])
    def frontend_react(_caminho: str):
        # Qualquer outra rota é do React; ele decide o que mostrar.
        return spa.pagina(frontend)

    @app.middleware("http")
    async def cabecalhos_de_seguranca(request: Request, chamar):
        resposta = await chamar(request)
        resposta.headers.setdefault("Content-Security-Policy", spa.politica())
        resposta.headers["X-Content-Type-Options"] = "nosniff"
        resposta.headers["Referrer-Policy"] = "no-referrer"
        return resposta

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

    return app
