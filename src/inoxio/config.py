"""Configuração lida do ambiente. Nenhum segredo tem valor padrão."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    banco_url: str = "sqlite:///./inoxio.db"
    abuseipdb_chave: str = ""
    virustotal_chave: str = ""
    groq_chave: str = ""
    # Combinação que devolveu JSON válido em 10 de 10 chamadas, mediana de 0,62 s.
    llm_modelo: str = "openai/gpt-oss-20b"
    llm_metodo: str = "json_schema"
    llm_esforco: str = "low"
    proxies_confiaveis: str = "127.0.0.1"
    frontend_dir: str = "frontend/dist"

    @classmethod
    def do_ambiente(cls) -> Config:
        ler = os.environ.get
        padrao = cls()
        return cls(
            banco_url=ler("INOXIO_BANCO_URL", padrao.banco_url),
            abuseipdb_chave=ler("INOXIO_ABUSEIPDB_CHAVE", ""),
            virustotal_chave=ler("INOXIO_VIRUSTOTAL_CHAVE", ""),
            groq_chave=ler("INOXIO_GROQ_CHAVE", ""),
            llm_modelo=ler("INOXIO_LLM_MODELO", padrao.llm_modelo),
            llm_metodo=ler("INOXIO_LLM_METODO", padrao.llm_metodo),
            llm_esforco=ler("INOXIO_LLM_ESFORCO", padrao.llm_esforco),
            proxies_confiaveis=ler("INOXIO_PROXIES_CONFIAVEIS", padrao.proxies_confiaveis),
            frontend_dir=ler("INOXIO_FRONTEND_DIR", padrao.frontend_dir),
        )
