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
