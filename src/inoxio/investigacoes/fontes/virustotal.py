"""VirusTotal: detecções e reputação de URL, domínio, IP e hash."""

from __future__ import annotations

import base64
from typing import Any

import httpx

from inoxio.investigacoes.fontes.base import ERROS_DE_REDE, TIMEOUT, evidencia, texto_curto


def id_da_url(url: str) -> str:
    """Identificador que o VirusTotal usa para uma URL: base64 de URL, sem o '='."""
    return base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")


class VirusTotal:
    NOME = "virustotal"
    NOME_URL = "virustotal_url"
    BASE = "https://www.virustotal.com/api/v3"
    CAMINHOS = {"ip": "ip_addresses", "hash": "files", "dominio": "domains", "url": "urls"}

    def __init__(self, chave: str, cliente: httpx.Client) -> None:
        self._chave = chave
        self._cliente = cliente

    def consultar(self, tipo: str, valor: str) -> dict[str, Any] | None:
        caminho = self.CAMINHOS.get(tipo)
        if caminho is None:
            return None
        nome = self.NOME_URL if tipo == "url" else self.NOME
        # Só consulta o que o VirusTotal já analisou: a URL nunca é enviada para análise.
        identificador = id_da_url(valor) if tipo == "url" else valor
        if not self._chave:
            return evidencia(nome, "falha")
        try:
            resposta = self._cliente.get(
                f"{self.BASE}/{caminho}/{identificador}",
                headers={"x-apikey": self._chave},
                timeout=TIMEOUT,
            )
            if resposta.status_code == 404:
                return evidencia(nome, "nao_encontrado")
            if resposta.status_code != 200:
                return evidencia(nome, "falha")
            atributos = resposta.json()["data"]["attributes"]
            estatisticas = atributos.get("last_analysis_stats") or {}
            votos = atributos.get("total_votes") or {}
            return evidencia(
                nome,
                "ok",
                {
                    "malicioso": int(estatisticas.get("malicious", 0)),
                    "suspeito": int(estatisticas.get("suspicious", 0)),
                    "reputacao": int(atributos.get("reputation", 0)),
                    "tags": [texto_curto(tag) for tag in (atributos.get("tags") or [])[:5]],
                    # A reputação é a soma dos votos da comunidade: sem votos, ela é 0
                    # sem dizer nada. Os votos e os motores dão o contexto na tela.
                    "votos_positivos": int(votos.get("harmless", 0)),
                    "votos_negativos": int(votos.get("malicious", 0)),
                    "motores": sum(int(n) for n in estatisticas.values()),
                    "nao_acusaram": int(estatisticas.get("harmless", 0))
                    + int(estatisticas.get("undetected", 0)),
                },
            )
        except ERROS_DE_REDE:
            return evidencia(nome, "falha")
