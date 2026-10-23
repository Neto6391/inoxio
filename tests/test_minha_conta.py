import pytest
from ajudantes import SENHA, CaixaDeSaida, csrf, entrar
from fastapi.testclient import TestClient
from sqlalchemy import select

from inoxio.db import Evento, TrocaEmail, Usuario
from inoxio.web.app import criar_app

NOVA = "senha-nova-bem-longa"


@pytest.fixture
def caixa():
    return CaixaDeSaida()


@pytest.fixture
def app(fabrica, config, caixa):
    return criar_app(config, fabrica=fabrica, enviar_email=caixa)


def novo(app):
    return TestClient(app, base_url="https://testserver")


def com_email(fabrica, nome, email):
    with fabrica() as db, db.begin():
        db.scalar(select(Usuario).where(Usuario.nome == nome)).email = email


def test_titular_corrige_o_nome_de_exibicao_e_nao_o_papel(cliente, usuarios, fabrica):
    entrar(cliente, "ana")
    corpo = {"nome_exibicao": "  Ana   Maria  ", "papel": "admin"}
    resposta = cliente.patch("/api/conta", json=corpo, headers=csrf(cliente))
    assert resposta.status_code == 200
    assert (resposta.json()["nome_exibicao"], resposta.json()["papel"]) == ("Ana Maria", "analista")
    assert cliente.get("/api/sessao").json()["usuario"]["nome_exibicao"] == "Ana Maria"
    # Em branco volta a mostrar o nome de usuário.
    vazio = cliente.patch("/api/conta", json={"nome_exibicao": " "}, headers=csrf(cliente))
    assert vazio.json()["nome_exibicao"] is None
    with fabrica() as db:
        evento = db.scalar(select(Evento).where(Evento.tipo == "conta_alterada"))
        assert (evento.usuario, evento.detalhe) == ("ana", "nome de exibição")
        assert evento.sessao is not None


@pytest.mark.parametrize("nome", ["x" * 81, "Ana\u0007"])
def test_nome_de_exibicao_invalido_e_400(cliente, usuarios, nome):
    entrar(cliente, "ana")
    resposta = cliente.patch("/api/conta", json={"nome_exibicao": nome}, headers=csrf(cliente))
    assert resposta.status_code == 400


def test_corrigir_dados_exige_csrf(cliente, usuarios):
    entrar(cliente, "ana")
    assert cliente.patch("/api/conta", json={"nome_exibicao": "Ana"}).status_code == 403


def test_troca_de_senha_pede_a_atual_e_mantem_so_esta_sessao(app, usuarios):
    outra = novo(app)
    entrar(outra, "ana")
    esta = novo(app)
    entrar(esta, "ana")
    errada = esta.post(
        "/api/conta/senha", json={"atual": "nao-e-a-senha", "nova": NOVA}, headers=csrf(esta)
    )
    assert (errada.status_code, errada.json()["erro"]) == (403, "Senha atual incorreta.")
    certa = esta.post("/api/conta/senha", json={"atual": SENHA, "nova": NOVA}, headers=csrf(esta))
    assert certa.status_code == 204
    assert esta.get("/api/investigacoes").status_code == 200
    assert outra.get("/api/investigacoes").status_code == 401
    assert entrar(novo(app), "ana", SENHA).status_code == 401
    assert entrar(novo(app), "ana", NOVA).status_code == 200


def test_senha_nova_curta_nao_troca_nada(app, usuarios):
    esta = novo(app)
    entrar(esta, "ana")
    curta = esta.post(
        "/api/conta/senha", json={"atual": SENHA, "nova": "curta"}, headers=csrf(esta)
    )
    assert curta.status_code == 400
    assert entrar(novo(app), "ana", SENHA).status_code == 200


def test_senha_atual_errada_passa_pelo_limite_do_login(app, usuarios):
    esta = novo(app)
    entrar(esta, "ana")
    respostas = [
        esta.post(
            "/api/conta/senha", json={"atual": "errada-errada", "nova": NOVA}, headers=csrf(esta)
        ).status_code
        for _ in range(12)
    ]
    assert 429 in respostas


