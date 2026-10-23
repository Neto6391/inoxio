"""Endereços de origem: como um IP conta nos limites e na auditoria."""

from __future__ import annotations

import ipaddress


def origem(ip: str) -> str:
    """IPv6 conta pela rede /64: quem tem uma tem milhões de endereços para trocar."""
    try:
        endereco = ipaddress.ip_address(ip)
    except ValueError:
        return ip[:64]
    if endereco.version == 6:
        return str(ipaddress.ip_network(f"{endereco}/64", strict=False))
    return str(endereco)
