from fastapi.testclient import TestClient


def test_api_tem_csp_que_nao_carrega_nada(cliente):
    # A página do React, com o nonce e a versão, é da borda: infra/ensaio-local/testar.sh.
    resposta = cliente.get("/api/sessao")
    politica = resposta.headers["content-security-policy"]
    assert politica.startswith("default-src 'none';")
    assert "frame-ancestors 'none'" in politica
    assert "x-inoxio-versao" not in resposta.headers
    assert resposta.headers["x-content-type-options"] == "nosniff"
    assert resposta.headers["referrer-policy"] == "no-referrer"


def test_api_inexistente_e_404_em_json(cliente):
    resposta = cliente.get("/api/nada")
    assert resposta.status_code == 404
    assert resposta.json() == {"erro": "Não encontrado."}


def test_o_app_nao_serve_o_react(cliente):
    resposta = cliente.get("/investigacoes/qualquer-id")
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
