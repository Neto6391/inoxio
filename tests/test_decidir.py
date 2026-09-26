import pytest

from inoxio.agente.decidir import NOTA_MALICIOSO, NOTA_SUSPEITO, ROTULOS, decidir_veredito
from inoxio.agente.fontes import evidencia


def abuse(score):
    return evidencia("abuseipdb", "ok", {"score": score, "relatos": 0, "pais": "", "isp": ""})


def vt(maliciosos, reputacao=0, suspeitos=0):
    return evidencia(
        "virustotal",
        "ok",
        {"malicioso": maliciosos, "suspeito": suspeitos, "reputacao": reputacao, "tags": []},
    )


FALHA_VT = evidencia("virustotal", "falha")
NAO_ACHOU_VT = evidencia("virustotal", "nao_encontrado")


@pytest.mark.parametrize(
    ("evidencias", "esperado"),
    [
        ([abuse(80)], ("malicioso", 80)),
        ([abuse(30)], ("suspeito", 30)),
        ([abuse(10), vt(0)], ("sem_evidencia", 10)),
        ([vt(5)], ("malicioso", 75)),
        ([vt(1)], ("suspeito", 25)),
        ([abuse(10), vt(7)], ("malicioso", 85)),
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
        ([vt(2, reputacao=0)], ("suspeito", 40)),
        ([vt(2, reputacao=-30)], ("suspeito", 40)),
        # A reputação nunca apaga 5 ou mais detecções.
        ([vt(6, reputacao=900)], ("malicioso", 80)),
    ],
)
def test_reputacao_positiva_desconta_poucas_deteccoes(evidencias, esperado):
    assert decidir_veredito(evidencias) == esperado


def test_sem_campo_de_reputacao_conta_como_zero():
    sem_reputacao = evidencia("virustotal", "ok", {"malicioso": 1, "suspeito": 0, "tags": []})
    assert decidir_veredito([sem_reputacao]) == ("suspeito", 25)


def faixa(nota):
    if nota >= NOTA_MALICIOSO:
        return "malicioso"
    return "suspeito" if nota >= NOTA_SUSPEITO else "sem_evidencia"


def test_nota_sempre_cai_na_faixa_do_veredito():
    for score in range(0, 101, 5):
        for maliciosos in range(15):
            for reputacao in (-10, 0, 10):
                for suspeitos in (0, 1, 3, 12):
                    for evidencias in (
                        [abuse(score), vt(maliciosos, reputacao, suspeitos)],
                        [vt(maliciosos, reputacao, suspeitos)],
                    ):
                        veredito, nota = decidir_veredito(evidencias)
                        caso = (score, maliciosos, reputacao, suspeitos, veredito, nota)
                        assert 0 <= nota <= 100, caso
                        assert faixa(nota) == veredito, caso


def test_mais_deteccoes_nunca_baixam_a_nota():
    notas = [decidir_veredito([vt(maliciosos)])[1] for maliciosos in range(15)]
    assert notas == sorted(notas)
    assert notas[10] == 100


@pytest.mark.parametrize(
    ("evidencias", "esperado"),
    [
        ([vt(0, suspeitos=3)], ("suspeito", 55)),
        ([vt(1, suspeitos=1)], ("suspeito", 40)),
        # Só "suspicious" nunca chega a malicioso, por mais motores que sejam.
        ([vt(0, suspeitos=12)], ("suspeito", 70)),
        ([vt(4, suspeitos=12)], ("suspeito", 70)),
        ([vt(5, suspeitos=12)], ("malicioso", 75)),
        # A reputação positiva também desconta as suspeitas.
        ([vt(0, reputacao=50, suspeitos=3)], ("sem_evidencia", 0)),
    ],
)
def test_deteccoes_suspeitas_somam_para_suspeito(evidencias, esperado):
    assert decidir_veredito(evidencias) == esperado
