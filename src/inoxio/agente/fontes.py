"""Consulta às fontes de reputação, sempre por identificador.

Tudo o que volta daqui é texto de terceiros e não merece confiança: só alguns
campos entram no estado, cortados em 200 caracteres.
"""

from __future__ import annotations

import ipaddress
import logging
import socket
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Protocol

import httpx

TIMEOUT = 8.0
LIMITE_TEXTO = 200
_ERROS = (httpx.HTTPError, KeyError, TypeError, ValueError)
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


def _resolver_no_sistema(dominio: str) -> list[str]:
    return [info[4][0] for info in socket.getaddrinfo(dominio, None, proto=socket.IPPROTO_TCP)]


def _publicos(enderecos: list[str]) -> list[str]:
    """IPs públicos, sem repetição, IPv4 antes de IPv6."""
    vistos: dict[str, ipaddress.IPv4Address | ipaddress.IPv6Address] = {}
    for endereco in enderecos:
        try:
            ip = ipaddress.ip_address(endereco.split("%")[0])
        except ValueError:
            continue
        if ip.is_global and not ip.is_multicast:
            vistos.setdefault(ip.compressed, ip)
    return [texto for texto, ip in sorted(vistos.items(), key=lambda par: par[1].version)]


# A consulta de DNS do sistema não aceita timeout; roda aqui e a espera é limitada.
_DNS = ThreadPoolExecutor(max_workers=4, thread_name_prefix="dns")


class ResolucaoDNS:
    """IPs públicos de um domínio e a reputação deles no AbuseIPDB, só como contexto.

    Sites grandes ficam atrás de CDN e hospedagem compartilhada: o mesmo IP serve
    milhares de domínios, então a fama do IP não decide nada sobre o domínio.
    O servidor só pergunta ao DNS; nunca se conecta ao site.
    """

    NOME = "dns"
    MAX_IPS = 2

    def __init__(
        self,
        abuseipdb: Fonte,
        resolver: Callable[[str], list[str]] = _resolver_no_sistema,
        timeout: float = 3.0,
    ) -> None:
        self._abuseipdb = abuseipdb
        self._resolver = resolver
        self._timeout = timeout

    def consultar(self, tipo: str, valor: str) -> dict[str, Any] | None:
        if tipo != "dominio":
            return None
        try:
            enderecos = _DNS.submit(self._resolver, valor).result(timeout=self._timeout)
        except socket.gaierror:
            return evidencia(self.NOME, "nao_encontrado", contexto=True)
        except Exception:
            return evidencia(self.NOME, "falha", contexto=True)
        ips = _publicos(enderecos)[: self.MAX_IPS]
        if not ips:
            return evidencia(self.NOME, "nao_encontrado", contexto=True)
        with ThreadPoolExecutor(max_workers=len(ips)) as executor:
            respostas = list(
                executor.map(lambda ip: _consultar_uma(self._abuseipdb, "ip", ip), ips)
            )
        itens = [
            {"ip": ip, "abuseipdb": resposta["status"], **resposta["dados"]}
            for ip, resposta in zip(ips, respostas, strict=True)
        ]
        return evidencia(self.NOME, "ok", {"ips": itens}, contexto=True)


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
