import re
from pathlib import Path

from fastapi.testclient import TestClient


def test_api_tem_csp_estrita_sem_nonce(cliente):
    resposta = cliente.get("/api/sessao")
    politica = resposta.headers["content-security-policy"]
    assert "style-src 'self';" in politica
    assert "frame-ancestors 'none'" in politica
    assert resposta.headers["x-content-type-options"] == "nosniff"
    assert resposta.headers["referrer-policy"] == "no-referrer"


def test_pagina_do_react_leva_nonce_novo_no_cabecalho_e_na_meta(cliente):
    nonces = []
    for _ in range(2):
        resposta = cliente.get("/")
        politica = resposta.headers["content-security-policy"]
        nonce = re.search(r"'nonce-([^']+)'", politica).group(1)
        assert f'content="{nonce}"' in resposta.text
        assert "__CSP_NONCE__" not in resposta.text
        assert "script-src 'self';" in politica
        assert resposta.headers["cache-control"] == "no-store"
        nonces.append(nonce)
    assert nonces[0] != nonces[1]


def test_rotas_do_react_devolvem_a_pagina(cliente):
    resposta = cliente.get("/investigacoes/qualquer-id")
    assert resposta.status_code == 200
    assert 'id="raiz"' in resposta.text


def test_api_inexistente_e_404_em_json(cliente):
    resposta = cliente.get("/api/nada")
    assert resposta.status_code == 404
    assert resposta.json() == {"erro": "Não encontrado."}


def test_500_sem_stack_trace(app):
    def explodir():
        raise RuntimeError("detalhe-interno-secreto")

    app.add_api_route("/api/explodir", explodir)
    # A rota nova entra no fim da lista; ela precisa vir antes do /api/{resto} genérico.
    app.router.routes.insert(0, app.router.routes.pop())
    cliente = TestClient(app, base_url="https://testserver", raise_server_exceptions=False)
    resposta = cliente.get("/api/explodir")
    assert resposta.status_code == 500
    assert "detalhe-interno-secreto" not in resposta.text
    assert "Traceback" not in resposta.text


def test_arquivos_do_react_saem_com_o_tipo_certo(config, cliente):
    # Com nosniff, um .js servido como text/plain não executa: a tela fica em branco.
    ativos = Path(config.frontend_dir) / "assets"
    ativos.mkdir()
    (ativos / "app.js").write_text("export {};", encoding="utf-8")
    (ativos / "app.css").write_text("body{}", encoding="utf-8")
    assert cliente.get("/assets/app.js").headers["content-type"].startswith("text/javascript")
    assert cliente.get("/assets/app.css").headers["content-type"].startswith("text/css")