def test_troca_de_email_so_vale_depois_do_link(app, usuarios, fabrica, caixa):
    com_email(fabrica, "ana", "ana@exemplo.com")
    ana = novo(app)
    entrar(ana, "ana")
    corpo = {"senha": SENHA, "email": "Ana.Nova@Exemplo.com"}
    resposta = ana.post("/api/conta/email", json=corpo, headers=csrf(ana))
    assert resposta.status_code == 202
    destinos = [destino for destino, _, _ in caixa.mensagens]
    assert destinos == ["ana.nova@exemplo.com", "ana@exemplo.com"]
    perfil = ana.get("/api/conta").json()
    assert (perfil["email"], perfil["email_pendente"]) == (
        "ana@exemplo.com",
        "ana.nova@exemplo.com",
    )
    token = caixa.mensagens[0][2].split("/confirmar-email#")[1].split()[0]
    # O link vale sem sessão: pode ser aberto em outro aparelho.
    confirmar = novo(app).post("/api/conta/email/confirmar", json={"token": token})
    assert confirmar.status_code == 200
    perfil = ana.get("/api/conta").json()
    assert (perfil["email"], perfil["email_pendente"]) == ("ana.nova@exemplo.com", None)
    assert novo(app).post("/api/conta/email/confirmar", json={"token": token}).status_code == 400
    with fabrica() as db:
        tipos = [e.tipo for e in db.scalars(select(Evento).where(Evento.usuario == "ana"))]
    assert {"email_troca_pedida", "email_trocado"} <= set(tipos)


def test_email_de_outra_conta_responde_igual_e_nao_envia(app, usuarios, fabrica, caixa):
    com_email(fabrica, "beto", "beto@exemplo.com")
    ana = novo(app)
    entrar(ana, "ana")
    corpo = {"senha": SENHA, "email": "beto@exemplo.com"}
    resposta = ana.post("/api/conta/email", json=corpo, headers=csrf(ana))
    assert resposta.status_code == 202
    assert caixa.mensagens == []
    with fabrica() as db:
        assert db.scalar(select(TrocaEmail)) is None


def test_link_nao_troca_se_o_email_foi_tomado_no_meio_tempo(app, usuarios, fabrica, caixa):
    ana = novo(app)
    entrar(ana, "ana")
    ana.post(
        "/api/conta/email", json={"senha": SENHA, "email": "livre@exemplo.com"}, headers=csrf(ana)
    )
    token = caixa.mensagens[0][2].split("/confirmar-email#")[1].split()[0]
    com_email(fabrica, "beto", "livre@exemplo.com")
    assert novo(app).post("/api/conta/email/confirmar", json={"token": token}).status_code == 400


def test_troca_de_email_pede_senha_e_tem_limite(app, usuarios):
    ana = novo(app)
    entrar(ana, "ana")
    errada = ana.post(
        "/api/conta/email",
        json={"senha": "errada-errada", "email": "a@exemplo.com"},
        headers=csrf(ana),
    )
    assert errada.status_code == 403
    status = [
        ana.post(
            "/api/conta/email",
            json={"senha": SENHA, "email": f"a{n}@exemplo.com"},
            headers=csrf(ana),
        ).status_code
        for n in range(4)
    ]
    assert status == [202, 202, 202, 429]


def test_sem_envio_de_email_a_troca_fica_com_o_admin(fabrica, config, usuarios):
    cliente = TestClient(criar_app(config, fabrica=fabrica), base_url="https://testserver")
    entrar(cliente, "ana")
    corpo = {"senha": SENHA, "email": "a@exemplo.com"}
    resposta = cliente.post("/api/conta/email", json=corpo, headers=csrf(cliente))
    assert resposta.status_code == 503


def test_perfil_do_admin_nao_mostra_cota(cliente, usuarios, fabrica):
    with fabrica() as db, db.begin():
        db.scalar(select(Usuario).where(Usuario.nome == "chefe")).cota_diaria = 10
    entrar(cliente, "chefe")
    assert cliente.get("/api/conta").json()["cota_diaria"] is None


def test_excluir_a_conta_apaga_a_troca_de_email_pendente(app, usuarios, fabrica, caixa):
    ana = novo(app)
    entrar(ana, "ana")
    ana.post("/api/conta/email", json={"senha": SENHA, "email": "x@exemplo.com"}, headers=csrf(ana))
    ana.post("/api/conta/excluir", json={"senha": SENHA}, headers=csrf(ana))
    with fabrica() as db:
        assert db.scalar(select(TrocaEmail)) is None
