import threading
import time
from datetime import timedelta

import pytest
from ajudantes import csrf, entrar
from sqlalchemy import create_engine, inspect, select, text

from inoxio.contas.modelos import Usuario
from inoxio.investigacoes.fontes.base import evidencia
from inoxio.investigacoes.grafo import construir_grafo
from inoxio.investigacoes.historico import buscador
from inoxio.investigacoes.ia.explicador import ESPERA_ESQUEMA, ESPERAS_429, PRAZO, Explicador
from inoxio.investigacoes.modelos import Investigacao
from inoxio.plataforma.banco import agora, criar_fabrica
from inoxio.web.app import criar_app

BOA = {
    "resumo": "Os IPs são da Cloudflare.",
    "tecnicas_mitre": [],
    "recomendacoes": ["Confira o endereço."],
    "confianca": "media",
    "termos": [],
}


class Limite(Exception):
    """Imita o RateLimitError do cliente da OpenAI, que traz status_code 429."""

    status_code = 429


class Groq:
    """IA falsa: devolve, em ordem, o que a lista mandar (exceção é levantada)."""

    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.chamadas = 0

    def __call__(self, sistema, carga):
        self.chamadas += 1
        resposta = self.respostas.pop(0) if len(self.respostas) > 1 else self.respostas[0]
        if isinstance(resposta, Exception):
            raise resposta
        return resposta


class Relogio:
    def __init__(self):
        self.agora = 0.0
        self.esperas = []

    def __call__(self):
        return self.agora

    def dormir(self, segundos):
        self.esperas.append(segundos)
        self.agora += segundos


class Fonte:
    NOME = "virustotal"

    def consultar(self, tipo, valor):
        return evidencia(
            "virustotal", "ok", {"malicioso": 0, "suspeito": 0, "reputacao": 0, "tags": []}
        )


def montar(fabrica, config, groq, relogio=None):
    """App com a explicação em segundo plano; a fila só anda quando o teste mandar."""
    relogio = relogio or Relogio()
    fila = []
    explicador = Explicador(
        fabrica, groq, executar=fila.append, dormir=relogio.dormir, relogio=relogio
    )
    # O grafo da web não chama a IA: quem chama é o explicador.
    grafo = construir_grafo([Fonte()], None, buscador(fabrica))
    app = criar_app(config, fabrica=fabrica, grafo=grafo, explicador=explicador)
    return app, fila, relogio


def detalhe(cliente, id_):
    return cliente.get(f"/api/investigacoes/{id_}").json()


def investigar(cliente, entrada="8.8.8.8"):
    resposta = cliente.post("/api/investigacoes", json={"entrada": entrada}, headers=csrf(cliente))
    assert resposta.status_code == 201
    return resposta.json()["id"]


@pytest.fixture
def cliente_de(usuarios):
    from fastapi.testclient import TestClient

    def fazer(app):
        cliente = TestClient(app, base_url="https://testserver")
        entrar(cliente, "ana")
        return cliente

    return fazer


def test_o_veredito_sai_logo_e_a_explicacao_chega_depois(fabrica, config, cliente_de):
    groq = Groq(BOA)
    app, fila, _ = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = investigar(cliente)
    antes = detalhe(cliente, id_)
    assert (antes["veredito"], antes["analise"], antes["analise_estado"]) == (
        "sem_evidencia",
        None,
        "pendente",
    )
    assert groq.chamadas == 0
    fila.pop(0)()
    depois = detalhe(cliente, id_)
    assert depois["analise_estado"] == "pronta"
    assert depois["analise"]["resumo"] == "Os IPs são da Cloudflare."


def test_limite_do_groq_espera_e_tenta_de_novo(fabrica, config, cliente_de):
    groq = Groq(Limite(), Limite(), BOA)
    app, fila, relogio = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = investigar(cliente)
    fila.pop(0)()
    assert groq.chamadas == 3
    assert relogio.esperas == list(ESPERAS_429[:2])
    assert detalhe(cliente, id_)["analise_estado"] == "pronta"


def test_limite_que_nao_passa_vira_indisponivel_sem_estourar_o_prazo(fabrica, config, cliente_de):
    groq = Groq(Limite())
    app, fila, relogio = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = investigar(cliente)
    fila.pop(0)()
    assert sum(relogio.esperas) <= PRAZO.total_seconds()
    assert groq.chamadas == len(relogio.esperas) + 1
    final = detalhe(cliente, id_)
    assert (final["analise_estado"], final["analise"]) == ("indisponivel", None)


def test_outra_falha_nao_repete(fabrica, config, cliente_de):
    groq = Groq(TimeoutError("demorou"))
    app, fila, relogio = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = investigar(cliente)
    fila.pop(0)()
    assert (groq.chamadas, relogio.esperas) == (1, [])
    assert detalhe(cliente, id_)["analise_estado"] == "indisponivel"


def test_quem_esperou_demais_na_fila_nao_chama_o_groq(fabrica, config, cliente_de):
    groq = Groq(BOA)
    app, fila, relogio = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = investigar(cliente)
    relogio.agora += PRAZO.total_seconds() + 1
    fila.pop(0)()
    assert groq.chamadas == 0
    assert detalhe(cliente, id_)["analise_estado"] == "indisponivel"


