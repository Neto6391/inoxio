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


def _classe_abuseipdb(dados: dict[str, Any]) -> str | None:
    score = dados["score"]
    if score >= 75:
        return "malicioso"
    return "suspeito" if score >= 25 else None


def _classe_virustotal(dados: dict[str, Any]) -> str | None:
    maliciosos = dados["malicioso"]
    if maliciosos >= 5:
        return "malicioso"
    # Poucas detecções com reputação positiva na comunidade costumam ser falso
    # positivo de antivírus: só contam se a reputação for zero ou negativa.
    if maliciosos >= 1 and dados.get("reputacao", 0) <= 0:
        return "suspeito"
    return None


_CLASSES = {"abuseipdb": _classe_abuseipdb, "virustotal": _classe_virustotal}


def _nota(respondidas: list[dict[str, Any]]) -> int | None:
    valores = []
    for item in respondidas:
        if item["fonte"] == "abuseipdb":
            valores.append(item["dados"]["score"])
        elif item["fonte"] == "virustotal":
            # Detecções descontadas pela reputação também não pesam na nota.
            contam = _classe_virustotal(item["dados"]) is not None
            valores.append(min(100, 10 * item["dados"]["malicioso"]) if contam else 0)
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
