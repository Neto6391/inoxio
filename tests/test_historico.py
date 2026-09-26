from datetime import timedelta

from sqlalchemy import select

from inoxio.cli import criar_usuario
from inoxio.db import Investigacao, Usuario, agora
from inoxio.historico import buscador


def gravar(fabrica, **campos):
    with fabrica() as db, db.begin():
        uid = db.scalar(select(Usuario.id))
        base = {
            "tipo": "ip",
            "valor": "8.8.8.8",
            "veredito": "malicioso",
            "nota": 70,
            "evidencias": [],
            "analise": None,
            "reaproveitada": False,
        }
        db.add(Investigacao(usuario_id=uid, **(base | campos)))


def preparar(fabrica):
    criar_usuario(fabrica, "ana", "analista", "senha-de-teste-longa")
    return buscador(fabrica)


def test_reaproveita_consulta_recente(fabrica):
    buscar = preparar(fabrica)
    gravar(fabrica)
    assert buscar("ip", "8.8.8.8")["veredito"] == "malicioso"
    assert buscar("ip", "1.1.1.1") is None


def test_nao_reaproveita_depois_de_24_horas(fabrica):
    buscar = preparar(fabrica)
    gravar(fabrica, criada_em=agora() - timedelta(hours=24, minutes=1))
    assert buscar("ip", "8.8.8.8") is None


def test_nao_reaproveita_inconclusivo(fabrica):
    buscar = preparar(fabrica)
    gravar(fabrica, veredito="inconclusivo")
    assert buscar("ip", "8.8.8.8") is None


def test_nao_reaproveita_resultado_com_fonte_em_falha(fabrica):
    # O AbuseIPDB bastou para "suspeito", mas o VirusTotal falhou e poderia dizer mais.
    buscar = preparar(fabrica)
    evidencias = [
        {"fonte": "abuseipdb", "status": "ok", "dados": {"score": 30}},
        {"fonte": "virustotal", "status": "falha", "dados": None},
    ]
    gravar(fabrica, veredito="suspeito", nota=30, evidencias=evidencias)
    assert buscar("ip", "8.8.8.8") is None


def test_nao_encadeia_reaproveitamentos(fabrica):
    # Uma cópia não renova o prazo: só a consulta original conta.
    buscar = preparar(fabrica)
    gravar(fabrica, reaproveitada=True)
    assert buscar("ip", "8.8.8.8") is None
