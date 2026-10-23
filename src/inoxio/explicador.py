"""Explicação da IA fora do pedido: o veredito sai logo, e a explicação chega depois.

Uma chamada ao Groq por vez no processo, numa fila. Se o provedor recusa por limite
de requisições (429), a explicação espera e tenta de novo dentro do prazo, em vez
de a investigação ficar sem ela.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from typing import Any

from sqlalchemy.orm import sessionmaker

from inoxio.agente.mente import Invocar, tentar_analisar
from inoxio.db import Investigacao

log = logging.getLogger("inoxio.explicador")

# Contado de quando a investigação entra na fila: a tela espera um pouco mais que isso.
PRAZO = timedelta(seconds=90)
ESPERAS_429 = (5, 10, 20, 30)


class Explicador:
    def __init__(
        self,
        fabrica: sessionmaker,
        invocar: Invocar | None,
        *,
        executar: Callable[[Callable[[], None]], Any] | None = None,
        dormir: Callable[[float], None] = time.sleep,
        relogio: Callable[[], float] = time.monotonic,
    ) -> None:
        self._fabrica = fabrica
        self._invocar = invocar
        self._dormir = dormir
        self._relogio = relogio
        # Um trabalhador só: as chamadas ao Groq saem uma de cada vez.
        self._executor = None if executar else ThreadPoolExecutor(1, "explicador")
        self._executar = executar or self._executor.submit

    @property
    def ativo(self) -> bool:
        """Sem chave do Groq, não há explicação a esperar."""
        return self._invocar is not None

    def pedir(self, investigacao_id: str, dados: dict[str, Any]) -> None:
        limite = self._relogio() + PRAZO.total_seconds()
        self._executar(lambda: self._explicar(investigacao_id, dados, limite))

    def fechar(self, esperar: bool = False) -> None:
        if self._executor:
            self._executor.shutdown(wait=esperar, cancel_futures=not esperar)

    def _explicar(self, investigacao_id: str, dados: dict[str, Any], limite: float) -> None:
        try:
            analise = self._tentar(dados, limite)
            with self._fabrica() as db, db.begin():
                investigacao = db.get(Investigacao, investigacao_id)
                if investigacao is not None:
                    investigacao.analise = analise
                    investigacao.analise_estado = "pronta" if analise else "indisponivel"
        except Exception:
            # Fora do pedido, ninguém mais vê a exceção: fica no log, e a tela
            # mostra a investigação sem explicação quando o prazo passar.
            log.exception("explicacao_falhou")

    def _tentar(self, dados: dict[str, Any], limite: float) -> dict[str, Any] | None:
        if self._relogio() >= limite:
            log.warning("explicacao_vencida_na_fila")
            return None
        for espera in (*ESPERAS_429, None):
            situacao, analise = tentar_analisar(dados, self._invocar)
            if situacao != "limite":
                return analise
            if espera is None or self._relogio() + espera >= limite:
                return None
            self._dormir(espera)
        return None
