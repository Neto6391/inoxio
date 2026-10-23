from inoxio.agente.mente import (
    MAX_TOKENS,
    TIMEOUT,
    AnaliseMente,
    RespostaMente,
    analisar,
    criar_invocar,
)
from inoxio.config import Config

VALIDA = {
    "resumo": "IP com muitos relatos de abuso.",
    "tecnicas_mitre": ["T1110", "T1071.001"],
    "recomendacoes": ["Bloqueie na borda."],
    "confianca": "media",
    "termos": [
        {"termo": "Cloudflare", "significado": "Empresa que fica na frente de muitos sites."},
    ],
}


def test_resposta_valida_passa():
    assert analisar({"a": 1}, lambda sistema, carga: VALIDA) == VALIDA


def test_aceita_o_modelo_pydantic_devolvido_pelo_langchain():
    assert analisar({"a": 1}, lambda s, c: RespostaMente(**VALIDA)) == VALIDA


def test_sem_invocar_nao_ha_analise():
    assert analisar({"a": 1}, None) is None


def test_falha_da_ia_vira_none():
    def invocar(sistema, carga):
        raise TimeoutError("demorou")

    assert analisar({"a": 1}, invocar) is None


def test_limites_sao_conferidos_aqui_e_nao_no_provedor():
    # O modelo recebe um esquema só de tipos; quem barra é o AnaliseMente.
    assert analisar({}, lambda s, c: VALIDA | {"tecnicas_mitre": ["rm -rf /"]}) is None
    assert analisar({}, lambda s, c: VALIDA | {"resumo": "x" * 1201}) is None
    assert analisar({}, lambda s, c: VALIDA | {"recomendacoes": ["r"] * 9}) is None
    assert analisar({}, lambda s, c: VALIDA | {"confianca": "total"}) is None
    termo = {"termo": "IP", "significado": "Número de um computador na internet."}
    assert analisar({}, lambda s, c: VALIDA | {"termos": [termo] * 7}) is None
    assert analisar({}, lambda s, c: VALIDA | {"termos": [termo | {"termo": "x" * 61}]}) is None
    assert (
        analisar({}, lambda s, c: VALIDA | {"termos": [termo | {"significado": "x" * 301}]}) is None
    )


def test_o_pedido_e_para_quem_nao_e_da_area():
    from inoxio.agente.mente import PROMPT

    for trecho in ("não é da área de tecnologia", "termos", "não altere nem conteste o veredito"):
        assert trecho in PROMPT.lower()


def test_carga_grande_demais_vira_none_sem_chamar_o_modelo():
    chamadas = []

    def invocar(sistema, carga):
        chamadas.append(carga)
        return VALIDA

    assert analisar({f"chave{n}": n for n in range(2000)}, invocar) is None
    assert chamadas == []


def test_esquemas_nao_tem_veredito_nem_nota():
    for esquema in (RespostaMente, AnaliseMente):
        assert not {"veredito", "nota"} & set(esquema.model_fields)


def test_limites_de_custo_do_groq():
    assert (TIMEOUT, MAX_TOKENS) == (10, 500)


def test_sem_chave_ou_modelo_nao_cria_invocar():
    assert criar_invocar(Config()) is None
    assert criar_invocar(Config(groq_chave="k", llm_modelo="")) is None


class ChatFalso:
    """Guarda os parâmetros com que o ChatOpenAI seria criado, sem ir à rede."""

    criado_com: dict = {}

    def __init__(self, **parametros):
        ChatFalso.criado_com = parametros

    def with_structured_output(self, esquema, method):
        return self


def test_esforco_de_raciocinio_vai_ao_modelo_quando_definido(monkeypatch):
    import langchain_openai

    monkeypatch.setattr(langchain_openai, "ChatOpenAI", ChatFalso)
    config = Config(groq_chave="k", llm_modelo="openai/gpt-oss-20b", llm_esforco="low")
    assert criar_invocar(config) is not None
    assert ChatFalso.criado_com["reasoning_effort"] == "low"
    assert ChatFalso.criado_com["timeout"] == TIMEOUT


def test_sem_esforco_o_parametro_nao_e_enviado(monkeypatch):
    # O qwen não aceita o parâmetro; mandar vazio quebraria a chamada.
    import langchain_openai

    monkeypatch.setattr(langchain_openai, "ChatOpenAI", ChatFalso)
    criar_invocar(Config(groq_chave="k", llm_modelo="qwen/qwen3.8-27b", llm_esforco=""))
    assert "reasoning_effort" not in ChatFalso.criado_com


def test_padrao_e_a_configuracao_aprovada_na_escolha_do_modelo():
    config = Config()
    assert (config.llm_modelo, config.llm_metodo, config.llm_esforco) == (
        "openai/gpt-oss-20b",
        "json_schema",
        "low",
    )


def test_frase_que_chama_algo_de_seguro_sai_e_o_resto_fica():
    # Sem evidência não é garantia: a tela nunca diz seguro, limpo, legítimo ou confiável.
    resumo = (
        "O site www.crunchyroll.com usa a Cloudflare. Ele parece seguro; "
        "não há motivo para suspeitar. Até agora, não há motivo para preocupação. "
        "Se o IP fosse de um provedor como a Amazon, apareceria. O IP 104.18.34.202 tem 1 relato."
    )
    recomendacoes = [
        "Confira o endereço.",
        "Use DNS confiáveis.",
        "Avise a equipe de segurança da empresa. O tráfego é legítimo.",
    ]
    analise = analisar({}, lambda s, c: VALIDA | {"resumo": resumo, "recomendacoes": recomendacoes})
    assert analise["resumo"] == (
        "O site www.crunchyroll.com usa a Cloudflare. O IP 104.18.34.202 tem 1 relato."
    )
    # A recomendação que fica vazia sai; "segurança" como assunto continua.
    assert analise["recomendacoes"] == [
        "Confira o endereço.",
        "Avise a equipe de segurança da empresa.",
    ]


def test_resumo_que_so_diz_que_e_seguro_vira_sem_analise():
    for frase in ("A página parece segura.", "O IP está limpo.", "Tráfego legítimo do Google."):
        assert analisar({}, lambda s, c, f=frase: VALIDA | {"resumo": f}) is None


def test_as_instrucoes_sao_as_aprovadas_na_medicao():
    # Texto aprovado pelo dono depois da medição pré-registrada de 23/10.
    import hashlib

    from inoxio.agente.mente import PROMPT

    esperado = "626ab0f2df85723feb024e38f9cb516225cb2f8bfd199742ce99f489facf1a92"
    assert hashlib.sha256(PROMPT.encode()).hexdigest() == esperado


class RecusaDeEsquema(Exception):
    """Imita o BadRequestError do Groq quando o JSON gerado não segue o esquema."""

    status_code = 400

    def __init__(self):
        super().__init__("Error code: 400 - Generated JSON does not match the expected schema.")


def test_recusa_de_esquema_e_separada_das_outras_falhas():
    from inoxio.agente.mente import tentar_analisar

    def recusa(sistema, carga):
        raise RecusaDeEsquema()

    class Outra400(Exception):
        status_code = 400

    def outra(sistema, carga):
        raise Outra400("Error code: 400 - model not found")

    assert tentar_analisar({}, recusa) == ("esquema", None)
    assert tentar_analisar({}, outra) == ("falha", None)
