"""Reaproveitamento de consultas recentes.

O mesmo indicador investigado há menos de 24 horas devolve o resultado salvo,
sem gastar a cota do VirusTotal, do AbuseIPDB nem do Groq. Resultado em que
alguma fonte falhou nunca é reaproveitado, mesmo que a outra tenha bastado
para um veredito: a que falhou poderia mudá-lo.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

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
            if anterior is None or any(e["status"] == "falha" for e in anterior.evidencias):
                return None
            analise = anterior.analise or _analise_de_uma_copia(db, anterior)
        return {
            "evidencias": anterior.evidencias,
            "veredito": anterior.veredito,
            "nota": anterior.nota,
            "analise": analise,
        }

    return buscar


def _analise_de_uma_copia(db: Session, original: Investigacao) -> dict[str, Any] | None:
    """Se a IA falhou na consulta original, uma cópia posterior pode ter conseguido."""
    copias = db.scalars(
        select(Investigacao)
        .where(
            Investigacao.tipo == original.tipo,
            Investigacao.valor == original.valor,
            Investigacao.reaproveitada.is_(True),
            Investigacao.criada_em >= original.criada_em,
        )
        .order_by(Investigacao.criada_em.desc())
        .limit(20)
    )
    return next((copia.analise for copia in copias if copia.analise), None)
