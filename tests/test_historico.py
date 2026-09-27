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


def test_analise_obtida_numa_copia_e_reaproveitada(fabrica):
    # A IA falhou na consulta original e respondeu num reaproveitamento seguinte:
    # os próximos reaproveitamentos usam essa análise, sem chamar a IA de novo.
    buscar = preparar(fabrica)
    gravar(fabrica, analise=None)
    gravar(fabrica, reaproveitada=True, analise={"resumo": "da cópia"})
    gravar(fabrica, valor="1.1.1.1", reaproveitada=True, analise={"resumo": "de outro IP"})
    assert buscar("ip", "8.8.8.8")["analise"] == {"resumo": "da cópia"}


def test_analise_de_copia_de_um_ciclo_anterior_nao_vale(fabrica):
    # Uma cópia de antes da consulta original descreve outras evidências.
    buscar = preparar(fabrica)
    gravar(
        fabrica,
        reaproveitada=True,
        analise={"resumo": "velha"},
        criada_em=agora() - timedelta(hours=30),
    )
    gravar(fabrica, analise=None)
    assert buscar("ip", "8.8.8.8")["analise"] is None


def test_falha_so_no_contexto_do_dns_ainda_reaproveita(fabrica):
    buscar = preparar(fabrica)
    evidencias = [
        {"fonte": "virustotal", "status": "ok", "dados": {"malicioso": 0}},
        {"fonte": "dns", "status": "falha", "dados": {}, "contexto": True},
    ]
    gravar(
        fabrica,
        tipo="dominio",
        valor="exemplo.com",
        veredito="sem_evidencia",
        evidencias=evidencias,
    )
    assert buscar("dominio", "exemplo.com") is not None
