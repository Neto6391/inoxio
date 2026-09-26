import httpx

from inoxio.agente.fontes import AbuseIPDB, VirusTotal, consultar_fontes

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
