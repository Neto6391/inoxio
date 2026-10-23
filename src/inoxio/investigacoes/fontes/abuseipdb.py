"""AbuseIPDB: relatos de abuso de um IP."""

from __future__ import annotations

from typing import Any

import httpx

from inoxio.investigacoes.fontes.base import ERROS_DE_REDE, TIMEOUT, evidencia, texto_curto


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
                    "pais": texto_curto(dados.get("countryCode")),
                    "isp": texto_curto(dados.get("isp")),
                },
            )
        except ERROS_DE_REDE:
            return evidencia(self.NOME, "falha")
