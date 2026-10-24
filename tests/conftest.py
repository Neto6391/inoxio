import pytest
from ajudantes import SENHA
from fastapi.testclient import TestClient

from inoxio.cli import criar_usuario
from inoxio.plataforma.banco import criar_fabrica
from inoxio.plataforma.config import Config
from inoxio.web.app import criar_app


@pytest.fixture
def fabrica():
    return criar_fabrica("sqlite://")


@pytest.fixture
def config():
    return Config()


@pytest.fixture
def app(fabrica, config):
    return criar_app(config, fabrica=fabrica)


@pytest.fixture
def cliente(app):
    # https: o cookie de sessão é Secure e não volta por http.
    return TestClient(app, base_url="https://testserver")


@pytest.fixture
def usuarios(fabrica):
    for nome, papel in (("ana", "analista"), ("beto", "analista"), ("chefe", "admin")):
        criar_usuario(fabrica, nome, papel, SENHA)
