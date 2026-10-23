from datetime import timedelta

import pytest
from ajudantes import SENHA, CaixaDeSaida, csrf, entrar
from fastapi.testclient import TestClient
from sqlalchemy import select

from inoxio.auditoria.modelos import Evento
from inoxio.contas.modelos import Ativacao, Usuario
from inoxio.plataforma import horario
from inoxio.plataforma.banco import agora
from inoxio.web.app import criar_app

NOVA = "senha-do-cadastro-1"


@pytest.fixture
def caixa():
    return CaixaDeSaida()


@pytest.fixture
def app(fabrica, config, caixa):
    return criar_app(config, fabrica=fabrica, enviar_email=caixa)


def cadastrar(cliente, nome="dani", email="Dani@Exemplo.com", senha=NOVA, aceite=True):
    corpo = {"nome": nome, "email": email, "senha": senha, "aceite_termos": aceite}
    return cliente.post("/api/cadastro", json=corpo)


def usuario(fabrica, nome):
    with fabrica() as db:
        return db.scalar(select(Usuario).where(Usuario.nome == nome))


def test_cadastro_so_entra_depois_de_ativar_pelo_link(cliente, usuarios, caixa, fabrica):
    resposta = cadastrar(cliente)
    assert resposta.status_code == 202
    assert "link de ativação" in resposta.json()["mensagem"]
    novo = usuario(fabrica, "dani")
    assert (novo.email, novo.ativo, novo.papel, novo.cota_diaria) == (
        "dani@exemplo.com",
        False,
        "analista",
        10,
    )
    destino, assunto, texto = caixa.mensagens[0]
    assert destino == "dani@exemplo.com"
    # O token vai depois do "#": não chega ao servidor nem fica no log de acesso.
    assert "https://179.199.133.136/ativar#" in texto
    assert entrar(cliente, "dani", NOVA).status_code == 401
    assert cliente.post("/api/ativar", json={"token": caixa.token()}).status_code == 200
    assert entrar(cliente, "dani", NOVA).status_code == 200


def test_link_de_ativacao_e_de_uso_unico(cliente, usuarios, caixa):
    cadastrar(cliente)
    token = caixa.token()
    assert cliente.post("/api/ativar", json={"token": token}).status_code == 200
    assert cliente.post("/api/ativar", json={"token": token}).status_code == 400


def test_link_vencido_nao_ativa(cliente, usuarios, caixa, fabrica):
    cadastrar(cliente)
    with fabrica() as db, db.begin():
        db.scalar(select(Ativacao)).expira_em = agora() - timedelta(minutes=1)
    assert cliente.post("/api/ativar", json={"token": caixa.token()}).status_code == 400
    assert usuario(fabrica, "dani").ativo is False


def test_token_desconhecido_nao_ativa(cliente, usuarios):
    resposta = cliente.post("/api/ativar", json={"token": "inventado"})
    assert resposta.status_code == 400
    assert "inválido ou vencido" in resposta.json()["erro"]


def test_link_antigo_nao_reativa_conta_desativada_pelo_admin(app, cliente, usuarios, caixa):
    cadastrar(cliente)
    token = caixa.token()
    admin = TestClient(app, base_url="https://testserver")
    entrar(admin, "chefe")
    cabecalho = csrf(admin)
    admin.patch("/api/usuarios/dani", json={"ativo": True}, headers=cabecalho)
    admin.patch("/api/usuarios/dani", json={"ativo": False}, headers=cabecalho)
    assert cliente.post("/api/ativar", json={"token": token}).status_code == 400
    assert entrar(cliente, "dani", NOVA).status_code == 401


def test_email_ja_confirmado_responde_igual_e_nao_cria_nem_envia(cliente, usuarios, caixa, fabrica):
    primeira = cadastrar(cliente)
    assert cliente.post("/api/ativar", json={"token": caixa.token()}).status_code == 200
    segunda = cadastrar(cliente, nome="outro", email="DANI@exemplo.com")
    assert segunda.status_code == 202
    assert segunda.json() == primeira.json()
    assert usuario(fabrica, "outro") is None
    assert len(caixa.mensagens) == 1


def test_cadastro_repetido_de_conta_pendente_reenvia_o_link(cliente, usuarios, caixa, fabrica):
    # Quem se cadastrou e perdeu o e-mail (ou se cadastrou com o envio desligado)
    # recebe um link novo; a resposta continua igual à de um cadastro novo.
    primeira = cadastrar(cliente)
    antigo = caixa.token()
    segunda = cadastrar(
        cliente, nome="outro", email="DANI@exemplo.com", senha="outra-senha-qualquer"
    )
    assert segunda.json() == primeira.json()
    assert usuario(fabrica, "outro") is None
    assert len(caixa.mensagens) == 2
    destino, _, texto = caixa.mensagens[1]
    assert destino == "dani@exemplo.com" and "dani" in texto
    # Só o link mais novo vale.
    assert cliente.post("/api/ativar", json={"token": antigo}).status_code == 400
    assert cliente.post("/api/ativar", json={"token": caixa.token()}).status_code == 200
    # A senha é a do primeiro cadastro: o segundo não troca nada na conta.
    assert entrar(cliente, "dani", NOVA).status_code == 200


def test_conta_confirmada_e_desativada_pelo_admin_nao_recebe_link(app, cliente, usuarios, caixa):
    cadastrar(cliente)
    assert cliente.post("/api/ativar", json={"token": caixa.token()}).status_code == 200
    admin = TestClient(app, base_url="https://testserver")
    entrar(admin, "chefe")
    admin.patch("/api/usuarios/dani", json={"ativo": False}, headers=csrf(admin))
    cadastrar(cliente, nome="outro")
    assert len(caixa.mensagens) == 1


