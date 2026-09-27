"""Classificação da entrada: só segue o que for IP público, hash ou domínio.

Endereço de site (https://exemplo.com/pagina) vira o domínio dele, e o indicador
"desarmado", como analistas costumam colar (hxxps://exemplo[.]com), é aceito.
"""

import ipaddress
import re
from urllib.parse import SplitResult, urlsplit

MOTIVO = (
    "Entrada não reconhecida. Informe o endereço de um site, um domínio, um IP público "
    "ou um hash MD5/SHA-1/SHA-256."
)
# Endereços de site com parâmetros de rastreamento passam fácil de algumas centenas.
LIMITE_ENTRADA = 2048
_ESQUEMAS = {"http", "https"}
_ESQUEMA_DESARMADO = re.compile(r"^hxxp(s?)://", re.IGNORECASE)
_PONTO_DESARMADO = re.compile(r"\[\.\]|\(\.\)|\[dot\]", re.IGNORECASE)
_HASH = re.compile(r"[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}")
_ROTULO = re.compile(r"(?!-)[a-z0-9-]{1,63}(?<!-)")
# Prefixo NAT64 (RFC 6052): embute um IPv4 qualquer, inclusive privado.
_NAT64 = ipaddress.ip_network("64:ff9b::/96")


def _desarmado(texto: str) -> str:
    return _PONTO_DESARMADO.sub(".", _ESQUEMA_DESARMADO.sub(r"http\1://", texto))


def _endereco(texto: str) -> tuple[str | None, SplitResult | None]:
    """O host e as partes de um endereço de site; o próprio texto quando não é endereço."""
    if "://" in texto:
        partes = urlsplit(texto)
        if partes.scheme.lower() not in _ESQUEMAS:
            return None, None
        return partes.hostname, partes
    if "/" in texto:
        # Sem o esquema não dá para saber qual URL é; vale só o host.
        return urlsplit("//" + texto).hostname, None
    return texto, None


def _classificar_host(texto: str) -> tuple[str, str]:
    if not texto or len(texto) > 253:
        return "rejeitado", ""
    try:
        ip = ipaddress.ip_address(texto)
    except ValueError:
        pass
    else:
        # A zona (fe80::1%eth0) aceita texto livre depois do %.
        if getattr(ip, "scope_id", None) or ip in _NAT64:
            return "rejeitado", ""
        # ::ffff:8.8.8.8 é o mesmo endereço que 8.8.8.8.
        ip = getattr(ip, "ipv4_mapped", None) or ip
        # is_global aceita multicast (224.0.0.0/4), que não é endereço de um host.
        publico = ip.is_global and not ip.is_multicast
        return ("ip", ip.compressed) if publico else ("rejeitado", "")
    minusculo = texto.lower()
    if _HASH.fullmatch(minusculo):
        return "hash", minusculo
    dominio = _dominio(minusculo)
    return ("dominio", dominio) if dominio else ("rejeitado", "")


def _url(partes: SplitResult, host: str) -> str:
    """URL normalizada: sem usuário, senha nem fragmento, com o host já validado."""
    host_na_url = f"[{host}]" if ":" in host else host
    porta = f":{partes.port}" if partes.port else ""
    consulta = f"?{partes.query}" if partes.query else ""
    return f"{partes.scheme.lower()}://{host_na_url}{porta}{partes.path or '/'}{consulta}"


def classificar_entrada(entrada: str) -> tuple[str, str]:
    """Devolve (tipo, valor normalizado). Tipo "rejeitado" quando não reconhece.

    Endereço com caminho ou parâmetros vira "url"; sem eles, vale o host.
    """
    if len(entrada) > LIMITE_ENTRADA:
        return "rejeitado", ""
    try:
        host, partes = _endereco(_desarmado(entrada.strip()))
        tipo, valor = _classificar_host(host or "")
        if partes is None:
            return tipo, valor
        if tipo in ("rejeitado", "hash"):
            return "rejeitado", ""
        if (partes.path or "/") == "/" and not partes.query:
            return tipo, valor
        return "url", _url(partes, valor)
    except ValueError:
        # Porta inválida ou endereço malformado.
        return "rejeitado", ""


def host_da_url(url: str) -> tuple[str, str]:
    """O domínio ou IP de uma URL já normalizada por classificar_entrada."""
    return _classificar_host(urlsplit(url).hostname or "")


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
