"""Consulta às fontes de reputação, sempre por identificador.

Tudo o que volta daqui é texto de terceiros e não merece confiança: só alguns
campos entram no estado, cortados em 200 caracteres.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Protocol

import httpx

TIMEOUT = 8.0
LIMITE_TEXTO = 200
_ERROS = (httpx.HTTPError, KeyError, TypeError, ValueError)
log = logging.getLogger("inoxio.fontes")


class Fonte(Protocol):
    def consultar(self, tipo: str, valor: str) -> dict[str, Any] | None: ...


def evidencia(fonte: str, status: str, dados: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"fonte": fonte, "status": status, "dados": dados or {}}


def _texto(valor: Any) -> str:
    return str(valor or "")[:LIMITE_TEXTO]


class AbuseIPDB:
    NOME = "abuseipdb"
    URL = "https://api.abuseipdb.com/api/v2/check"

    def __init__(self, chave: str, cliente: httpx.Client) -> None:
        self._chave = chave
        self._cliente = cliente

    def consultar(self, tipo: str, valor: str) -> dict[str, Any] | None:
        if tipo != "ip":
            return None
        if not self._chave:
            return evidencia(self.NOME, "falha")
        try:
            resposta = self._cliente.get(
                self.URL,
                params={"ipAddress": valor, "maxAgeInDays": 30},
                headers={"Key": self._chave, "Accept": "application/json"},
                timeout=TIMEOUT,
            )
            if resposta.status_code != 200:
                return evidencia(self.NOME, "falha")
            dados = resposta.json()["data"]
            return evidencia(
                self.NOME,
                "ok",
                {
                    "score": int(dados["abuseConfidenceScore"]),
                    "relatos": int(dados.get("totalReports") or 0),
                    "pais": _texto(dados.get("countryCode")),
                    "isp": _texto(dados.get("isp")),
                },
            )
        except _ERROS:
            return evidencia(self.NOME, "falha")


class VirusTotal:
    NOME = "virustotal"
    BASE = "https://www.virustotal.com/api/v3"
    CAMINHOS = {"ip": "ip_addresses", "hash": "files", "dominio": "domains"}

    def __init__(self, chave: str, cliente: httpx.Client) -> None:
        self._chave = chave
        self._cliente = cliente

    def consultar(self, tipo: str, valor: str) -> dict[str, Any] | None:
        caminho = self.CAMINHOS.get(tipo)
        if caminho is None:
            return None
        if not self._chave:
            return evidencia(self.NOME, "falha")
        try:
            resposta = self._cliente.get(
                f"{self.BASE}/{caminho}/{valor}",
                headers={"x-apikey": self._chave},
                timeout=TIMEOUT,
            )
            if resposta.status_code == 404:
                return evidencia(self.NOME, "nao_encontrado")
            if resposta.status_code != 200:
                return evidencia(self.NOME, "falha")
            atributos = resposta.json()["data"]["attributes"]
            estatisticas = atributos.get("last_analysis_stats") or {}
            return evidencia(
                self.NOME,
                "ok",
                {
                    "malicioso": int(estatisticas.get("malicious", 0)),
                    "suspeito": int(estatisticas.get("suspicious", 0)),
                    "reputacao": int(atributos.get("reputation", 0)),
                    "tags": [_texto(tag) for tag in (atributos.get("tags") or [])[:5]],
                },
            )
        except _ERROS:
            return evidencia(self.NOME, "falha")


def _consultar_uma(fonte: Fonte, tipo: str, valor: str) -> dict[str, Any] | None:
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
        resultados = list(executor.map(lambda fonte: _consultar_uma(fonte, tipo, valor), fontes))
    return [resultado for resultado in resultados if resultado is not None]