def test_pendente_esquecida_aparece_como_indisponivel(fabrica, config, cliente_de):
    # O processo reiniciou com a explicação na fila: ela nunca vai chegar.
    app, _, _ = montar(fabrica, config, Groq(BOA))
    cliente = cliente_de(app)
    with fabrica() as db, db.begin():
        ana = db.scalar(select(Usuario).where(Usuario.nome == "ana"))
        velha = Investigacao(
            usuario_id=ana.id,
            tipo="ip",
            valor="8.8.4.4",
            veredito="sem_evidencia",
            evidencias=[],
            analise_estado="pendente",
            criada_em=agora() - PRAZO - timedelta(minutes=1),
        )
        db.add(velha)
        db.flush()
        id_ = velha.id
    assert detalhe(cliente, id_)["analise_estado"] == "indisponivel"


def test_investigacao_antiga_sem_estado_mostra_o_que_tem(fabrica, config, cliente_de):
    app, _, _ = montar(fabrica, config, Groq(BOA))
    cliente = cliente_de(app)
    with fabrica() as db, db.begin():
        ana = db.scalar(select(Usuario).where(Usuario.nome == "ana"))
        com = Investigacao(
            usuario_id=ana.id,
            tipo="ip",
            valor="1.1.1.1",
            veredito="sem_evidencia",
            evidencias=[],
            analise=BOA,
        )
        sem = Investigacao(
            usuario_id=ana.id, tipo="ip", valor="1.0.0.1", veredito="sem_evidencia", evidencias=[]
        )
        db.add_all([com, sem])
        db.flush()
        ids = com.id, sem.id
    assert detalhe(cliente, ids[0])["analise_estado"] == "pronta"
    assert detalhe(cliente, ids[1])["analise_estado"] == "indisponivel"


def test_uma_chamada_ao_groq_por_vez(fabrica):
    ao_mesmo_tempo = 0
    maximo = 0
    trava = threading.Lock()

    def groq(sistema, carga):
        nonlocal ao_mesmo_tempo, maximo
        with trava:
            ao_mesmo_tempo += 1
            maximo = max(maximo, ao_mesmo_tempo)
        time.sleep(0.05)
        with trava:
            ao_mesmo_tempo -= 1
        return BOA

    explicador = Explicador(fabrica, groq)
    try:
        for n in range(4):
            explicador.pedir(f"inexistente-{n}", {"indicador": n})
    finally:
        explicador.fechar(esperar=True)
    assert maximo == 1


def test_banco_antigo_ganha_o_estado_da_explicacao(tmp_path):
    url = f"sqlite:///{tmp_path / 'velho.db'}"
    criar_fabrica(url)
    motor = create_engine(url)
    with motor.begin() as conexao:
        conexao.execute(text("ALTER TABLE investigacoes DROP COLUMN analise_estado"))
        conexao.execute(text("ALTER TABLE investigacoes DROP COLUMN analise_pedida_em"))
    motor.dispose()
    criar_fabrica(url)
    motor = create_engine(url)
    colunas = {coluna["name"] for coluna in inspect(motor).get_columns("investigacoes")}
    assert {"analise_estado", "analise_pedida_em"} <= colunas


def test_o_prazo_corta_as_tentativas(fabrica, config, cliente_de):
    # Entrou na fila e só começou 70 s depois: cabem as esperas de 5 e 10 s, a de 20 não.
    groq = Groq(Limite())
    app, fila, relogio = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = investigar(cliente)
    relogio.agora += 70
    fila.pop(0)()
    assert relogio.esperas == [5, 10]
    assert groq.chamadas == 3
    assert detalhe(cliente, id_)["analise_estado"] == "indisponivel"


class Esquema(Exception):
    """Imita a recusa do Groq quando o JSON gerado não segue o esquema."""

    status_code = 400

    def __init__(self):
        super().__init__("Generated JSON does not match the expected schema.")


def test_recusa_de_esquema_tenta_de_novo_uma_vez(fabrica, config, cliente_de):
    groq = Groq(Esquema(), BOA)
    app, fila, relogio = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = investigar(cliente)
    fila.pop(0)()
    assert (groq.chamadas, relogio.esperas) == (2, [ESPERA_ESQUEMA])
    assert detalhe(cliente, id_)["analise_estado"] == "pronta"


def test_segunda_recusa_de_esquema_desiste(fabrica, config, cliente_de):
    groq = Groq(Esquema())
    app, fila, relogio = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = investigar(cliente)
    fila.pop(0)()
    assert (groq.chamadas, relogio.esperas) == (2, [ESPERA_ESQUEMA])
    assert detalhe(cliente, id_)["analise_estado"] == "indisponivel"


