from datetime import datetime, timedelta

from ajudantes import csrf, entrar
from fastapi.testclient import TestClient
from sqlalchemy import select

from inoxio.db import Evento, Investigacao, Usuario
from inoxio.seguranca import limites


def conta(fabrica, nome, cota):
    with fabrica() as db, db.begin():
        usuario = db.scalar(select(Usuario).where(Usuario.nome == nome))
        usuario.cota_diaria = cota
        return usuario.id


def investigar_em(fabrica, usuario_id, quando, veredito="sem_evidencia", tipo="ip"):
    with fabrica() as db, db.begin():
        db.add(
            Investigacao(
                usuario_id=usuario_id,
                tipo=tipo,
                valor="8.8.8.8",
                veredito=veredito,
                evidencias=[],
                criada_em=quando,
            )
        )


def test_o_dia_da_cota_comeca_a_meia_noite_de_brasilia():
    # 02:22 UTC do dia 23 ainda é 23:22 do dia 22 em Brasília (UTC-3).
    assert limites.inicio_do_dia(datetime(2026, 10, 23, 2, 22)) == datetime(2026, 10, 22, 3, 0)
    assert limites.inicio_do_dia(datetime(2026, 10, 23, 2, 59, 59)) == datetime(2026, 10, 22, 3, 0)
    assert limites.inicio_do_dia(datetime(2026, 10, 23, 3, 0)) == datetime(2026, 10, 23, 3, 0)
    assert limites.inicio_do_dia(datetime(2026, 10, 23, 15, 0)) == datetime(2026, 10, 23, 3, 0)


def test_cota_zera_a_meia_noite_e_nao_em_24_horas(usuarios, fabrica):
    ana = conta(fabrica, "ana", 2)
    inicio = limites.inicio_do_dia()
    # Duas investigações um minuto antes da meia-noite não contam para hoje.
    for _ in range(2):
        investigar_em(fabrica, ana, inicio - timedelta(minutes=1))
    with fabrica() as db:
        assert limites.investigacao_excedida(db, db.get(Usuario, ana)) is False
    for _ in range(2):
        investigar_em(fabrica, ana, inicio + timedelta(seconds=1))
    with fabrica() as db:
        assert limites.investigacao_excedida(db, db.get(Usuario, ana)) is True


def test_creditos_mostram_cota_usados_restantes_e_a_renovacao(cliente, usuarios, fabrica):
    ana = conta(fabrica, "ana", 10)
    inicio = limites.inicio_do_dia()
    investigar_em(fabrica, ana, inicio - timedelta(minutes=5))
    for _ in range(3):
        investigar_em(fabrica, ana, inicio + timedelta(seconds=1))
    entrar(cliente, "ana")
    assert cliente.get("/api/creditos").json() == {
        "cota": 10,
        "usados": 3,
        "restantes": 7,
        "renova_em": (inicio + timedelta(days=1)).isoformat(),
        "por_hora": 20,
    }


def test_sem_cota_os_creditos_sao_ilimitados(cliente, usuarios, fabrica):
    chefe = conta(fabrica, "chefe", None)
    investigar_em(fabrica, chefe, limites.inicio_do_dia() + timedelta(seconds=1))
    entrar(cliente, "chefe")
    creditos = cliente.get("/api/creditos").json()
    assert (creditos["cota"], creditos["usados"], creditos["restantes"]) == (None, 1, None)


def test_restantes_nunca_ficam_negativos(cliente, usuarios, fabrica):
    ana = conta(fabrica, "ana", 1)
    for _ in range(3):
        investigar_em(fabrica, ana, limites.inicio_do_dia() + timedelta(seconds=1))
    entrar(cliente, "ana")
    assert cliente.get("/api/creditos").json()["restantes"] == 0


def test_creditos_pedem_sessao(cliente, usuarios):
    assert cliente.get("/api/creditos").status_code == 401


