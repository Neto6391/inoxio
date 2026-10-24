"""O que toda fonte tem em comum: o formato da evidência e a consulta em paralelo."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Protocol

import httpx

TIMEOUT = 8.0
LIMITE_TEXTO = 200


ERROS_DE_REDE = (httpx.HTTPError, KeyError, TypeError, ValueError)


log = logging.getLogger("inoxio.fontes")


class Fonte(Protocol):
    def consultar(self, tipo: str, valor: str) -> dict[str, Any] | None: ...


def evidencia(
    fonte: str, status: str, dados: dict[str, Any] | None = None, *, contexto: bool = False
) -> dict[str, Any]:
    """Contexto aparece na tela e vai para a IA, mas nunca entra no veredito."""
    item = {"fonte": fonte, "status": status, "dados": dados or {}}
    if contexto:
        item["contexto"] = True
    return item


def texto_curto(valor: Any) -> str:
    return str(valor or "")[:LIMITE_TEXTO]


def consultar_uma(fonte: Fonte, tipo: str, valor: str) -> dict[str, Any] | None:
    try:
        return fonte.consultar(tipo, valor)
    except Exception:
        log.warning("fonte_com_defeito", exc_info=True)
        return evidencia(getattr(fonte, "NOME", "desconhecida"), "falha")


def consultar_fontes(fontes: list[Fonte], tipo: str, valor: str) -> list[dict[str, Any]]:
    """Consulta em paralelo. O argumento vem da entrada classificada, nunca da IA."""
    if not fontes:
        return []
    with ThreadPoolExecutor(max_workers=len(fontes)) as executor:
        resultados = list(executor.map(lambda fonte: consultar_uma(fonte, tipo, valor), fontes))
    return [resultado for resultado in resultados if resultado is not None]
