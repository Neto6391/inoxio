"""Listas em páginas: o mesmo envelope em toda a API (total, página, por página, itens)."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

# Além disso o deslocamento não cabe no inteiro do SQLite e a consulta dava erro 500.
PAGINA_MAXIMA = 1_000_000


def numero(pagina: int) -> int:
    return min(max(1, pagina), PAGINA_MAXIMA)


def envelope(total: int, pagina: int, por_pagina: int, itens: list[Any]) -> dict[str, Any]:
    return {"total": total, "pagina": pagina, "por_pagina": por_pagina, "itens": itens}


def da_lista(
    itens: Sequence[Any], pagina: int, por_pagina: int, montar: Callable[[Any], Any] = lambda x: x
) -> dict[str, Any]:
    """Para listas que já estão na memória (contas, sessões reconstruídas)."""
    pagina = numero(pagina)
    inicio = (pagina - 1) * por_pagina
    fatia = [montar(item) for item in itens[inicio : inicio + por_pagina]]
    return envelope(len(itens), pagina, por_pagina, fatia)


def da_consulta(
    db: Session, consulta: Select, pagina: int, por_pagina: int, montar: Callable[[Any], Any]
) -> dict[str, Any]:
    """Para tabelas que crescem: o banco conta e devolve só a página."""
    pagina = numero(pagina)
    total = db.scalar(select(func.count()).select_from(consulta.order_by(None).subquery()))
    linhas = db.scalars(consulta.offset((pagina - 1) * por_pagina).limit(por_pagina))
    return envelope(total, pagina, por_pagina, [montar(linha) for linha in linhas])
