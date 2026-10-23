from datetime import date, timedelta

import pytest
from ajudantes import csrf, entrar
from fastapi.testclient import TestClient
from sqlalchemy import select

from inoxio.agente.fontes import evidencia
from inoxio.agente.grafo import construir_grafo
from inoxio.db import Evento, Sessao, Usuario, agora
from inoxio.seguranca.limites import FUSO_BRASILIA
from inoxio.web.app import criar_app


class Fonte:
    NOME = "virustotal"

    def consultar(self, tipo, valor):
        return evidencia("virustotal", "ok", {"malicioso": 0, "suspeito": 0, "reputacao": 0})


@pytest.fixture
def app(fabrica, config):
    return criar_app(config, fabrica=fabrica, grafo=construir_grafo([Fonte()], None))


def novo(app):
    return TestClient(app, base_url="https://testserver")


def sessoes(admin, nome, **periodo):
    resposta = admin.get(f"/api/auditoria/usuarios/{nome}/sessoes", params=periodo)
    assert resposta.status_code == 200
    dados = resposta.json()
    # As sessões vêm em páginas; aqui os testes olham a primeira.
    return dados | {
        "sessoes": dados["sessoes"]["itens"],
        "fora_de_sessao": dados["fora_de_sessao"]["itens"],
    }


def tipos(sessao):
    return [evento["tipo"] for evento in sessao["eventos"]]


def test_sessao_do_login_ao_logout(app, usuarios):
    ana = novo(app)
    entrar(ana, "ana")
    ana.post("/api/investigacoes", json={"entrada": "8.8.8.8"}, headers=csrf(ana))
    ana.post("/api/logout", headers=csrf(ana))
    admin = novo(app)
    entrar(admin, "chefe")
    [sessao] = sessoes(admin, "ana")["sessoes"]
    assert tipos(sessao) == ["login", "investigacao", "logout"]
    assert (sessao["aproximada"], sessao["motivo_fim"], sessao["acoes"]) == (False, "saiu", 1)
    assert sessao["fim"] >= sessao["inicio"]


def test_sessao_que_venceu_parada_termina_quando_venceu(app, usuarios, fabrica):
    ana = novo(app)
    entrar(ana, "ana")
    ultimo_uso = agora() - timedelta(minutes=61)
    # A sessão começou há 70 min e ficou parada nos últimos 61.
    with fabrica() as db, db.begin():
        sessao = db.scalar(select(Sessao))
        sessao.criada_em, sessao.ultimo_uso = agora() - timedelta(minutes=70), ultimo_uso
        db.scalar(select(Evento).where(Evento.tipo == "login")).quando = sessao.criada_em
    admin = novo(app)
    entrar(admin, "chefe")
    # O navegador não voltou: a sessão ainda está no banco, mas já venceu.
    [sessao] = sessoes(admin, "ana")["sessoes"]
    assert (sessao["aberta"], sessao["motivo_fim"]) == (False, "expirou: 1 h sem uso")
    assert sessao["fim"] == (ultimo_uso + timedelta(hours=1)).isoformat()
    # O navegador volta: a sessão sai do banco e o fim vira evento, com o mesmo momento.
    assert ana.get("/api/investigacoes").status_code == 401
    [sessao] = sessoes(admin, "ana")["sessoes"]
    assert tipos(sessao) == ["login", "sessao_encerrada"]
    assert sessao["fim"] == (ultimo_uso + timedelta(hours=1)).isoformat()


def test_sessao_aberta_diz_quando_vence(app, usuarios):
    ana = novo(app)
    entrar(ana, "ana")
    admin = novo(app)
    entrar(admin, "chefe")
    [sessao] = sessoes(admin, "ana")["sessoes"]
    assert sessao["aberta"] is True and sessao["fim"] is None
    assert sessao["expira_em"] > sessao["inicio"]


def test_admin_encerra_as_sessoes_sem_desativar(app, usuarios):
    ana = novo(app)
    entrar(ana, "ana")
    admin = novo(app)
    entrar(admin, "chefe")
    resposta = admin.patch(
        "/api/usuarios/ana", json={"encerrar_sessoes": True}, headers=csrf(admin)
    )
    assert resposta.status_code == 200 and resposta.json()["ativo"] is True
    assert ana.get("/api/investigacoes").status_code == 401
    [sessao] = sessoes(admin, "ana")["sessoes"]
    assert sessao["motivo_fim"] == "encerrada pelo admin"
    assert entrar(novo(app), "ana").status_code == 200


def test_desativar_registra_o_fim_das_sessoes(app, usuarios):
    entrar(novo(app), "ana")
    admin = novo(app)
    entrar(admin, "chefe")
    admin.patch("/api/usuarios/ana", json={"ativo": False}, headers=csrf(admin))
    [sessao] = sessoes(admin, "ana")["sessoes"]
    assert sessao["motivo_fim"] == "conta desativada pelo admin"


