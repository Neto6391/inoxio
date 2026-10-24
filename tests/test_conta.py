import json

from ajudantes import SENHA, csrf, entrar
from fastapi.testclient import TestClient
from sqlalchemy import select

from inoxio.auditoria.modelos import Evento
from inoxio.contas.modelos import Sessao, Usuario
from inoxio.contas.regras import VERSAO_TERMOS
from inoxio.investigacoes.modelos import Investigacao


def id_de(fabrica, nome):
    with fabrica() as db:
        return db.scalar(select(Usuario.id).where(Usuario.nome == nome))


def investigar(fabrica, nome, valor):
    with fabrica() as db, db.begin():
        db.add(
            Investigacao(
                usuario_id=id_de(fabrica, nome),
                tipo="ip",
                valor=valor,
                veredito="sem_evidencia",
                evidencias=[],
            )
        )


def test_quem_ja_tinha_conta_aceita_os_termos_no_proximo_acesso(cliente, usuarios, fabrica):
    assert entrar(cliente, "ana").json()["usuario"]["termos_pendentes"] is True
    assert cliente.post("/api/sessao/termos").status_code == 403
    assert cliente.post("/api/sessao/termos", headers=csrf(cliente)).status_code == 204
    assert cliente.get("/api/sessao").json()["usuario"]["termos_pendentes"] is False
    with fabrica() as db:
        conta = db.scalar(select(Usuario).where(Usuario.nome == "ana"))
        assert conta.termos_versao == VERSAO_TERMOS
        assert (
            db.scalar(select(Evento.detalhe).where(Evento.tipo == "termos_aceitos"))
            == VERSAO_TERMOS
        )


def test_versao_nova_dos_termos_pede_aceite_de_novo(cliente, usuarios, fabrica):
    with fabrica() as db, db.begin():
        db.scalar(select(Usuario).where(Usuario.nome == "ana")).termos_versao = "2020-01-01"
    assert entrar(cliente, "ana").json()["usuario"]["termos_pendentes"] is True


def test_minha_conta_mostra_os_dados_do_proprio_usuario(cliente, usuarios):
    entrar(cliente, "ana")
    perfil = cliente.get("/api/conta").json()
    assert perfil["nome"] == "ana" and perfil["papel"] == "analista"
    assert "senha_hash" not in perfil


def test_baixar_meus_dados_traz_so_o_que_e_meu(cliente, usuarios, fabrica):
    investigar(fabrica, "ana", "8.8.8.8")
    investigar(fabrica, "beto", "6.6.6.6")
    entrar(cliente, "ana")
    resposta = cliente.get("/api/conta/dados")
    assert resposta.status_code == 200
    assert "attachment" in resposta.headers["content-disposition"]
    dados = json.loads(resposta.text)
    assert dados["conta"]["nome"] == "ana"
    assert [i["valor"] for i in dados["investigacoes"]] == ["8.8.8.8"]
    assert [e["tipo"] for e in dados["eventos_de_seguranca"]] == ["login"]
    assert "senha" not in resposta.text


def test_excluir_conta_apaga_tudo_e_anonimiza_a_auditoria(app, cliente, usuarios, fabrica):
    investigar(fabrica, "ana", "8.8.8.8")
    outra_sessao = TestClient(app, base_url="https://testserver")
    entrar(outra_sessao, "ana")
    entrar(cliente, "ana")
    resposta = cliente.post("/api/conta/excluir", json={"senha": SENHA}, headers=csrf(cliente))
    assert resposta.status_code == 204
    with fabrica() as db:
        assert db.scalar(select(Usuario).where(Usuario.nome == "ana")) is None
        assert db.scalars(select(Investigacao)).all() == []
        assert db.scalars(select(Sessao)).all() == []
        assert db.scalar(select(Evento).where(Evento.usuario == "ana")) is None
        excluida = db.scalar(select(Evento).where(Evento.tipo == "conta_excluida"))
        assert excluida.usuario is None
    assert outra_sessao.get("/api/investigacoes").status_code == 401
    assert entrar(TestClient(app, base_url="https://testserver"), "ana").status_code == 401


