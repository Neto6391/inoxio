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
