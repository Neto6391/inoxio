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
    "por_fonte": ["O AbuseIPDB reúne denúncias de abuso; este IP tem muitas."],
}


def test_resposta_valida_passa():
    from inoxio.agente.mente import VERSAO_ANALISE

    assert analisar({"a": 1}, lambda sistema, carga: VALIDA) == VALIDA | {"versao": VERSAO_ANALISE}


def test_aceita_o_modelo_pydantic_devolvido_pelo_langchain():
    from inoxio.agente.mente import VERSAO_ANALISE

    assert analisar({"a": 1}, lambda s, c: RespostaMente(**VALIDA)) == VALIDA | {
        "versao": VERSAO_ANALISE
    }


def test_sem_invocar_nao_ha_analise():
    assert analisar({"a": 1}, None) is None


def test_falha_da_ia_vira_none():
    def invocar(sistema, carga):
        raise TimeoutError("demorou")

    assert analisar({"a": 1}, invocar) is None


def test_o_que_passa_do_limite_sai_e_o_resto_fica():
    # O modelo recebe um esquema só de tipos; os limites são aplicados aqui. Um item
    # fora do limite sai sozinho, em vez de levar a explicação inteira junto.
    termo = {"termo": "IP", "significado": "Número de um computador na internet."}
    analise = analisar(
        {},
        lambda s, c: (
            VALIDA
            | {
                "tecnicas_mitre": ["rm -rf /", "T1110"],
                "recomendacoes": [f"Ação {n}." for n in range(9)] + ["x" * 301],
                "termos": [termo | {"termo": "x" * 61}, termo | {"significado": "x" * 301}]
                + [termo] * 7,
                "por_fonte": [f"Fonte {n}." for n in range(5)] + ["x" * 801],
            }
        ),
    )
    assert analise["tecnicas_mitre"] == ["T1110"]
    assert analise["recomendacoes"] == [f"Ação {n}." for n in range(8)]
    assert analise["termos"] == [termo] * 6
    assert analise["por_fonte"] == [f"Fonte {n}." for n in range(4)]


def test_resumo_longo_demais_fica_com_as_frases_que_cabem():
    frase = "Uma frase de exemplo com cinquenta caracteres e um ponto. "
    analise = analisar({}, lambda s, c: VALIDA | {"resumo": frase * 30})
    assert len(analise["resumo"]) <= 1200
    assert analise["resumo"].endswith("ponto.")
    # Sem frase que caiba (uma só, gigante), não há resumo, e a análise não vale.
    assert analisar({}, lambda s, c: VALIDA | {"resumo": "x" * 1201}) is None


def test_confianca_fora_do_esperado_invalida_a_analise():
    assert analisar({}, lambda s, c: VALIDA | {"confianca": "total"}) is None


def test_negar_que_e_seguro_e_aviso_e_fica():
    resumo = (
        "Este link não é seguro e aparece em listas de golpe. "
        "Não é um site confiável: 12 antivírus o marcaram. "
        "O site parece seguro e não há sinais de abuso."
    )
    recomendacoes = ["Use uma senha segura e diferente em cada site.", "Ele é limpo."]
    analise = analisar({}, lambda s, c: VALIDA | {"resumo": resumo, "recomendacoes": recomendacoes})
    assert analise["resumo"] == (
        "Este link não é seguro e aparece em listas de golpe. "
        "Não é um site confiável: 12 antivírus o marcaram."
    )
    assert analise["recomendacoes"] == ["Use uma senha segura e diferente em cada site."]


def test_ponto_e_virgula_nao_separa_e_a_frase_sai_inteira():
    recomendacao = "Verifique se usa um DNS confiável; se não, altere para outro."
    analise = analisar(
        {}, lambda s, c: VALIDA | {"recomendacoes": [recomendacao, "Confira o endereço."]}
    )
    assert analise["recomendacoes"] == ["Confira o endereço."]


def test_suavizar_ou_garantir_com_outras_palavras_tambem_sai():
    resumo = (
        "As fontes não responderam. Não há motivo imediato para bloquear este IP. "
        "Nada foi encontrado, indicando que o conteúdo não é malicioso. "
        "Não há evidências de que seja malicioso."
    )
    analise = analisar({}, lambda s, c: VALIDA | {"resumo": resumo})
    assert (
        analise["resumo"] == "As fontes não responderam. Não há evidências de que seja malicioso."
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
    # 900: a explicação por fonte pede mais texto que o resumo sozinho.
    assert (TIMEOUT, MAX_TOKENS) == (10, 900)


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

    esperado = "59d1ba73c4f45854c996644723b34f127d6a32ff90566bcbf4ca7af91d7bd32c"
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


def test_parece_normal_tambem_sai():
    resumo = "Os IPs são da Cloudflare. Em resumo, o site parece normal, mas não há provas. Fim."
    analise = analisar({}, lambda s, c: VALIDA | {"resumo": resumo})
    assert analise["resumo"] == "Os IPs são da Cloudflare. Fim."
    # "normal" sem o "parece" continua: não afirma nada sobre o indicador.
    outro = analisar({}, lambda s, c: VALIDA | {"resumo": "O tráfego é normal para um DNS."})
    assert outro["resumo"] == "O tráfego é normal para um DNS."


def test_o_glossario_passa_pelo_mesmo_filtro():
    termos = [
        {
            "termo": "reputação",
            "significado": "Mostra se um IP é usado por atividades seguras ou suspeitas.",
        },
        {"termo": "Cloudflare", "significado": "Empresa que entrega sites. Ela é confiável."},
        {"termo": "IP", "significado": "Número de um computador na internet."},
    ]
    analise = analisar({}, lambda s, c: VALIDA | {"termos": termos})
    # O termo cujo significado fica vazio sai; o outro perde só a frase proibida.
    assert analise["termos"] == [
        {"termo": "Cloudflare", "significado": "Empresa que entrega sites."},
        {"termo": "IP", "significado": "Número de um computador na internet."},
    ]


def test_explicacao_por_fonte_e_pedida_aceita_e_filtrada():
    from inoxio.agente.mente import RespostaMente

    assert "por_fonte" in RespostaMente.model_fields
    por_fonte = [
        "O VirusTotal passa o endereço por dezenas de antivírus. Nenhum acusou nada.",
        "O AbuseIPDB reúne denúncias. O site parece seguro.",
        "Ele é limpo.",
    ]
    analise = analisar({}, lambda s, c: VALIDA | {"por_fonte": por_fonte})
    # A frase proibida sai; o parágrafo que fica vazio sai da lista.
    assert analise["por_fonte"] == [
        "O VirusTotal passa o endereço por dezenas de antivírus. Nenhum acusou nada.",
        "O AbuseIPDB reúne denúncias.",
    ]


def test_analise_antiga_sem_por_fonte_continua_valendo():
    antiga = {chave: valor for chave, valor in VALIDA.items() if chave != "por_fonte"}
    assert analisar({}, lambda s, c: antiga)["por_fonte"] == []


def test_a_explicacao_guarda_a_versao_das_instrucoes():
    import hashlib

    from inoxio.agente.mente import PROMPT, VERSAO_ANALISE

    assert VERSAO_ANALISE == hashlib.sha256(PROMPT.encode()).hexdigest()[:12]
    assert analisar({}, lambda s, c: VALIDA)["versao"] == VERSAO_ANALISE
