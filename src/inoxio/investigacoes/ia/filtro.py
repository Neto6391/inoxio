"""Filtro do texto da IA: sem evidência não é garantia de que algo é seguro."""

from __future__ import annotations

import logging
import re
from typing import Any

log = logging.getLogger("inoxio.mente")


# Sem evidência não é garantia: a frase que diz que algo é seguro, ou que suaviza
# o resultado com outras palavras, sai da explicação.
PROIBIDAS = re.compile(
    r"\b(?P<palavra>segur[oa]s?|limp[oa]s?|leg[ií]tim[oa]s?|confiáve(l|is)|parecem? norma(l|is))\b"
    r"|não há motivo (imediato )?para|\bnão (é|seja|são) malicios[oa]s?\b"
    r"|se o ip fosse de um provedor",
    re.IGNORECASE,
)


# Negar é aviso, não garantia: "não é seguro", "não é um site confiável" ficam.
NEGADA = re.compile(
    r"\b(não|nem|nunca)\s+((é|está|são|estão|parece|parecem|seja|sejam|foi|for)\s+)?"
    r"((um|uma)\s+(site|link|endereço|ip|arquivo|domínio|servidor|lugar)\s+)?$",
    re.IGNORECASE,
)


# Conselho, não afirmação sobre o indicador: "senha segura", "conexão segura" ficam.
CONSELHO = re.compile(r"\b(senhas?|conex(ão|ões)|forma|maneira)\s+$", re.IGNORECASE)


# Fim de frase é pontuação seguida de espaço: o ponto de um endereço ou IP não separa.
# O ";" também não: a frase sai inteira ou fica inteira, sem meia frase solta.
SEPARADOR = re.compile(r"(?<=[.!?])\s+|\n+")


def para_exibir(analise: dict[str, Any] | None) -> dict[str, Any] | None:
    """Explicação guardada, passada pelo filtro atual: as antigas também seguem as regras de hoje."""
    return sem_garantia(analise) if analise else None


def frases(texto: str) -> list[str]:
    return [frase.strip() for frase in SEPARADOR.split(texto) if frase and frase.strip()]


def _proibida(frase: str) -> bool:
    for achado in PROIBIDAS.finditer(frase):
        antes = frase[: achado.start()]
        if achado.group("palavra") and (NEGADA.search(antes) or CONSELHO.search(antes)):
            continue
        return True
    return False


def _sem_frases_proibidas(texto: str) -> str:
    return " ".join(frase for frase in frases(texto) if not _proibida(frase))


def sem_garantia(analise: dict[str, Any]) -> dict[str, Any] | None:
    """Tira as frases que chamam o indicador de seguro, também do glossário. Sem resumo
    depois disso, sem análise; termo que fica sem significado sai da lista."""
    resumo = _sem_frases_proibidas(analise["resumo"])
    if not resumo:
        log.warning("mente_so_disse_que_era_seguro")
        return None
    recomendacoes = [r for r in map(_sem_frases_proibidas, analise["recomendacoes"]) if r]
    termos = [
        termo | {"significado": significado}
        for termo in analise.get("termos", [])
        if (significado := _sem_frases_proibidas(termo["significado"]))
    ]
    por_fonte = [p for p in map(_sem_frases_proibidas, analise.get("por_fonte", [])) if p]
    return analise | {
        "resumo": resumo,
        "recomendacoes": recomendacoes,
        "termos": termos,
        "por_fonte": por_fonte,
    }
