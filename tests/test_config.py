from inoxio.config import Config


def test_padrao_nao_tem_segredo():
    config = Config()
    assert (config.abuseipdb_chave, config.virustotal_chave, config.groq_chave) == ("", "", "")


def test_le_do_ambiente(monkeypatch):
    monkeypatch.setenv("INOXIO_GROQ_CHAVE", "chave-de-teste")
    monkeypatch.setenv("INOXIO_LLM_MODELO", "openai/gpt-oss-20b")
    monkeypatch.setenv("INOXIO_FRONTEND_DIR", "/srv/frontend")
    config = Config.do_ambiente()
    assert config.groq_chave == "chave-de-teste"
    assert config.llm_modelo == "openai/gpt-oss-20b"
    assert config.frontend_dir == "/srv/frontend"
    assert config.proxies_confiaveis == "127.0.0.1"
