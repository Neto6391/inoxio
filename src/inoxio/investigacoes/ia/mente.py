"""A chamada ao modelo: pede a explicação e trata as falhas."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel

from inoxio.investigacoes.ia.carga import montar_carga
from inoxio.investigacoes.ia.esquema import AnaliseMente, RespostaMente, dentro_dos_limites
from inoxio.investigacoes.ia.filtro import sem_garantia
from inoxio.investigacoes.ia.instrucoes import PROMPT, VERSAO_ANALISE
from inoxio.plataforma.config import Config

log = logging.getLogger("inoxio.mente")


URL_GROQ = "https://api.groq.com/openai/v1"
TIMEOUT = 10


# A explicação por fonte pede mais texto que o resumo sozinho.
MAX_TOKENS = 900


Invocar = Callable[[str, str], Any]


def tentar_analisar(
    dados: dict[str, Any], invocar: Invocar | None
) -> tuple[str, dict[str, Any] | None]:
    """("pronta", análise); ("limite", None) se o provedor recusou por limite de
    requisições; ("esquema", None) se recusou o JSON gerado por não seguir o esquema
    (o modelo às vezes pula campos); ou ("falha", None), que não vale repetir."""
    if invocar is None:
        return "falha", None
    try:
        resposta = invocar(PROMPT, montar_carga(dados))
        bruto = resposta.model_dump() if isinstance(resposta, BaseModel) else resposta
        analise = AnaliseMente.model_validate(dentro_dos_limites(bruto)).model_dump()
    except Exception as erro:
        if getattr(erro, "status_code", None) == 429:
            log.warning("mente_limite_do_provedor")
            return "limite", None
        if getattr(
            erro, "status_code", None
        ) == 400 and "does not match the expected schema" in str(erro):
            log.warning("mente_fora_do_esquema")
            return "esquema", None
        # Timeout, JSON inválido ou fora dos limites: sem análise.
        log.warning("mente_indisponivel", exc_info=True)
        return "falha", None
    limpa = sem_garantia(analise)
    return ("pronta", limpa | {"versao": VERSAO_ANALISE}) if limpa else ("falha", None)


def analisar(dados: dict[str, Any], invocar: Invocar | None) -> dict[str, Any] | None:
    """Pede a análise. Qualquer falha devolve None, e a tela segue sem ela."""
    return tentar_analisar(dados, invocar)[1]


def criar_invocar(config: Config) -> Invocar | None:
    if not (config.groq_chave and config.llm_modelo):
        return None
    from langchain_openai import ChatOpenAI

    # Com o raciocínio padrão, o gpt-oss gasta os tokens antes de fechar o JSON.
    # Modelos que não aceitam o parâmetro simplesmente não o recebem.
    raciocinio = {"reasoning_effort": config.llm_esforco} if config.llm_esforco else {}
    modelo = ChatOpenAI(
        model=config.llm_modelo,
        base_url=URL_GROQ,
        api_key=config.groq_chave,
        temperature=0,
        max_tokens=MAX_TOKENS,
        timeout=TIMEOUT,
        max_retries=0,
        **raciocinio,
    )
    # Formato de resposta, não ferramenta: o modelo não tem como executar nada.
    estruturado = modelo.with_structured_output(RespostaMente, method=config.llm_metodo)

    def invocar(sistema: str, carga: str) -> Any:
        return estruturado.invoke([("system", sistema), ("human", carga)])

    return invocar
