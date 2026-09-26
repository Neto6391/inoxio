import pytest

from inoxio.agente.decidir import ROTULOS, decidir_veredito
from inoxio.agente.fontes import evidencia


def abuse(score):
    return evidencia("abuseipdb", "ok", {"score": score, "relatos": 0, "pais": "", "isp": ""})


def vt(maliciosos, reputacao=0):
    return evidencia(
        "virustotal",
        "ok",
        {"malicioso": maliciosos, "suspeito": 0, "reputacao": reputacao, "tags": []},
    )


FALHA_VT = evidencia("virustotal", "falha")
NAO_ACHOU_VT = evidencia("virustotal", "nao_encontrado")


@pytest.mark.parametrize(
    ("evidencias", "esperado"),
    [
        ([abuse(80)], ("malicioso", 80)),
        ([abuse(30)], ("suspeito", 30)),
        ([abuse(10), vt(0)], ("sem_evidencia", 10)),
        ([vt(5)], ("malicioso", 50)),
        ([vt(1)], ("suspeito", 10)),
        ([abuse(10), vt(7)], ("malicioso", 70)),
        ([abuse(30), FALHA_VT], ("suspeito", 30)),
        ([abuse(0), FALHA_VT], ("inconclusivo", 0)),
        ([NAO_ACHOU_VT], ("desconhecido", None)),
        ([abuse(0), NAO_ACHOU_VT], ("sem_evidencia", 0)),
        ([], ("inconclusivo", None)),
        ([evidencia("abuseipdb", "falha"), FALHA_VT], ("inconclusivo", None)),
    ],
)
def test_regras_da_spec(evidencias, esperado):
    assert decidir_veredito(evidencias) == esperado


def test_rotulos_nunca_dizem_seguro_ou_limpo():
    texto = " ".join(ROTULOS.values()).lower()
    assert "seguro" not in texto
    assert "limpo" not in texto


@pytest.mark.parametrize(
    ("evidencias", "esperado"),
    [
        # Caso real: google.com, com 2 detecções e reputação +725.
        ([vt(2, reputacao=725)], ("sem_evidencia", 0)),
        ([vt(4, reputacao=1)], ("sem_evidencia", 0)),
        ([vt(2, reputacao=0)], ("suspeito", 20)),
        ([vt(2, reputacao=-30)], ("suspeito", 20)),
        # A reputação nunca apaga 5 ou mais detecções.
        ([vt(6, reputacao=900)], ("malicioso", 60)),
    ],
)
def test_reputacao_positiva_desconta_poucas_deteccoes(evidencias, esperado):
    assert decidir_veredito(evidencias) == esperado


def test_sem_campo_de_reputacao_conta_como_zero():
    sem_reputacao = evidencia("virustotal", "ok", {"malicioso": 1, "suspeito": 0, "tags": []})
    assert decidir_veredito([sem_reputacao]) == ("suspeito", 10)