def test_nome_em_uso_e_409(cliente, usuarios):
    resposta = cadastrar(cliente, nome="ana")
    assert resposta.status_code == 409


@pytest.mark.parametrize(
    ("campos", "trecho"),
    [
        ({"email": "sem-arroba"}, "e-mail válido"),
        ({"email": "a@b"}, "e-mail válido"),
        ({"senha": "curta"}, "12 caracteres"),
        ({"nome": "Nome Com Espaco"}, "de 3 a 32"),
    ],
)
def test_cadastro_invalido_e_400(cliente, usuarios, campos, trecho, caixa):
    resposta = cadastrar(cliente, **campos)
    assert resposta.status_code == 400
    assert trecho in resposta.json()["erro"]
    assert caixa.mensagens == []


def test_limite_de_cadastros_por_ip(cliente, usuarios):
    for numero in range(5):
        assert (
            cadastrar(cliente, nome=f"pessoa{numero}", email=f"p{numero}@exemplo.com").status_code
            == 202
        )
    assert cadastrar(cliente, nome="pessoa9", email="p9@exemplo.com").status_code == 429


def test_sem_smtp_o_cadastro_fica_para_o_admin(fabrica, config, usuarios):
    cliente = TestClient(criar_app(config, fabrica=fabrica), base_url="https://testserver")
    resposta = cadastrar(cliente)
    assert resposta.status_code == 202
    assert "administrador" in resposta.json()["mensagem"]


def test_admin_ve_quem_espera_o_email_e_pode_ativar(cliente, usuarios, caixa):
    cadastrar(cliente)
    entrar(cliente, "chefe")
    pendente = next(u for u in cliente.get("/api/usuarios").json()["itens"] if u["nome"] == "dani")
    assert (pendente["pendente"], pendente["email"]) == (True, "dani@exemplo.com")
    resposta = cliente.patch("/api/usuarios/dani", json={"ativo": True}, headers=csrf(cliente))
    assert resposta.json()["pendente"] is False
    cliente.cookies.clear()
    assert entrar(cliente, "dani", NOVA).status_code == 200


def test_cota_diaria_vale_para_quem_se_cadastrou(fabrica, config, usuarios):
    from inoxio.investigacoes.modelos import Investigacao

    with fabrica() as db, db.begin():
        ana = db.scalar(select(Usuario).where(Usuario.nome == "ana"))
        ana.cota_diaria = 2
        for _ in range(2):
            db.add(
                Investigacao(
                    usuario_id=ana.id,
                    tipo="ip",
                    valor="8.8.8.8",
                    veredito="inconclusivo",
                    evidencias=[],
                    # Hoje em Brasília, a qualquer hora que o teste rode.
                    criada_em=horario.inicio_do_dia() + timedelta(seconds=1),
                )
            )
    cliente = TestClient(criar_app(config, fabrica=fabrica), base_url="https://testserver")
    entrar(cliente, "ana", SENHA)
    resposta = cliente.post(
        "/api/investigacoes", json={"entrada": "8.8.8.8"}, headers=csrf(cliente)
    )
    assert resposta.status_code == 429


def test_cadastro_sem_aceite_dos_termos_e_recusado(cliente, usuarios, caixa, fabrica):
    resposta = cadastrar(cliente, aceite=False)
    assert resposta.status_code == 400
    assert "Termos de Uso" in resposta.json()["erro"]
    assert usuario(fabrica, "dani") is None
    assert caixa.mensagens == []


def test_cadastro_guarda_a_versao_aceita(cliente, usuarios, fabrica):
    from inoxio.contas.regras import VERSAO_TERMOS

    cadastrar(cliente)
    novo = usuario(fabrica, "dani")
    assert novo.termos_versao == VERSAO_TERMOS
    assert novo.termos_aceitos_em is not None


def test_admin_recusa_conta_pendente_e_o_link_nao_a_ativa(app, cliente, usuarios, caixa, fabrica):
    cadastrar(cliente)
    token = caixa.token()
    admin = TestClient(app, base_url="https://testserver")
    entrar(admin, "chefe")
    resposta = admin.patch("/api/usuarios/dani", json={"ativo": False}, headers=csrf(admin))
    assert (resposta.json()["pendente"], resposta.json()["ativo"]) == (False, False)
    assert cliente.post("/api/ativar", json={"token": token}).status_code == 400
    # Um cadastro novo com o mesmo e-mail não manda outro link.
    cadastrar(cliente, nome="outro")
    assert len(caixa.mensagens) == 1
    assert entrar(cliente, "dani", NOVA).status_code == 401
    # O admin pode voltar atrás: reativar vale como confirmação.
    admin.patch("/api/usuarios/dani", json={"ativo": True}, headers=csrf(admin))
    assert entrar(cliente, "dani", NOVA).status_code == 200
    assert usuario(fabrica, "dani").recusada_em is None


def test_cadastro_com_email_existente_fica_em_nome_da_dona(cliente, usuarios, fabrica):
    cadastrar(cliente)
    cadastrar(cliente, nome="chefe", email="dani@exemplo.com")
    with fabrica() as db:
        nomes = [e.usuario for e in db.scalars(select(Evento).where(Evento.tipo == "cadastro"))]
    assert nomes == ["dani", "dani"]
