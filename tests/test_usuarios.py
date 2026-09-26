import pytest
from ajudantes import SENHA, csrf, entrar
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text

from inoxio.db import Usuario, criar_fabrica

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
    assert set(lista[0]) == {"nome", "papel", "criado_em", "ativo"}


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


def alterar(cliente, nome, com_csrf=True, **campos):
    cabecalho = csrf(cliente) if com_csrf else {}
    return cliente.patch(f"/api/usuarios/{nome}", json=campos, headers=cabecalho)


def outro_cliente(app):
    return TestClient(app, base_url="https://testserver")


def test_desativado_nao_entra_e_perde_a_sessao_aberta(app, cliente, usuarios):
    da_ana = outro_cliente(app)
    entrar(da_ana, "ana")
    entrar(cliente, "chefe")
    resposta = alterar(cliente, "ana", ativo=False)
    assert resposta.status_code == 200
    assert resposta.json()["ativo"] is False
    assert da_ana.get("/api/investigacoes").status_code == 401
    recusa = entrar(outro_cliente(app), "ana")
    assert recusa.status_code == 401
    # Mesma resposta de senha errada: não revela que a conta existe e está desativada.
    assert recusa.json() == {"erro": "Usuário ou senha inválidos."}


def test_reativado_volta_a_entrar(app, cliente, usuarios):
    entrar(cliente, "chefe")
    alterar(cliente, "ana", ativo=False)
    alterar(cliente, "ana", ativo=True)
    assert entrar(outro_cliente(app), "ana").status_code == 200


def test_senha_nova_derruba_as_sessoes_e_so_ela_vale(app, cliente, usuarios):
    da_ana = outro_cliente(app)
    entrar(da_ana, "ana")
    entrar(cliente, "chefe")
    assert alterar(cliente, "ana", senha=NOVA).status_code == 200
    assert da_ana.get("/api/investigacoes").status_code == 401
    assert entrar(outro_cliente(app), "ana", SENHA).status_code == 401
    assert entrar(outro_cliente(app), "ana", NOVA).status_code == 200


def test_troca_de_papel(cliente, usuarios):
    entrar(cliente, "chefe")
    assert alterar(cliente, "ana", papel="admin").json()["papel"] == "admin"


def test_admin_nao_desativa_a_propria_conta(cliente, usuarios):
    entrar(cliente, "chefe")
    resposta = alterar(cliente, "chefe", ativo=False)
    assert resposta.status_code == 409
    assert "própria conta" in resposta.json()["erro"]


def test_ultimo_admin_ativo_nao_perde_o_papel(cliente, usuarios):
    entrar(cliente, "chefe")
    resposta = alterar(cliente, "chefe", papel="analista")
    assert resposta.status_code == 409
    assert "pelo menos um admin" in resposta.json()["erro"]


def test_com_outro_admin_o_papel_pode_sair(cliente, usuarios):
    entrar(cliente, "chefe")
    alterar(cliente, "ana", papel="admin")
    assert alterar(cliente, "ana", ativo=False).status_code == 200
    # "ana" desativada não conta: "chefe" volta a ser o último admin ativo.
    assert alterar(cliente, "chefe", papel="analista").status_code == 409


@pytest.mark.parametrize(
    ("campos", "status"),
    [({"senha": "curta"}, 400), ({"papel": "root"}, 400)],
)
def test_alteracao_invalida_nao_muda_nada(app, cliente, usuarios, campos, status):
    entrar(cliente, "chefe")
    assert alterar(cliente, "ana", **campos).status_code == status
    assert entrar(outro_cliente(app), "ana").status_code == 200


def test_alterar_exige_admin_csrf_e_usuario_existente(app, cliente, usuarios):
    da_ana = outro_cliente(app)
    entrar(da_ana, "ana")
    assert alterar(da_ana, "beto", ativo=False).status_code == 403
    entrar(cliente, "chefe")
    assert alterar(cliente, "beto", com_csrf=False, ativo=False).status_code == 403
    assert alterar(cliente, "ninguem", ativo=False).status_code == 404


def test_banco_antigo_ganha_a_coluna_ativo_com_todos_ativos(tmp_path):
    url = f"sqlite:///{tmp_path / 'antigo.db'}"
    motor = create_engine(url)
    with motor.begin() as conexao:
        conexao.execute(
            text(
                "CREATE TABLE usuarios (id VARCHAR(36) PRIMARY KEY, nome VARCHAR(64) UNIQUE, "
                "senha_hash VARCHAR(255), papel VARCHAR(16), criado_em DATETIME)"
            )
        )
        conexao.execute(
            text("INSERT INTO usuarios VALUES ('1', 'velho', 'x', 'admin', '2026-09-26')")
        )
    motor.dispose()
    criar_fabrica(url)
    criar_fabrica(url)  # rodar de novo não pode falhar
    motor = create_engine(url)
    assert "ativo" in {coluna["name"] for coluna in inspect(motor).get_columns("usuarios")}
    with motor.connect() as conexao:
        assert conexao.execute(text("SELECT ativo FROM usuarios")).scalar() == 1


def test_sessao_de_conta_desativada_direto_no_banco_nao_vale(cliente, usuarios, fabrica):
    # Desativar por fora da API não apaga as sessões; a validação da sessão barra.
    entrar(cliente, "ana")
    with fabrica() as db, db.begin():
        db.scalar(select(Usuario).where(Usuario.nome == "ana")).ativo = False
    assert cliente.get("/api/investigacoes").status_code == 401
