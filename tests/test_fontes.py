import socket
import time

import httpx

from inoxio.agente.fontes import (
    AbuseIPDB,
    ResolucaoDNS,
    VirusTotal,
    consultar_fontes,
    evidencia,
    id_da_url,
)

MD5 = "d41d8cd98f00b204e9800998ecf8427e"


def cliente(tratar):
    return httpx.Client(transport=httpx.MockTransport(tratar))


def sem_rede(requisicao):
    raise AssertionError(f"não deveria chamar a rede: {requisicao.url}")


def test_abuseipdb_guarda_so_campos_permitidos_e_corta_texto():
    def tratar(requisicao):
        assert requisicao.url.params["ipAddress"] == "8.8.8.8"
        assert requisicao.headers["Key"] == "chave"
        dados = {
            "abuseConfidenceScore": 90,
            "totalReports": 12,
            "countryCode": "BR",
            "isp": "x" * 500,
            "hostnames": ["nao-deve-entrar"],
        }
        return httpx.Response(200, json={"data": dados})

    evidencia = AbuseIPDB("chave", cliente(tratar)).consultar("ip", "8.8.8.8")
    assert evidencia["status"] == "ok"
    assert evidencia["dados"]["score"] == 90
    assert len(evidencia["dados"]["isp"]) == 200
    assert set(evidencia["dados"]) == {"score", "relatos", "pais", "isp"}


def test_abuseipdb_nao_se_aplica_a_hash():
    assert AbuseIPDB("chave", cliente(sem_rede)).consultar("hash", MD5) is None


def test_sem_chave_e_falha_sem_chamar_a_rede():
    assert AbuseIPDB("", cliente(sem_rede)).consultar("ip", "8.8.8.8")["status"] == "falha"
    assert VirusTotal("", cliente(sem_rede)).consultar("ip", "8.8.8.8")["status"] == "falha"


def test_virustotal_404_e_nao_encontrado():
    def tratar(requisicao):
        assert requisicao.url.path == f"/api/v3/files/{MD5}"
        assert requisicao.headers["x-apikey"] == "chave"
        return httpx.Response(404, json={"error": {"code": "NotFoundError"}})

    assert VirusTotal("chave", cliente(tratar)).consultar("hash", MD5)["status"] == "nao_encontrado"


def test_virustotal_erro_de_rede_e_falha():
    def tratar(requisicao):
        raise httpx.ConnectError("sem rede", request=requisicao)

    assert (
        VirusTotal("chave", cliente(tratar)).consultar("dominio", "exemplo.com")["status"]
        == "falha"
    )


def test_virustotal_limita_tags():
    def tratar(requisicao):
        atributos = {
            "last_analysis_stats": {"malicious": 7, "suspicious": 1},
            "reputation": -40,
            "tags": ["t" * 300] + [f"tag{n}" for n in range(10)],
        }
        return httpx.Response(200, json={"data": {"attributes": atributos}})

    dados = VirusTotal("chave", cliente(tratar)).consultar("ip", "8.8.8.8")["dados"]
    assert dados["malicioso"] == 7
    assert len(dados["tags"]) == 5
    assert len(dados["tags"][0]) == 200


def test_consultar_fontes_ignora_as_que_nao_se_aplicam():
    def tratar(requisicao):
        return httpx.Response(404)

    fontes = [AbuseIPDB("chave", cliente(sem_rede)), VirusTotal("chave", cliente(tratar))]
    assert [e["fonte"] for e in consultar_fontes(fontes, "hash", MD5)] == ["virustotal"]


def test_fonte_que_explode_vira_falha():
    class Quebrada:
        NOME = "quebrada"

        def consultar(self, tipo, valor):
            raise RuntimeError("defeito")

    assert consultar_fontes([Quebrada()], "ip", "8.8.8.8") == [
        {"fonte": "quebrada", "status": "falha", "dados": {}}
    ]


class AbuseFalso:
    NOME = "abuseipdb"

    def __init__(self):
        self.consultados = []

    def consultar(self, tipo, valor):
        self.consultados.append((tipo, valor))
        return evidencia("abuseipdb", "ok", {"score": 90, "relatos": 7, "pais": "NL", "isp": "x"})


