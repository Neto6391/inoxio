from datetime import timedelta

from ajudantes import SENHA, csrf, entrar
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from inoxio.db import Sessao, agora
from inoxio.seguranca.sessoes import NOME_COOKIE


def test_sem_sessao_o_app_sabe_que_ninguem_entrou_sem_erro(cliente):
    # 200 com usuário nulo: a tela de login abre sem erro vermelho no console.
    resposta = cliente.get("/api/sessao")
    assert resposta.status_code == 200
    assert resposta.json() == {"usuario": None, "csrf": None}


def test_rotas_protegidas_sem_sessao_sao_401(cliente):
    assert cliente.get("/api/investigacoes").status_code == 401


def test_login_certo_devolve_usuario_e_token_csrf(cliente, usuarios):
    resposta = entrar(cliente, "ana")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["usuario"] == {"nome": "ana", "papel": "analista"}
    assert len(corpo["csrf"]) >= 32
    assert cliente.get("/api/sessao").json()["usuario"]["nome"] == "ana"


def test_cookie_de_sessao_protegido(cliente, usuarios):
    cookie = entrar(cliente, "ana").headers["set-cookie"].lower()
    assert cookie.startswith(NOME_COOKIE.lower() + "=")
    for atributo in ("httponly", "secure", "samesite=strict", "path=/"):
        assert atributo in cookie


def test_usuario_inexistente_e_senha_errada_respondem_igual(cliente, usuarios):
    inexistente = entrar(cliente, "ninguem")
    errada = entrar(cliente, "ana", "senha-errada-longa")
    assert inexistente.status_code == errada.status_code == 401
    assert inexistente.json() == errada.json() == {"erro": "Usuário ou senha inválidos."}


def test_login_por_formulario_e_recusado(cliente, usuarios):
    # Um formulário de outro site não consegue mandar JSON sem passar pelo CORS.
    resposta = cliente.post("/api/login", data={"nome": "ana", "senha": SENHA})
    assert resposta.status_code == 400


def test_erro_de_validacao_nao_ecoa_a_entrada(cliente):
    resposta = cliente.post("/api/login", json={"nome": "eco" * 40, "senha": "x"})
    assert resposta.status_code == 400
    assert "eco" not in resposta.text


def test_banco_guarda_so_o_hash_do_token(cliente, usuarios, fabrica):
    entrar(cliente, "ana")
    token = cliente.cookies.get(NOME_COOKIE)
    with fabrica() as db:
        hashes = db.scalars(select(Sessao.token_hash)).all()
    assert len(hashes) == 1
    assert token not in hashes
    assert len(hashes[0]) == 64


def test_login_troca_o_token_e_fecha_o_antigo(cliente, usuarios, app):
    entrar(cliente, "ana")
    primeiro = cliente.cookies.get(NOME_COOKIE)
    entrar(cliente, "ana")
    assert cliente.cookies.get(NOME_COOKIE) != primeiro
    antigo = TestClient(app, base_url="https://testserver", cookies={NOME_COOKIE: primeiro})
    assert antigo.get("/api/investigacoes").status_code == 401


def test_logout_invalida_no_servidor(cliente, usuarios, app):
    entrar(cliente, "ana")
    token = cliente.cookies.get(NOME_COOKIE)
    assert cliente.post("/api/logout", headers=csrf(cliente)).status_code == 204
    velho = TestClient(app, base_url="https://testserver", cookies={NOME_COOKIE: token})
    assert velho.get("/api/investigacoes").status_code == 401


def test_logout_sem_csrf_e_recusado(cliente, usuarios):
    entrar(cliente, "ana")
    assert cliente.post("/api/logout").status_code == 403
    assert cliente.post("/api/logout", headers={"X-CSRF-Token": "outro"}).status_code == 403


def test_sessao_ociosa_expira(cliente, usuarios, fabrica):
    entrar(cliente, "ana")
    with fabrica() as db, db.begin():
        db.execute(update(Sessao).values(ultimo_uso=agora() - timedelta(minutes=31)))
    assert cliente.get("/api/investigacoes").status_code == 401


def test_sessao_passa_de_8_horas_expira(cliente, usuarios, fabrica):
    entrar(cliente, "ana")
    with fabrica() as db, db.begin():
        db.execute(update(Sessao).values(criada_em=agora() - timedelta(hours=8, minutes=1)))
    assert cliente.get("/api/investigacoes").status_code == 401
