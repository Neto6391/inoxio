"""Os IPs públicos de um domínio, como contexto, sem entrar no veredito."""

from __future__ import annotations

import ipaddress
import socket
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from inoxio.investigacoes.fontes.base import Fonte, consultar_uma, evidencia


def _resolver_no_sistema(dominio: str) -> list[str]:
    return [info[4][0] for info in socket.getaddrinfo(dominio, None, proto=socket.IPPROTO_TCP)]


def _publicos(enderecos: list[str]) -> list[str]:
    """IPs públicos, sem repetição, IPv4 antes de IPv6."""
    vistos: dict[str, ipaddress.IPv4Address | ipaddress.IPv6Address] = {}
    for endereco in enderecos:
        try:
            ip = ipaddress.ip_address(endereco.split("%")[0])
        except ValueError:
            continue
        if ip.is_global and not ip.is_multicast:
            vistos.setdefault(ip.compressed, ip)
    return [texto for texto, ip in sorted(vistos.items(), key=lambda par: par[1].version)]


# A consulta de DNS do sistema não aceita timeout; roda aqui e a espera é limitada.
_DNS = ThreadPoolExecutor(max_workers=4, thread_name_prefix="dns")


class ResolucaoDNS:
    """IPs públicos de um domínio e a reputação deles no AbuseIPDB, só como contexto.

    Sites grandes ficam atrás de CDN e hospedagem compartilhada: o mesmo IP serve
    milhares de domínios, então a fama do IP não decide nada sobre o domínio.
    O servidor só pergunta ao DNS; nunca se conecta ao site.
    """

    NOME = "dns"
    # Só os primeiros vão ao AbuseIPDB: cada IP é uma consulta da cota. Os outros aparecem
    # na tela, sem consulta, até LISTADOS_NO_MAXIMO (um teto para o que fica guardado).
    MAX_IPS = 2
    LISTADOS_NO_MAXIMO = 50

    def __init__(
        self,
        abuseipdb: Fonte,
        resolver: Callable[[str], list[str]] = _resolver_no_sistema,
        timeout: float = 3.0,
    ) -> None:
        self._abuseipdb = abuseipdb
        self._resolver = resolver
        self._timeout = timeout

    def consultar(self, tipo: str, valor: str) -> dict[str, Any] | None:
        if tipo != "dominio":
            return None
        try:
            enderecos = _DNS.submit(self._resolver, valor).result(timeout=self._timeout)
        except socket.gaierror:
            return evidencia(self.NOME, "nao_encontrado", contexto=True)
        except Exception:
            return evidencia(self.NOME, "falha", contexto=True)
        publicos = _publicos(enderecos)[: self.LISTADOS_NO_MAXIMO]
        ips, outros = publicos[: self.MAX_IPS], publicos[self.MAX_IPS :]
        if not ips:
            return evidencia(self.NOME, "nao_encontrado", contexto=True)
        with ThreadPoolExecutor(max_workers=len(ips)) as executor:
            respostas = list(executor.map(lambda ip: consultar_uma(self._abuseipdb, "ip", ip), ips))
        itens = [
            {"ip": ip, "abuseipdb": resposta["status"], **resposta["dados"]}
            for ip, resposta in zip(ips, respostas, strict=True)
        ]
        dados: dict[str, Any] = {"ips": itens}
        if outros:
            dados["outros_ips"] = outros
        return evidencia(self.NOME, "ok", dados, contexto=True)
