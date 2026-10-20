"""O painel do Grafana roda SQL direto no banco do app: cada consulta precisa valer no esquema real."""

import json
import sqlite3
from pathlib import Path

import pytest
import yaml

from inoxio.db import criar_fabrica

RAIZ = Path(__file__).resolve().parents[1] / "infra" / "observabilidade"
PAINEL = json.loads((RAIZ / "paineis" / "inoxio.json").read_text(encoding="utf-8"))
CONSULTAS = [(p["title"], alvo["rawQueryText"]) for p in PAINEL["panels"] for alvo in p["targets"]]


@pytest.fixture
def banco(tmp_path):
    caminho = tmp_path / "inoxio.db"
    criar_fabrica(f"sqlite:///{caminho}")
    # Somente leitura, como o Grafana abre.
    conexao = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True)
    yield conexao
    conexao.close()


@pytest.mark.parametrize(("titulo", "sql"), CONSULTAS, ids=[t for t, _ in CONSULTAS])
def test_consulta_do_painel_roda_no_esquema_do_app(banco, titulo, sql):
    banco.execute(sql).fetchall()


def test_consultas_so_leem():
    for titulo, sql in CONSULTAS:
        assert sql.lstrip().upper().startswith("SELECT"), titulo


def test_fonte_de_dados_abre_o_banco_so_para_leitura():
    fonte = yaml.safe_load(
        (RAIZ / "provisionamento" / "datasources" / "inoxio.yml").read_text(encoding="utf-8")
    )
    dados = fonte["datasources"][0]["jsonData"]
    assert dados["pathOptions"] == "?mode=ro"


def test_grafana_so_escuta_na_maquina():
    compose = yaml.safe_load((RAIZ / "compose.yml").read_text(encoding="utf-8"))
    servico = compose["services"]["grafana"]
    assert servico["ports"] == ["127.0.0.1:3000:3000"]
    assert "/home/inoxio/dados:/dados:ro" in servico["volumes"]
    assert "@sha256:" in servico["image"]
    assert servico["environment"]["GF_AUTH_ANONYMOUS_ENABLED"] == "false"
    # Nada é baixado ao subir: o plugin vem conferido pelo SHA-256, montado só para leitura.
    assert servico["environment"]["GF_PLUGINS_PREINSTALL_DISABLED"] == "true"
    assert not any(
        chave.startswith("GF_PLUGINS_PREINSTALL_SYNC") for chave in servico["environment"]
    )
    assert "./plugins:/var/lib/grafana/plugins:ro" in servico["volumes"]


def test_plugin_e_conferido_pelo_sha256():
    script = (RAIZ / "baixar-plugin.sh").read_text(encoding="utf-8")
    assert "sha256sum -c" in script
    # Sem isto o binário do plugin perde a permissão de execução e o Grafana não o inicia.
    assert '-name "gpx_*" -type f -exec chmod 755' in script
    assert 'SHA256="e5ce2354dd26ba9bea56b37f9ed4050cc917a46b858a0a191e1cafda382bf18a"' in script