def test_dns_consulta_so_ips_publicos_e_no_maximo_dois():
    abuse = AbuseFalso()
    enderecos = ["10.0.0.1", "2606:4700::1", "104.16.1.1", "104.16.1.1", "127.0.0.1", "104.16.2.2"]
    resultado = ResolucaoDNS(abuse, resolver=lambda dominio: enderecos).consultar(
        "dominio", "exemplo.com"
    )
    assert resultado["contexto"] is True
    assert resultado["status"] == "ok"
    assert [item["ip"] for item in resultado["dados"]["ips"]] == ["104.16.1.1", "104.16.2.2"]
    assert resultado["dados"]["ips"][0]["score"] == 90
    assert abuse.consultados == [("ip", "104.16.1.1"), ("ip", "104.16.2.2")]


def test_dns_so_para_dominio():
    assert (
        ResolucaoDNS(AbuseFalso(), resolver=lambda d: ["8.8.8.8"]).consultar("ip", "8.8.8.8")
        is None
    )


def test_dominio_que_nao_existe_e_nao_encontrado():
    def nxdomain(dominio):
        raise socket.gaierror("nome desconhecido")

    resultado = ResolucaoDNS(AbuseFalso(), resolver=nxdomain).consultar(
        "dominio", "nao-existe.exemplo"
    )
    assert (resultado["status"], resultado["contexto"]) == ("nao_encontrado", True)


def test_dominio_so_com_ip_privado_e_nao_encontrado():
    abuse = AbuseFalso()
    resultado = ResolucaoDNS(abuse, resolver=lambda d: ["192.168.0.10"]).consultar(
        "dominio", "interno.exemplo"
    )
    assert resultado["status"] == "nao_encontrado"
    assert abuse.consultados == []


def test_dns_lento_vira_falha_sem_travar():
    def lento(dominio):
        time.sleep(2)
        return ["8.8.8.8"]

    inicio = time.monotonic()
    resultado = ResolucaoDNS(AbuseFalso(), resolver=lento, timeout=0.2).consultar(
        "dominio", "lento.exemplo"
    )
    assert resultado["status"] == "falha"
    assert time.monotonic() - inicio < 1


def test_grafo_de_producao_traz_os_ips_do_dominio(monkeypatch):
    from inoxio.config import Config
    from inoxio.db import criar_fabrica
    from inoxio.web.app import grafo_de_producao

    def responder(requisicao):
        if "abuseipdb" in requisicao.url.host:
            corpo = {
                "data": {
                    "abuseConfidenceScore": 3,
                    "totalReports": 1,
                    "countryCode": "US",
                    "isp": "CDN",
                }
            }
            return httpx.Response(200, json=corpo)
        return httpx.Response(404)

    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(0, 0, 0, "", ("104.16.1.1", 0))])
    config = Config(abuseipdb_chave="a", virustotal_chave="v")
    grafo = grafo_de_producao(config, criar_fabrica("sqlite://"), cliente(responder))
    estado = grafo.invoke({"entrada": "https://exemplo.com/pagina"})
    dns = next(item for item in estado["evidencias"] if item["fonte"] == "dns")
    assert dns["dados"]["ips"][0] == {
        "ip": "104.16.1.1",
        "abuseipdb": "ok",
        "score": 3,
        "relatos": 1,
        "pais": "US",
        "isp": "CDN",
    }
    assert estado["veredito"] == "desconhecido"


def test_virustotal_consulta_url_pelo_identificador_e_nunca_envia():
    pedidos = []

    def responder(requisicao):
        pedidos.append(requisicao)
        atributos = {"last_analysis_stats": {"malicious": 6, "suspicious": 0}, "reputation": 0}
        return httpx.Response(200, json={"data": {"attributes": atributos}})

    url = "https://exemplo.com/login?x=1"
    resultado = VirusTotal("chave", cliente(responder)).consultar("url", url)
    assert resultado["fonte"] == "virustotal_url"
    assert resultado["dados"]["malicioso"] == 6
    assert [(p.method, p.url.path) for p in pedidos] == [("GET", f"/api/v3/urls/{id_da_url(url)}")]
    assert "=" not in id_da_url(url)


def test_url_que_o_virustotal_nunca_viu_e_nao_encontrada():
    resultado = VirusTotal("chave", cliente(lambda r: httpx.Response(404))).consultar(
        "url", "https://exemplo.com/nova"
    )
    assert (resultado["fonte"], resultado["status"]) == ("virustotal_url", "nao_encontrado")
