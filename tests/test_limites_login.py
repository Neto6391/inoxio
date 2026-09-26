from concurrent.futures import ThreadPoolExecutor

from ajudantes import entrar
from fastapi.testclient import TestClient
from sqlalchemy import select

from inoxio.config import Config
from inoxio.db import TentativaLogin, agora
from inoxio.seguranca.limites import JANELA_LOGIN, origem
from inoxio.web.app import criar_app

ERRADA = "senha-errada-longa"


def test_sexta_tentativa_e_recusada_mesmo_com_a_senha_certa(cliente, usuarios):
    for _ in range(5):
        assert entrar(cliente, "ana", ERRADA).status_code == 401
    assert entrar(cliente, "ana").status_code == 429


def test_tentativas_em_paralelo_nao_furam_o_limite(cliente, usuarios):
    with ThreadPoolExecutor(10) as executor:
        respostas = list(
            executor.map(lambda _: entrar(cliente, "ana", ERRADA).status_code, range(10))
        )
    assert sorted(respostas) == [401] * 5 + [429] * 5


def test_bloqueio_e_por_conta(cliente, usuarios):
    for _ in range(5):
        entrar(cliente, "ana", ERRADA)
    assert entrar(cliente, "beto").status_code == 200


def test_bloqueio_por_ip(cliente, usuarios):
    for numero in range(20):
        entrar(cliente, f"fantasma{numero}", ERRADA)
    assert entrar(cliente, "beto").status_code == 429


def test_ipv6_conta_pela_rede_64():
    assert origem("2804:14c:1:2:aaaa::1") == origem("2804:14c:1:2:bbbb::9") == "2804:14c:1:2::/64"
    assert origem("2804:14c:1:3::1") != origem("2804:14c:1:2::1")
    assert origem("8.8.8.8") == "8.8.8.8"


def test_tentativas_fora_da_janela_sao_apagadas(cliente, usuarios, fabrica):
    with fabrica() as db, db.begin():
        db.add(
            TentativaLogin(nome="ana", ip="x", sucesso=False, criada_em=agora() - JANELA_LOGIN * 2)
        )
    entrar(cliente, "ana", ERRADA)
    with fabrica() as db:
        assert db.scalars(select(TentativaLogin.ip)).all() == ["testclient"]


def test_x_forwarded_for_forjado_e_ignorado(cliente, usuarios, fabrica):
    cliente.post(
        "/api/login",
        json={"nome": "ana", "senha": ERRADA},
        headers={"X-Forwarded-For": "6.6.6.6"},
    )
    with fabrica() as db:
        assert db.scalars(select(TentativaLogin.ip)).all() == ["testclient"]


def test_proxy_confiavel_repassa_o_ip(fabrica, usuarios, config):
    app = criar_app(
        Config(proxies_confiaveis="*", frontend_dir=config.frontend_dir), fabrica=fabrica
    )
    cliente = TestClient(app, base_url="https://testserver")
    cliente.post(
        "/api/login",
        json={"nome": "ana", "senha": ERRADA},
        headers={"X-Forwarded-For": "6.6.6.6"},
    )
    with fabrica() as db:
        assert db.scalars(select(TentativaLogin.ip)).all() == ["6.6.6.6"]
