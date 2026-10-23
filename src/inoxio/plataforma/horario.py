"""O dia de Brasília, onde as cotas zeram."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone

from inoxio.plataforma.banco import agora

# A cota zera à meia-noite de Brasília. O Brasil está sem horário de verão desde
# 2019; se ele voltar, o deslocamento fixo precisa virar o fuso America/Sao_Paulo.
FUSO_BRASILIA = timezone(timedelta(hours=-3))


def inicio_do_dia(momento: datetime | None = None) -> datetime:
    """Meia-noite de Brasília do dia de `momento`, em UTC sem fuso, como o banco guarda."""
    em_brasilia = (momento or agora()).replace(tzinfo=UTC).astimezone(FUSO_BRASILIA)
    meia_noite = em_brasilia.replace(hour=0, minute=0, second=0, microsecond=0)
    return meia_noite.astimezone(UTC).replace(tzinfo=None)
