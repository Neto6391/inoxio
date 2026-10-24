import re
from datetime import timedelta
from pathlib import Path

import pytest
from ajudantes import SENHA, CaixaDeSaida, csrf, entrar
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from inoxio.auditoria.modelos import Evento
from inoxio.auditoria.trilha import NOMES_EVENTO
from inoxio.contas import credenciais
from inoxio.contas.modelos import Ativacao, RedefinicaoSenha, Usuario
from inoxio.plataforma.banco import agora
from inoxio.web.app import criar_app

NOVA = "senha-nova-bem-longa"


@pytest.fixture
def caixa():
    return CaixaDeSaida()


@pytest.fixture
def app(fabrica, config, caixa):
    return criar_app(config, fabrica=fabrica, enviar_email=caixa)


def com_email(fabrica, nome, email, confirmado=True):
    with fabrica() as db, db.begin():
        conta = db.scalar(select(Usuario).where(Usuario.nome == nome))
        conta.email = email
        conta.email_confirmado_em = agora() if confirmado else None


def pedir(cliente, email="ana@exemplo.com"):
    return cliente.post("/api/senha/esqueci", json={"email": email})


def redefinir(cliente, token, senha=NOVA):
    return cliente.post("/api/senha/redefinir", json={"token": token, "senha": senha})


def contar(fabrica, modelo):
    with fabrica() as db:
        return db.scalar(select(func.count()).select_from(modelo))


def test_link_por_email_troca_a_senha_e_derruba_as_sessoes(app, cliente, usuarios, caixa, fabrica):
    com_email(fabrica, "ana", "ana@exemplo.com")
    aberta = TestClient(app, base_url="https://testserver")
    entrar(aberta, "ana")
    assert pedir(cliente, "ANA@exemplo.com").status_code == 202
    destino, assunto, texto = caixa.mensagens[0]
    assert destino == "ana@exemplo.com" and "senha" in assunto.lower() and "ana" in texto
    # O token vai depois do "#": não chega ao servidor nem fica no log de acesso.
    assert "https://179.199.133.136/redefinir#" in texto
    token = caixa.token("/redefinir#")
    assert redefinir(cliente, token).status_code == 200
    assert entrar(cliente, "ana").status_code == 401
    assert entrar(cliente, "ana", NOVA).status_code == 200
    assert aberta.get("/api/investigacoes").status_code == 401
    # Uso único: o mesmo link não troca a senha de novo.
    assert redefinir(cliente, token, "outra-senha-bem-longa").status_code == 400
    assert contar(fabrica, RedefinicaoSenha) == 0


@pytest.mark.parametrize(
    "preparar",
    ["desconhecido", "pendente", "desativada", "sem_email"],
)
def test_resposta_igual_e_nenhum_email_quando_nao_ha_conta_ativa(
    cliente, usuarios, caixa, fabrica, preparar
):
    com_email(fabrica, "ana", "ana@exemplo.com")
    referencia = pedir(cliente).json()
    caixa.mensagens.clear()
    if preparar == "pendente":
        com_email(fabrica, "beto", "beto@exemplo.com", confirmado=False)
    if preparar == "desativada":
        com_email(fabrica, "beto", "beto@exemplo.com")
        with fabrica() as db, db.begin():
            db.scalar(select(Usuario).where(Usuario.nome == "beto")).ativo = False
    email = {"desconhecido": "ninguem@exemplo.com", "sem_email": "chefe@exemplo.com"}.get(
        preparar, "beto@exemplo.com"
    )
    resposta = pedir(cliente, email)
    assert resposta.status_code == 202
    assert resposta.json() == referencia
    assert caixa.mensagens == []


def test_link_vencido_nao_troca(cliente, usuarios, caixa, fabrica):
    com_email(fabrica, "ana", "ana@exemplo.com")
    pedir(cliente)
    with fabrica() as db, db.begin():
        db.scalar(select(RedefinicaoSenha)).expira_em = agora() - timedelta(minutes=1)
    resposta = redefinir(cliente, caixa.token("/redefinir#"))
    assert resposta.status_code == 400
    assert "inválido ou vencido" in resposta.json()["erro"]
    assert entrar(cliente, "ana").status_code == 200


def test_senha_curta_e_recusada_sem_gastar_o_link(cliente, usuarios, caixa, fabrica):
    com_email(fabrica, "ana", "ana@exemplo.com")
    pedir(cliente)
    token = caixa.token("/redefinir#")
    curta = redefinir(cliente, token, "curta")
    assert curta.status_code == 400
    assert "12 caracteres" in curta.json()["erro"]
    assert redefinir(cliente, token).status_code == 200


def test_pedido_de_outra_pessoa_nao_derruba_o_link_que_a_dona_pediu(
    cliente, usuarios, caixa, fabrica
):
    # Qualquer um pode pedir com o e-mail da ana; isso não pode invalidar o link dela.
    com_email(fabrica, "ana", "ana@exemplo.com")
    pedir(cliente)
    o_da_ana = caixa.token("/redefinir#")
    pedir(cliente)
    assert redefinir(cliente, o_da_ana).status_code == 200
    # Trocada a senha, nenhum outro link da conta vale mais.
    assert redefinir(cliente, caixa.token("/redefinir#")).status_code == 400