def test_reaproveitada_com_explicacao_de_outra_versao_escreve_de_novo(fabrica, config, cliente_de):
    # As instruções da IA mudaram: o resultado das fontes pode ser reaproveitado,
    # a explicação escrita pelas instruções antigas não.
    groq = Groq(BOA)
    app, fila, _ = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    primeira = investigar(cliente)
    fila.pop(0)()
    with fabrica() as db, db.begin():
        antiga = db.get(Investigacao, primeira)
        antiga.analise = antiga.analise | {"versao": "instrucoes-antigas"}
    segunda = investigar(cliente)
    reaproveitada = detalhe(cliente, segunda)
    assert (reaproveitada["reaproveitada"], reaproveitada["analise_estado"]) == (True, "pendente")
    fila.pop(0)()
    assert groq.chamadas == 2
    assert detalhe(cliente, segunda)["analise_estado"] == "pronta"


def test_reaproveitada_da_versao_atual_nao_chama_o_groq(fabrica, config, cliente_de):
    groq = Groq(BOA)
    app, fila, _ = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    investigar(cliente)
    fila.pop(0)()
    segunda = investigar(cliente)
    assert detalhe(cliente, segunda)["analise_estado"] == "pronta"
    assert (groq.chamadas, fila) == (1, [])


def test_explicacao_antiga_aparece_pelo_filtro_atual(fabrica, config, cliente_de):
    app, _, _ = montar(fabrica, config, Groq(BOA))
    cliente = cliente_de(app)
    legada = BOA | {"resumo": "Os IPs são da Cloudflare. Em resumo, o site parece normal."}
    with fabrica() as db, db.begin():
        ana = db.scalar(select(Usuario).where(Usuario.nome == "ana"))
        velha = Investigacao(
            usuario_id=ana.id,
            tipo="ip",
            valor="1.1.1.1",
            veredito="sem_evidencia",
            evidencias=[],
            analise=legada,
            analise_estado="pronta",
        )
        db.add(velha)
        db.flush()
        id_ = velha.id
    assert detalhe(cliente, id_)["analise"]["resumo"] == "Os IPs são da Cloudflare."


def indisponivel(cliente, fila):
    """Investiga e deixa a explicação indisponível (o Groq falha)."""
    id_ = investigar(cliente)
    fila.pop(0)()
    assert detalhe(cliente, id_)["analise_estado"] == "indisponivel"
    return id_


def test_tentar_explicar_de_novo_poe_na_fila_e_a_explicacao_chega(fabrica, config, cliente_de):
    groq = Groq(TimeoutError("demorou"), BOA)
    app, fila, _ = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = indisponivel(cliente, fila)
    resposta = cliente.post(f"/api/investigacoes/{id_}/explicar", headers=csrf(cliente))
    assert resposta.status_code == 202
    assert detalhe(cliente, id_)["analise_estado"] == "pendente"
    fila.pop(0)()
    final = detalhe(cliente, id_)
    assert (final["analise_estado"], final["analise"]["resumo"]) == ("pronta", BOA["resumo"])


def test_pedido_de_nova_explicacao_conta_o_prazo_a_partir_do_pedido(fabrica, config, cliente_de):
    # Investigação antiga: o prazo de 90 s conta do pedido, não da investigação.
    groq = Groq(TimeoutError("demorou"), BOA)
    app, fila, _ = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = indisponivel(cliente, fila)
    with fabrica() as db, db.begin():
        db.get(Investigacao, id_).criada_em = agora() - timedelta(hours=2)
    cliente.post(f"/api/investigacoes/{id_}/explicar", headers=csrf(cliente))
    assert detalhe(cliente, id_)["analise_estado"] == "pendente"


def test_so_pede_de_novo_o_que_esta_indisponivel(fabrica, config, cliente_de):
    app, fila, _ = montar(fabrica, config, Groq(BOA))
    cliente = cliente_de(app)
    id_ = investigar(cliente)
    fila.pop(0)()
    assert (
        cliente.post(f"/api/investigacoes/{id_}/explicar", headers=csrf(cliente)).status_code == 409
    )
    assert fila == []


def test_pedir_de_novo_exige_csrf_e_ser_o_dono(fabrica, config, cliente_de):
    from fastapi.testclient import TestClient

    groq = Groq(TimeoutError("demorou"))
    app, fila, _ = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = indisponivel(cliente, fila)
    assert cliente.post(f"/api/investigacoes/{id_}/explicar").status_code == 403
    beto = TestClient(app, base_url="https://testserver")
    entrar(beto, "beto")
    assert beto.post(f"/api/investigacoes/{id_}/explicar", headers=csrf(beto)).status_code == 404
    assert fila == []


def test_limite_de_pedidos_de_nova_explicacao(fabrica, config, cliente_de):
    groq = Groq(TimeoutError("demorou"))
    app, fila, _ = montar(fabrica, config, groq)
    cliente = cliente_de(app)
    id_ = indisponivel(cliente, fila)
    for _ in range(10):
        assert (
            cliente.post(f"/api/investigacoes/{id_}/explicar", headers=csrf(cliente)).status_code
            == 202
        )
        fila.pop(0)()
    assert (
        cliente.post(f"/api/investigacoes/{id_}/explicar", headers=csrf(cliente)).status_code == 429
    )