def test_excluir_tira_o_nome_do_detalhe_dos_eventos_do_admin(app, cliente, usuarios, fabrica):
    # O admin que cadastrou ou alterou a conta deixou o nome dela no detalhe do evento.
    entrar(cliente, "chefe")
    for nome in ("dani", "dan"):
        corpo = {"nome": nome, "senha": SENHA, "papel": "analista"}
        assert cliente.post("/api/usuarios", json=corpo, headers=csrf(cliente)).status_code == 201
        alterar = cliente.patch(
            f"/api/usuarios/{nome}", json={"cota_diaria": 5}, headers=csrf(cliente)
        )
        assert alterar.status_code == 200
    titular = TestClient(app, base_url="https://testserver")
    entrar(titular, "dan")
    resposta = titular.post("/api/conta/excluir", json={"senha": SENHA}, headers=csrf(titular))
    assert resposta.status_code == 204
    with fabrica() as db:
        detalhes = db.scalars(
            select(Evento.detalhe)
            .where(Evento.tipo.in_(("admin_cadastrou", "admin_alterou")))
            .order_by(Evento.id)
        ).all()
        eventos_do_admin = db.scalars(
            select(Evento.usuario).where(Evento.tipo == "admin_cadastrou")
        )
    # O nome "dani" começa com "dan": só a conta excluída perde o nome.
    assert detalhes == [
        "dani (analista)",
        "dani: cota 5/dia",
        "conta excluída (analista)",
        "conta excluída: cota 5/dia",
    ]
    assert set(eventos_do_admin) == {"chefe"}


def test_excluir_exige_a_senha_e_o_csrf(cliente, usuarios, fabrica):
    entrar(cliente, "ana")
    assert cliente.post("/api/conta/excluir", json={"senha": SENHA}).status_code == 403
    errada = cliente.post(
        "/api/conta/excluir", json={"senha": "outra-senha-longa"}, headers=csrf(cliente)
    )
    assert errada.status_code == 403
    assert id_de(fabrica, "ana") is not None


def test_ultimo_admin_nao_se_exclui(cliente, usuarios, fabrica):
    entrar(cliente, "chefe")
    resposta = cliente.post("/api/conta/excluir", json={"senha": SENHA}, headers=csrf(cliente))
    assert resposta.status_code == 409
    assert id_de(fabrica, "chefe") is not None


def test_pagina_publica_informa_o_contato(fabrica, config):
    from dataclasses import replace

    from inoxio.web.app import criar_app

    app = criar_app(replace(config, contato_privacidade="privacidade@exemplo.com"), fabrica=fabrica)
    dados = TestClient(app, base_url="https://testserver").get("/api/publico").json()
    assert dados == {
        "contato_privacidade": "privacidade@exemplo.com",
        "versao_termos": VERSAO_TERMOS,
    }


def test_excluir_tira_o_nome_das_aberturas_alheias(app, cliente, usuarios, fabrica):
    entrar(cliente, "chefe")
    for nome in ("dani", "dan"):
        corpo = {"nome": nome, "senha": SENHA, "papel": "analista"}
        cliente.post("/api/usuarios", json=corpo, headers=csrf(cliente))
        investigar(fabrica, nome, "8.8.8.8")
    with fabrica() as db:
        ids = {i.usuario_id: i.id for i in db.scalars(select(Investigacao))}
    for nome in ("dani", "dan"):
        assert cliente.get(f"/api/investigacoes/{ids[id_de(fabrica, nome)]}").status_code == 200
    id_dani = ids[id_de(fabrica, "dani")]
    titular = TestClient(app, base_url="https://testserver")
    entrar(titular, "dan")
    titular.post("/api/conta/excluir", json={"senha": SENHA}, headers=csrf(titular))
    with fabrica() as db:
        detalhes = db.scalars(
            select(Evento.detalhe).where(Evento.tipo == "investigacao_alheia").order_by(Evento.id)
        ).all()
    assert detalhes[0] == f"8.8.8.8 (de dani, {id_dani})"
    assert detalhes[1].startswith("8.8.8.8 (de conta excluída, ")