def test_no_maximo_tres_emails_por_conta_por_hora_de_ips_diferentes(usuarios, caixa, fabrica):
    from fastapi.testclient import TestClient

    from inoxio.plataforma.config import Config

    app = criar_app(
        Config(proxies_confiaveis="*"),
        fabrica=fabrica,
        enviar_email=caixa,
    )
    com_email(fabrica, "ana", "ana@exemplo.com")
    for n in range(5):
        # Um IP diferente por pedido: o limite por IP não segura, o da conta segura.
        outro = TestClient(
            app, base_url="https://testserver", headers={"X-Forwarded-For": f"198.51.100.{n}"}
        )
        assert pedir(outro).status_code == 202
    assert len(caixa.mensagens) == 3


def test_limite_de_pedidos_por_ip(cliente, usuarios, caixa, fabrica):
    com_email(fabrica, "ana", "ana@exemplo.com")
    for _ in range(5):
        assert pedir(cliente, "ninguem@exemplo.com").status_code == 202
    assert pedir(cliente).status_code == 429
    assert caixa.mensagens == []


def test_sem_smtp_a_resposta_manda_falar_com_o_admin(fabrica, config, usuarios):
    cliente = TestClient(criar_app(config, fabrica=fabrica), base_url="https://testserver")
    com_email(fabrica, "ana", "ana@exemplo.com")
    resposta = pedir(cliente)
    assert resposta.status_code == 202
    assert "administrador" in resposta.json()["mensagem"]
    assert contar(fabrica, RedefinicaoSenha) == 0


def test_auditoria_registra_o_pedido_e_a_troca_sem_o_email_digitado(
    app, cliente, usuarios, caixa, fabrica
):
    com_email(fabrica, "ana", "ana@exemplo.com")
    pedir(cliente, "ninguem@exemplo.com")
    pedir(cliente)
    redefinir(cliente, caixa.token("/redefinir#"))
    with fabrica() as db:
        eventos = [
            {"tipo": e.tipo, "usuario": e.usuario, "detalhe": e.detalhe}
            for e in db.scalars(select(Evento))
        ]
    nossos = [(e["tipo"], e["usuario"]) for e in eventos if e["tipo"].startswith("senha")]
    assert sorted(nossos, key=str) == sorted(
        [("senha_pedida", None), ("senha_pedida", "ana"), ("senha_redefinida", "ana")], key=str
    )
    assert "ninguem@exemplo.com" not in str(eventos)


def test_ativar_a_conta_apaga_o_link_usado(cliente, usuarios, caixa, fabrica):
    corpo = {"nome": "dani", "email": "dani@exemplo.com", "senha": NOVA, "aceite_termos": True}
    cliente.post("/api/cadastro", json=corpo)
    assert contar(fabrica, Ativacao) == 1
    assert cliente.post("/api/ativar", json={"token": caixa.token()}).status_code == 200
    assert contar(fabrica, Ativacao) == 0


def test_excluir_a_conta_apaga_o_pedido_de_senha(cliente, usuarios, caixa, fabrica):
    com_email(fabrica, "ana", "ana@exemplo.com")
    pedir(cliente)
    entrar(cliente, "ana")
    resposta = cliente.post("/api/conta/excluir", json={"senha": SENHA}, headers=csrf(cliente))
    assert resposta.status_code == 204
    assert contar(fabrica, RedefinicaoSenha) == 0


def test_todo_tipo_de_evento_registrado_tem_nome_na_auditoria():
    # Uma lista só: tipo registrado fora de NOMES_EVENTO aparece cru na tela do admin.
    fonte = Path(__file__).parents[1] / "src" / "inoxio"
    usados = set()
    for arquivo in fonte.rglob("*.py"):
        texto = arquivo.read_text(encoding="utf-8")
        usados |= set(re.findall(r'trilha\.registrar\(\s*db,\s*"(\w+)"', texto))
    assert len(usados) >= 10
    assert usados <= set(NOMES_EVENTO), usados - set(NOMES_EVENTO)


def test_a_funcao_recusa_a_senha_curta_antes_de_apagar_o_link(usuarios, fabrica):
    # A rota também não grava nada no erro; aqui quem chama grava, e o link precisa ficar.
    com_email(fabrica, "ana", "ana@exemplo.com")
    with fabrica() as db:
        conta = db.scalar(select(Usuario).where(Usuario.nome == "ana"))
        token = credenciais.abrir_redefinicao(db, conta)
        db.commit()
        with pytest.raises(ValueError):
            credenciais.redefinir_senha(db, token, "curta")
        db.commit()
    assert contar(fabrica, RedefinicaoSenha) == 1


def test_links_vencidos_saem_do_banco_quando_outro_link_e_emitido(
    cliente, usuarios, caixa, fabrica
):
    com_email(fabrica, "ana", "ana@exemplo.com")
    com_email(fabrica, "beto", "beto@exemplo.com")
    pedir(cliente)
    corpo = {"nome": "dani", "email": "dani@exemplo.com", "senha": NOVA, "aceite_termos": True}
    cliente.post("/api/cadastro", json=corpo)
    with fabrica() as db, db.begin():
        db.scalar(select(RedefinicaoSenha)).expira_em = agora() - timedelta(minutes=1)
        db.scalar(select(Ativacao)).expira_em = agora() - timedelta(minutes=1)
    pedir(cliente, "beto@exemplo.com")
    corpo = {"nome": "eva", "email": "eva@exemplo.com", "senha": NOVA, "aceite_termos": True}
    cliente.post("/api/cadastro", json=corpo)
    # Sobram só os links de beto e eva, ainda válidos.
    assert contar(fabrica, RedefinicaoSenha) == 1
    assert contar(fabrica, Ativacao) == 1
