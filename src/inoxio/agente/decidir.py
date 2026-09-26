"""Veredito e nota de risco, calculados só por regras fixas."""

from typing import Any

ROTULOS = {
    "malicioso": "Malicioso",
    "suspeito": "Suspeito",
    "sem_evidencia": "Sem evidência de atividade maliciosa nas fontes consultadas",
    "desconhecido": "Desconhecido pelas fontes consultadas",
    "inconclusivo": "Inconclusivo: nem todas as fontes responderam",
}
_GRAVIDADE = {"suspeito": 1, "malicioso": 2}
# Faixas da nota: a partir de 25 é suspeito e a partir de 75 é malicioso. As duas
# fontes caem nas mesmas faixas, então a nota sempre combina com o veredito.
NOTA_SUSPEITO = 25
NOTA_MALICIOSO = 75


def _classe_abuseipdb(dados: dict[str, Any]) -> str | None:
    score = dados["score"]
    if score >= NOTA_MALICIOSO:
        return "malicioso"
    return "suspeito" if score >= NOTA_SUSPEITO else None


def _classe_virustotal(dados: dict[str, Any]) -> str | None:
    maliciosos = dados["malicioso"]
    if maliciosos >= 5:
        return "malicioso"
    # Poucas detecções com reputação positiva na comunidade costumam ser falso
    # positivo de antivírus: só contam se a reputação for zero ou negativa.
    if maliciosos >= 1 and dados.get("reputacao", 0) <= 0:
        return "suspeito"
    return None


def _nota_virustotal(dados: dict[str, Any]) -> int:
    # Cada detecção a mais sobe a nota dentro da faixa da classe: 1 a 4 detecções
    # vão de 25 a 70, e 5 ou mais partem de 75 e chegam a 100 com 10.
    maliciosos = dados["malicioso"]
    classe = _classe_virustotal(dados)
    if classe == "malicioso":
        return min(100, NOTA_MALICIOSO + 5 * (maliciosos - 5))
    if classe == "suspeito":
        return NOTA_SUSPEITO + 15 * (maliciosos - 1)
    # Detecções descontadas pela reputação também não pesam na nota.
    return 0


_CLASSES = {"abuseipdb": _classe_abuseipdb, "virustotal": _classe_virustotal}


def _nota(respondidas: list[dict[str, Any]]) -> int | None:
    valores = []
    for item in respondidas:
        if item["fonte"] == "abuseipdb":
            valores.append(item["dados"]["score"])
        elif item["fonte"] == "virustotal":
            valores.append(_nota_virustotal(item["dados"]))
    return max(valores) if valores else None


def decidir_veredito(evidencias: list[dict[str, Any]]) -> tuple[str, int | None]:
    """Aplica as regras na ordem; a primeira que casar decide."""
    respondidas = [item for item in evidencias if item["status"] == "ok"]
    nota = _nota(respondidas)
    classes = [classe for item in respondidas if (classe := _CLASSES[item["fonte"]](item["dados"]))]
    if classes:
        return max(classes, key=_GRAVIDADE.__getitem__), nota
    if not evidencias or any(item["status"] == "falha" for item in evidencias):
        return "inconclusivo", nota
    if all(item["status"] == "nao_encontrado" for item in evidencias):
        return "desconhecido", nota
    return "sem_evidencia", nota
