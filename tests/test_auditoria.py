from datetime import timedelta

import pytest
from ajudantes import SENHA, csrf, entrar
from fastapi.testclient import TestClient
from sqlalchemy import select

from inoxio.agente.fontes import evidencia
from inoxio.agente.grafo import construir_grafo
from inoxio.db import Evento, agora
from inoxio.web.app import criar_app

MALICIOSA = evidencia(
    "virustotal", "ok", {"malicioso": 7, "suspeito": 0, "reputacao": -5, "tags": []}
)


class Fonte:
    NOME = "virustotal"

    def consultar(self, tipo, valor):
        return dict(MALICIOSA)


@pytest.fixture
def app(fabrica, config):
    return criar_app(config, fabrica=fabrica, grafo=construir_grafo([Fonte()], None))


def eventos(fabrica, tipo=None):
    with fabrica() as db:
        consulta = select(Evento).order_by(Evento.id)
        if tipo:
            consulta = consulta.where(Evento.tipo == tipo)
        return [(e.tipo, e.usuario, e.ip, e.detalhe) for e in db.scalars(consulta)]


def test_login_logout_e_falhas_ficam_registrados(cliente, usuarios, fabrica):
    entrar(cliente, "ana", "senha-errada-longa")
    entrar(cliente, "ana")
    cliente.post("/api/logout", headers=csrf(cliente))
    assert [(t, u, ip) for t, u, ip, _ in eventos(fabrica)] == [
        ("login_falhou", "ana", "testclient"),
        ("login", "ana", "testclient"),
        ("logout", "ana", "testclient"),
    ]


def test_login_bloqueado_fica_registrado(cliente, usuarios, fabrica):
    for _ in range(6):
        entrar(cliente, "ana", "senha-errada-longa")
    assert eventos(fabrica, "login_bloqueado")[0][1] == "ana"


def test_investigacao_registra_o_indicador_e_o_veredito(cliente, usuarios, fabrica):
    entrar(cliente, "ana")
    cliente.post("/api/investigacoes", json={"entrada": "8.8.8.8"}, headers=csrf(cliente))
    assert eventos(fabrica, "investigacao") == [
        ("investigacao", "ana", "testclient", "ip 8.8.8.8 → malicioso")
    ]


def test_admin_abrindo_investigacao_alheia_fica_registrado(app, cliente, usuarios, fabrica):
    entrar(cliente, "ana")
    id_ = cliente.post(
        "/api/investigacoes", json={"entrada": "8.8.8.8"}, headers=csrf(cliente)
    ).json()["id"]
    cliente.get(f"/api/investigacoes/{id_}")
    assert eventos(fabrica, "investigacao_alheia") == []
    admin = TestClient(app, base_url="https://testserver")
    entrar(admin, "chefe")
    admin.get(f"/api/investigacoes/{id_}")
    # A tela consulta de novo enquanto a IA escreve: a mesma abertura conta uma vez.
    admin.get(f"/api/investigacoes/{id_}")
    assert eventos(fabrica, "investigacao_alheia") == [
        ("investigacao_alheia", "chefe", "testclient", f"8.8.8.8 (de ana, {id_})")
    ]


def test_abertura_alheia_volta_a_contar_depois_da_janela(app, cliente, usuarios, fabrica):
    entrar(cliente, "ana")
    id_ = cliente.post(
        "/api/investigacoes", json={"entrada": "8.8.8.8"}, headers=csrf(cliente)
    ).json()["id"]
    admin = TestClient(app, base_url="https://testserver")
    entrar(admin, "chefe")
    admin.get(f"/api/investigacoes/{id_}")
    with fabrica() as db, db.begin():
        for evento in db.scalars(select(Evento).where(Evento.tipo == "investigacao_alheia")):
            evento.quando = agora() - timedelta(minutes=31)
    admin.get(f"/api/investigacoes/{id_}")
    assert len(eventos(fabrica, "investigacao_alheia")) == 2


def test_so_a_dona_ve_a_investigacao_como_sua(app, cliente, usuarios):
    entrar(cliente, "ana")
    id_ = cliente.post(
        "/api/investigacoes", json={"entrada": "8.8.8.8"}, headers=csrf(cliente)
    ).json()["id"]
    assert cliente.get(f"/api/investigacoes/{id_}").json()["minha"] is True
    admin = TestClient(app, base_url="https://testserver")
    entrar(admin, "chefe")
    assert admin.get(f"/api/investigacoes/{id_}").json()["minha"] is False


def test_acoes_do_admin_ficam_registradas_sem_a_senha(cliente, usuarios, fabrica):
    entrar(cliente, "chefe")
    cabecalho = csrf(cliente)
    cliente.post(
        "/api/usuarios",
        json={"nome": "dani", "papel": "analista", "senha": "senha-de-dani-1"},
        headers=cabecalho,
    )
    cliente.patch(
        "/api/usuarios/dani",
        json={"senha": "senha-nova-de-dani", "ativo": False, "cota_diaria": 7},
        headers=cabecalho,
    )
    assert eventos(fabrica, "admin_cadastrou")[0][3] == "dani (analista)"
    detalhe = eventos(fabrica, "admin_alterou")[0][3]
    assert detalhe == "dani: senha trocada, desativada, cota 7/dia"
    assert "senha-nova-de-dani" not in str(eventos(fabrica))


def test_so_o_admin_le_a_auditoria(cliente, usuarios):
    entrar(cliente, "ana")
    assert cliente.get("/api/auditoria").status_code == 403


def test_filtro_paginacao_e_ordem(cliente, usuarios, fabrica):
    with fabrica() as db, db.begin():
        for numero in range(60):
            db.add(
                Evento(
                    tipo="login",
                    usuario="beto",
                    ip="1.2.3.4",
                    quando=agora() - timedelta(minutes=numero),
                )
            )
    entrar(cliente, "chefe")
    primeira = cliente.get("/api/auditoria", params={"usuario": "beto"}).json()
    segunda = cliente.get("/api/auditoria", params={"usuario": "beto", "pagina": 2}).json()
    assert (primeira["total"], len(primeira["itens"]), len(segunda["itens"])) == (60, 50, 10)
    quandos = [item["quando"] for item in primeira["itens"]]
    assert quandos == sorted(quandos, reverse=True)
    so_login_do_chefe = cliente.get(
        "/api/auditoria", params={"tipo": "login", "usuario": "chefe"}
    ).json()
    assert [item["usuario"] for item in so_login_do_chefe["itens"]] == ["chefe"]


def test_eventos_de_mais_de_90_dias_sao_apagados(cliente, usuarios, fabrica):
    with fabrica() as db, db.begin():
        db.add(
            Evento(tipo="login", usuario="velho", ip="1.2.3.4", quando=agora() - timedelta(days=91))
        )
    entrar(cliente, "ana", SENHA)
    assert all(usuario != "velho" for _, usuario, _, _ in eventos(fabrica))


def test_paginacao_absurda_nao_derruba_a_auditoria(cliente, usuarios):
    entrar(cliente, "chefe")
    resposta = cliente.get("/api/auditoria", params={"pagina": 10**19})
    assert resposta.status_code == 200
    assert resposta.json()["itens"] == []