def test_eventos_antigos_viram_sessoes_aproximadas(app, usuarios, fabrica):
    base = agora() - timedelta(days=2)
    with fabrica() as db, db.begin():
        for minutos, tipo in ((0, "login"), (5, "investigacao"), (60, "login"), (70, "logout")):
            db.add(
                Evento(
                    tipo=tipo, usuario="ana", ip="1.2.3.4", quando=base + timedelta(minutes=minutos)
                )
            )
    admin = novo(app)
    entrar(admin, "chefe")
    segunda, primeira = sessoes(admin, "ana")["sessoes"]
    assert primeira["aproximada"] and segunda["aproximada"]
    assert tipos(primeira) == ["login", "investigacao"]
    # O login seguinte não diz como a primeira acabou.
    assert primeira["fim"] is None and primeira["aberta"] is False
    assert (tipos(segunda), segunda["motivo_fim"]) == (["login", "logout"], "saiu")


def test_periodo_em_dias_de_brasilia_e_eventos_fora_de_sessao(app, usuarios, fabrica):
    hoje = agora().replace(tzinfo=None)
    with fabrica() as db, db.begin():
        db.add(Evento(tipo="login", usuario="ana", ip="1.2.3.4", quando=hoje - timedelta(days=10)))
        db.add(
            Evento(
                tipo="login_falhou", usuario="ana", ip="5.6.7.8", quando=hoje - timedelta(days=10)
            )
        )
        db.add(Evento(tipo="login", usuario="ana", ip="1.2.3.4", quando=hoje - timedelta(hours=1)))
    admin = novo(app)
    entrar(admin, "chefe")
    tudo = sessoes(admin, "ana")
    assert len(tudo["sessoes"]) == 2
    assert [evento["tipo"] for evento in tudo["fora_de_sessao"]] == ["login_falhou"]
    antigo = (hoje - timedelta(days=10) + FUSO_BRASILIA.utcoffset(None)).date()
    recorte = sessoes(admin, "ana", de=antigo.isoformat(), ate=antigo.isoformat())
    assert len(recorte["sessoes"]) == 1 and len(recorte["fora_de_sessao"]) == 1
    vazio = sessoes(admin, "ana", de=date(2020, 1, 1).isoformat(), ate=date(2020, 1, 2).isoformat())
    assert vazio == {"sessoes": [], "fora_de_sessao": []}


def test_tabela_por_usuario(app, usuarios, fabrica):
    ana = novo(app)
    entrar(ana, "ana")
    ana.post("/api/investigacoes", json={"entrada": "8.8.8.8"}, headers=csrf(ana))
    entrar(novo(app), "beto", "senha-errada-de-teste")
    admin = novo(app)
    entrar(admin, "chefe")
    admin.patch("/api/usuarios/beto", json={"ativo": False}, headers=csrf(admin))
    linhas = {
        linha["nome"]: linha for linha in admin.get("/api/auditoria/usuarios").json()["itens"]
    }
    assert list(linhas) == ["ana", "beto", "chefe"]
    assert linhas["ana"] | {"ultimo_acesso": None} == {
        "nome": "ana",
        "papel": "analista",
        "situacao": "ativa",
        "ultimo_acesso": None,
        "sessoes": 1,
        "abertas": 1,
        "falhas_de_login": 0,
        "investigacoes": 1,
    }
    assert linhas["ana"]["ultimo_acesso"] is not None
    assert (linhas["beto"]["situacao"], linhas["beto"]["falhas_de_login"]) == ("desativada", 1)
    with fabrica() as db:
        assert db.scalar(select(Usuario).where(Usuario.nome == "beto")).ativo is False


def test_auditoria_por_usuario_e_so_do_admin(app, usuarios):
    ana = novo(app)
    entrar(ana, "ana")
    assert ana.get("/api/auditoria/usuarios").status_code == 403
    assert ana.get("/api/auditoria/usuarios/ana/sessoes").status_code == 403
    admin = novo(app)
    entrar(admin, "chefe")
    assert admin.get("/api/auditoria/usuarios/ninguem/sessoes").status_code == 404


def test_sessoes_e_eventos_de_fora_vem_em_paginas_de_5(app, usuarios, fabrica):
    base = agora() - timedelta(days=1)
    with fabrica() as db, db.begin():
        for n in range(12):
            db.add(
                Evento(
                    tipo="login", usuario="ana", ip="1.2.3.4", quando=base + timedelta(minutes=n)
                )
            )
    admin = novo(app)
    entrar(admin, "chefe")
    caminho = "/api/auditoria/usuarios/ana/sessoes"
    primeira = admin.get(caminho).json()["sessoes"]
    terceira = admin.get(caminho, params={"pagina": 3}).json()["sessoes"]
    assert (primeira["total"], len(primeira["itens"]), len(terceira["itens"])) == (12, 5, 2)
    assert primeira["itens"][0]["inicio"] > terceira["itens"][0]["inicio"]
    with fabrica() as db, db.begin():
        for n in range(7):
            falha = Evento(tipo="login_falhou", usuario="ana", ip="1.2.3.4", quando=base)
            falha.quando = base + timedelta(minutes=n)
            db.add(falha)
    fora = admin.get(caminho, params={"pagina_fora": 2}).json()["fora_de_sessao"]
    assert (fora["total"], fora["pagina"], len(fora["itens"])) == (7, 2, 2)


def test_tabela_por_usuario_usa_os_filtros_da_tela_de_usuarios(app, usuarios):
    admin = novo(app)
    entrar(admin, "chefe")
    resposta = admin.get(
        "/api/auditoria/usuarios", params={"papel": "analista", "busca": "an"}
    ).json()
    assert [linha["nome"] for linha in resposta["itens"]] == ["ana"]
    assert resposta["total"] == 1
