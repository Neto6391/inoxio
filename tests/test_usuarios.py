import pytest
from ajudantes import SENHA, csrf, entrar

NOVA = "outra-senha-bem-longa"


def cadastrar(cliente, nome="dani", papel="analista", senha=NOVA, com_csrf=True):
    cabecalho = csrf(cliente) if com_csrf else {}
    corpo = {"nome": nome, "papel": papel, "senha": senha}
    return cliente.post("/api/usuarios", json=corpo, headers=cabecalho)


def test_analista_nao_lista_nem_cadastra(cliente, usuarios):
    entrar(cliente, "ana")
    assert cliente.get("/api/usuarios").status_code == 403
    assert cadastrar(cliente).status_code == 403


def test_sem_sessao_e_401(cliente, usuarios):
    assert cliente.get("/api/usuarios").status_code == 401


def test_admin_lista_sem_expor_hash(cliente, usuarios):
    entrar(cliente, "chefe")
    lista = cliente.get("/api/usuarios").json()
    assert [usuario["nome"] for usuario in lista] == ["ana", "beto", "chefe"]
    assert set(lista[0]) == {"nome", "papel", "criado_em"}


def test_admin_cadastra_e_o_novo_usuario_entra(cliente, usuarios):
    entrar(cliente, "chefe")
    resposta = cadastrar(cliente)
    assert resposta.status_code == 201
    assert resposta.json()["nome"] == "dani"
    cliente.cookies.clear()
    assert entrar(cliente, "dani", NOVA).status_code == 200


def test_cadastro_sem_csrf_e_recusado(cliente, usuarios):
    entrar(cliente, "chefe")
    assert cadastrar(cliente, com_csrf=False).status_code == 403


def test_nome_repetido_e_409(cliente, usuarios):
    entrar(cliente, "chefe")
    resposta = cadastrar(cliente, nome="ana")
    assert resposta.status_code == 409
    assert resposta.json() == {"erro": "Já existe um usuário com esse nome."}


@pytest.mark.parametrize(
    ("campos", "trecho"),
    [
        ({"senha": "curta"}, "12 caracteres"),
        ({"nome": "Ana Maria"}, "de 3 a 32 caracteres"),
        ({"nome": "<script>"}, "de 3 a 32 caracteres"),
        ({"nome": "ab"}, "de 3 a 32 caracteres"),
        ({"papel": "root"}, "papel"),
    ],
)
def test_cadastro_invalido_e_400_com_motivo(cliente, usuarios, campos, trecho):
    entrar(cliente, "chefe")
    resposta = cadastrar(cliente, **campos)
    assert resposta.status_code == 400
    assert trecho in resposta.json()["erro"]


def test_senha_do_admin_segue_valendo_depois_do_cadastro(cliente, usuarios):
    entrar(cliente, "chefe")
    cadastrar(cliente)
    cliente.cookies.clear()
    assert entrar(cliente, "chefe", SENHA).status_code == 200
