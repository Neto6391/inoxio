from datetime import timedelta

from ajudantes import entrar
from sqlalchemy import select

from inoxio.cli import criar_usuario
from inoxio.db import Evento, Investigacao, Usuario, agora


def vt(maliciosos, fonte="virustotal"):
    return {
        "fonte": fonte,
        "status": "ok",
        "dados": {"malicioso": maliciosos, "suspeito": 0, "reputacao": 0},
    }


def id_de(fabrica, nome):
    with fabrica() as db:
        return db.scalar(select(Usuario.id).where(Usuario.nome == nome))


def investigar(fabrica, nome, tipo, valor, veredito, nota=0, evidencias=(), dias=0):
    with fabrica() as db, db.begin():
        db.add(
            Investigacao(
                usuario_id=id_de(fabrica, nome),
                tipo=tipo,
                valor=valor,
                veredito=veredito,
                nota=nota,
                evidencias=list(evidencias),
                criada_em=agora() - timedelta(days=dias, minutes=len(valor)),
            )
        )


def test_estatisticas_do_proprio_usuario(cliente, usuarios, fabrica):
    for _ in range(3):
        investigar(fabrica, "ana", "dominio", "exemplo.com", "sem_evidencia")
    investigar(
        fabrica,
        "ana",
        "url",
        "https://mal.exemplo/x",
        "malicioso",
        85,
        [vt(3, "virustotal_url"), vt(8)],
    )
    investigar(fabrica, "ana", "ip", "185.220.101.5", "suspeito", 40, [vt(2)])
    investigar(fabrica, "beto", "ip", "6.6.6.6", "malicioso", 100, [vt(9)])
    entrar(cliente, "ana")
    dados = cliente.get("/api/estatisticas").json()
    assert dados["total"] == 5
    assert dados["por_veredito"] == {"sem_evidencia": 3, "malicioso": 1, "suspeito": 1}
    assert dados["mais_pesquisados"][0] == {
        "tipo": "dominio",
        "valor": "exemplo.com",
        "vezes": 3,
        "veredito": "sem_evidencia",
    }
    # Ameaças: só as dela, a mais grave primeiro, com o maior número de detecções (URL ou domínio).
    assert [(a["valor"], a["deteccoes"]) for a in dados["ameacas"]] == [
        ("https://mal.exemplo/x", 8),
        ("185.220.101.5", 2),
    ]


def test_mais_pesquisados_para_em_dez(cliente, usuarios, fabrica):
    for numero in range(12):
        investigar(fabrica, "ana", "ip", f"8.8.8.{numero}", "sem_evidencia")
    entrar(cliente, "ana")
    assert len(cliente.get("/api/estatisticas").json()["mais_pesquisados"]) == 10


def test_visao_geral_do_admin(cliente, usuarios, fabrica):
    criar_usuario(fabrica, "parado", "analista", "senha-de-teste-longa")
    criar_usuario(fabrica, "fora", "analista", "senha-de-teste-longa")
    with fabrica() as db, db.begin():
        db.scalar(select(Usuario).where(Usuario.nome == "fora")).ativo = False
        # "beto" entrou há 40 dias: não conta como uso nos últimos 30.
        db.add(Evento(tipo="login", usuario="beto", ip="x", quando=agora() - timedelta(days=40)))
    investigar(fabrica, "ana", "dominio", "exemplo.com", "sem_evidencia")
    investigar(fabrica, "ana", "url", "https://exemplo.com/a", "malicioso", 80)
    investigar(fabrica, "ana", "ip", "8.8.8.8", "sem_evidencia")
    investigar(fabrica, "beto", "dominio", "exemplo.com", "sem_evidencia", dias=40)
    entrar(cliente, "chefe")
    dados = cliente.get("/api/estatisticas/geral").json()
    # Contas: ana, beto, chefe, parado, fora. Ativas: 4 de 5.
    assert (dados["contas"], dados["contas_ativas"], dados["porcentagem_ativas"]) == (5, 4, 80.0)
    # Usaram em 30 dias: ana (investigou) e chefe (acabou de entrar). Beto e parado não.
    assert (dados["usaram_30_dias"], dados["porcentagem_uso_30_dias"]) == (2, 50.0)
    assert (dados["investigacoes"], dados["sites_distintos"], dados["indicadores_distintos"]) == (
        4,
        2,
        3,
    )
    assert dados["ameacas_distintas"] == 1
    assert dados["top_usuarios"] == [
        {"nome": "ana", "investigacoes": 3},
        {"nome": "beto", "investigacoes": 1},
    ]


def test_visao_geral_e_so_do_admin(cliente, usuarios):
    entrar(cliente, "ana")
    assert cliente.get("/api/estatisticas/geral").status_code == 403


def test_estatisticas_pedem_sessao(cliente, usuarios):
    assert cliente.get("/api/estatisticas").status_code == 401
