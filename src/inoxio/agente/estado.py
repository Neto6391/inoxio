"""Estado que atravessa os nós do grafo."""

from typing import Any, TypedDict


class Estado(TypedDict, total=False):
    entrada: str
    tipo: str
    valor: str
    motivo: str
    reaproveitada: bool
    evidencias: list[dict[str, Any]]
    veredito: str
    nota: int | None
    analise: dict[str, Any] | None
