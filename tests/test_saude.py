from fastapi.testclient import TestClient


def test_saude_responde_ok_sem_detalhe(cliente):
    resposta = cliente.get("/saude")
    assert resposta.status_code == 200
    assert resposta.text == "ok"


def test_documentacao_automatica_desligada(cliente):
    assert "swagger" not in cliente.get("/docs").text.lower()
    assert '"openapi"' not in cliente.get("/openapi.json").text


def test_head_responde_como_get(cliente):
    # Monitores de disponibilidade costumam testar com HEAD.
    assert cliente.head("/saude").status_code == 200
    assert cliente.head("/").status_code == 200


def test_cliente_http_fecha_quando_o_app_para(app):
    with TestClient(app, base_url="https://testserver"):
        assert not app.state.cliente_http.is_closed
    assert app.state.cliente_http.is_closed
