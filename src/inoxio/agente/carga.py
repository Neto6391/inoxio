"""Dados enviados à IA: JSON compacto de no máximo 2 KiB."""

import json
from typing import Any

LIMITE_BYTES = 2048
# Cortes tentados em ordem (caracteres por texto, itens por lista) até caber;
# None significa sem corte.
_CORTES = ((None, None), (120, 12), (60, 6))


def _json(dados: Any) -> str:
    return json.dumps(dados, ensure_ascii=False, separators=(",", ":"))


def _encurtar(valor: Any, max_caracteres: int | None, max_itens: int | None) -> Any:
    if isinstance(valor, str):
        return valor[:max_caracteres]
    if isinstance(valor, list):
        return [_encurtar(item, max_caracteres, max_itens) for item in valor[:max_itens]]
    if isinstance(valor, dict):
        return {chave: _encurtar(item, max_caracteres, max_itens) for chave, item in valor.items()}
    return valor


def montar_carga(dados: dict[str, Any]) -> str:
    for max_caracteres, max_itens in _CORTES:
        carga = _json(_encurtar(dados, max_caracteres, max_itens))
        if len(carga.encode()) <= LIMITE_BYTES:
            return carga
    raise ValueError("carga acima de 2 KiB mesmo encurtada")