def test_serie_dos_14_dias_e_os_tipos_no_painel(cliente, usuarios, fabrica):
    ana = conta(fabrica, "ana", None)
    inicio = limites.inicio_do_dia()
    investigar_em(fabrica, ana, inicio + timedelta(seconds=1), "malicioso", "url")
    investigar_em(fabrica, ana, inicio + timedelta(seconds=2), "sem_evidencia", "url")
    # Um minuto antes da meia-noite de Brasília é ontem, mesmo que em UTC já seja hoje.
    investigar_em(fabrica, ana, inicio - timedelta(minutes=1), "suspeito", "dominio")
    investigar_em(fabrica, ana, inicio - timedelta(days=13), "sem_evidencia", "hash")
    # 14 dias atrás já fica fora do gráfico.
    investigar_em(fabrica, ana, inicio - timedelta(days=13, minutes=1), "malicioso", "ip")
    entrar(cliente, "ana")
    dados = cliente.get("/api/estatisticas").json()
    dias = dados["por_dia"]
    assert len(dias) == 14
    hoje = (inicio + timedelta(hours=3)).date()
    assert [d["dia"] for d in dias] == [str(hoje - timedelta(days=13 - i)) for i in range(14)]
    assert dias[-1]["vereditos"] == {"malicioso": 1, "sem_evidencia": 1}
    assert dias[-2]["vereditos"] == {"suspeito": 1}
    assert dias[0]["vereditos"] == {"sem_evidencia": 1}
    assert sum(sum(d["vereditos"].values()) for d in dias) == 4
    assert dados["por_tipo"] == {"url": 2, "dominio": 1, "hash": 1, "ip": 1}


def test_admin_nao_tem_cota_nem_com_uma_guardada_de_antes(cliente, usuarios, fabrica):
    # A conta virou admin pelo terminal e manteve a cota 1 do cadastro.
    chefe = conta(fabrica, "chefe", 1)
    for _ in range(2):
        investigar_em(fabrica, chefe, limites.inicio_do_dia() + timedelta(seconds=1))
    with fabrica() as db:
        assert limites.investigacao_excedida(db, db.get(Usuario, chefe)) is False
    entrar(cliente, "chefe")
    assert cliente.get("/api/creditos").json()["cota"] is None
    lista = {u["nome"]: u for u in cliente.get("/api/usuarios").json()["itens"]}
    assert lista["chefe"]["cota_diaria"] is None


def test_admin_zera_o_uso_de_hoje_e_os_creditos_voltam(app, cliente, usuarios, fabrica):
    ana = conta(fabrica, "ana", 2)
    for _ in range(2):
        investigar_em(fabrica, ana, limites.inicio_do_dia() + timedelta(seconds=1))
    with fabrica() as db:
        assert limites.investigacao_excedida(db, db.get(Usuario, ana)) is True
    entrar(cliente, "chefe")
    resposta = cliente.patch("/api/usuarios/ana", json={"zerar_uso": True}, headers=csrf(cliente))
    assert resposta.status_code == 200
    assert resposta.json()["cota_diaria"] == 2
    with fabrica() as db:
        assert limites.investigacao_excedida(db, db.get(Usuario, ana)) is False
        evento = db.scalar(select(Evento).where(Evento.tipo == "admin_alterou"))
        assert evento.detalhe == "ana: uso de hoje zerado"
    da_ana = TestClient(app, base_url="https://testserver")
    entrar(da_ana, "ana")
    assert da_ana.get("/api/creditos").json()["restantes"] == 2


def test_virar_admin_tira_a_cota_e_admin_nao_recebe_cota(cliente, usuarios, fabrica):
    conta(fabrica, "ana", 10)
    entrar(cliente, "chefe")
    cabecalho = csrf(cliente)
    resposta = cliente.patch("/api/usuarios/ana", json={"papel": "admin"}, headers=cabecalho)
    assert resposta.json()["cota_diaria"] is None
    with fabrica() as db:
        assert db.scalar(select(Usuario).where(Usuario.nome == "ana")).cota_diaria is None
    recusa = cliente.patch("/api/usuarios/ana", json={"cota_diaria": 5}, headers=cabecalho)
    assert recusa.status_code == 400
    assert "admin não tem cota" in recusa.json()["erro"]
