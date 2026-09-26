"""Classificação da entrada: só segue o que for IP público, hash ou domínio."""

import ipaddress
import re

MOTIVO = "Entrada não reconhecida. Informe um IP público, um hash MD5/SHA-1/SHA-256 ou um domínio."
_HASH = re.compile(r"[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}")
_ROTULO = re.compile(r"(?!-)[a-z0-9-]{1,63}(?<!-)")


def classificar_entrada(entrada: str) -> tuple[str, str]:
    """Devolve (tipo, valor normalizado). Tipo "rejeitado" quando não reconhece."""
    texto = entrada.strip()
    if not texto or len(texto) > 253:
        return "rejeitado", ""
    try:
        ip = ipaddress.ip_address(texto)
    except ValueError:
        pass
    else:
        # is_global aceita multicast (224.0.0.0/4), que não é endereço de um host.
        publico = ip.is_global and not ip.is_multicast
        return ("ip", ip.compressed) if publico else ("rejeitado", "")
    minusculo = texto.lower()
    if _HASH.fullmatch(minusculo):
        return "hash", minusculo
    dominio = _dominio(minusculo)
    return ("dominio", dominio) if dominio else ("rejeitado", "")


def _dominio(texto: str) -> str | None:
    try:
        ascii_ = texto.rstrip(".").encode("idna").decode("ascii")
    except UnicodeError:
        return None
    rotulos = ascii_.split(".")
    if len(ascii_) > 253 or len(rotulos) < 2:
        return None
    if not all(_ROTULO.fullmatch(rotulo) for rotulo in rotulos):
        return None
    tld = rotulos[-1]
    return ascii_ if tld.isalpha() or tld.startswith("xn--") else None
