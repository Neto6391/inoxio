import pytest
from ajudantes import SENHA
from fastapi.testclient import TestClient

from inoxio.cli import criar_usuario
from inoxio.config import Config
from inoxio.db import criar_fabrica
from inoxio.web.app import criar_app

INDEX = '<!doctype html><meta name="csp-nonce" content="__CSP_NONCE__"><div id="raiz"></div>'


@pytest.fixture
def fabrica():
    return criar_fabrica("sqlite://")


@pytest.fixture
def config(tmp_path):
    # Um index.html mínimo no lugar do build do Vite: os testes não dependem do Node.
    (tmp_path / "index.html").write_text(INDEX, encoding="utf-8")
    return Config(frontend_dir=str(tmp_path))


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
