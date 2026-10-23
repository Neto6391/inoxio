"""Entrega do frontend React com CSP estrita.

O antd injeta estilos em tempo de execução. Para a CSP continuar estrita, cada
resposta do index.html leva um nonce novo: o mesmo valor vai no cabeçalho CSP e
na meta tag que o React lê e repassa ao ConfigProvider.
"""

from __future__ import annotations

import hashlib
import secrets
from pathlib import Path

from fastapi.responses import HTMLResponse

MARCADOR = "__CSP_NONCE__"
MARCADOR_VERSAO = "__VERSAO__"
# Toda resposta da API diz qual frontend está publicado. A aba aberta antes de um deploy
# compara com a versão dela e carrega a página de novo na navegação seguinte.
CABECALHO_VERSAO = "X-Inoxio-Versao"
PROVISORIA = (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Inóxio</title>'
    "</head><body><p>Frontend não publicado.</p></body></html>"
)


def politica(nonce: str | None = None) -> str:
    estilos = f"'self' 'nonce-{nonce}'" if nonce else "'self'"
    return (
        "default-src 'self'; script-src 'self'; "
        f"style-src {estilos}; img-src 'self' data:; "
        "frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'"
    )


def _modelo(diretorio: Path) -> str:
    try:
        return (diretorio / "index.html").read_text(encoding="utf-8")
    except FileNotFoundError:
        return PROVISORIA


def versao(diretorio: Path) -> str:
    """O build do Vite muda o index.html (os nomes dos arquivos levam o hash do conteúdo)."""
    return hashlib.sha256(_modelo(diretorio).encode()).hexdigest()[:12]


def pagina(diretorio: Path) -> HTMLResponse:
    nonce = secrets.token_urlsafe(16)
    modelo = _modelo(diretorio)
    cabecalhos = {"Content-Security-Policy": politica(nonce), "Cache-Control": "no-store"}
    html = modelo.replace(MARCADOR, nonce).replace(MARCADOR_VERSAO, versao(diretorio))
    return HTMLResponse(html, headers=cabecalhos)
