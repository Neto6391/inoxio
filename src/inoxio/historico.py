"""Reaproveitamento de consultas recentes.

O mesmo indicador investigado há menos de 24 horas devolve o resultado salvo,
sem gastar a cota do VirusTotal, do AbuseIPDB nem do Groq. Resultado
inconclusivo nunca é reaproveitado: ele significa que alguma fonte falhou.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from inoxio.db import Investigacao, agora

JANELA = timedelta(hours=24)
Buscar = Callable[[str, str], dict[str, Any] | None]


def buscador(fabrica: sessionmaker) -> Buscar:
    def buscar(tipo: str, valor: str) -> dict[str, Any] | None:
        with fabrica() as db:
            anterior = db.scalar(
                select(Investigacao)
                .where(
                    Investigacao.tipo == tipo,
                    Investigacao.valor == valor,
                    Investigacao.reaproveitada.is_(False),
                    Investigacao.veredito != "inconclusivo",
                    Investigacao.criada_em >= agora() - JANELA,
                )
                .order_by(Investigacao.criada_em.desc())
                .limit(1)
            )
        if anterior is None:
            return None
        return {
            "evidencias": anterior.evidencias,
            "veredito": anterior.veredito,
            "nota": anterior.nota,
            "analise": anterior.analise,
        }

    return buscar
