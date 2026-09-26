"""Entrega do frontend React com CSP estrita.

O antd injeta estilos em tempo de execução. Para a CSP continuar estrita, cada
resposta do index.html leva um nonce novo: o mesmo valor vai no cabeçalho CSP e
na meta tag que o React lê e repassa ao ConfigProvider.
"""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi.responses import HTMLResponse

MARCADOR = "__CSP_NONCE__"
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


def pagina(diretorio: Path) -> HTMLResponse:
    nonce = secrets.token_urlsafe(16)
    try:
        modelo = (diretorio / "index.html").read_text(encoding="utf-8")
    except FileNotFoundError:
        modelo = PROVISORIA
    cabecalhos = {"Content-Security-Policy": politica(nonce), "Cache-Control": "no-store"}
    return HTMLResponse(modelo.replace(MARCADOR, nonce), headers=cabecalhos)
