#!/usr/bin/env bash
# Baixa o plugin de SQLite do Grafana, confere o SHA-256 publicado pelo grafana.com
# e o descompacta em ./plugins. Rodar como root em /opt/inoxio-observabilidade.
set -euo pipefail

VERSAO="4.0.6"
SHA256="e5ce2354dd26ba9bea56b37f9ed4050cc917a46b858a0a191e1cafda382bf18a"
URL="https://grafana.com/api/plugins/frser-sqlite-datasource/versions/${VERSAO}/download"

pacote="$(mktemp)"
trap 'rm -f "$pacote"' EXIT
curl -fsSL --max-time 120 -o "$pacote" "$URL"
echo "${SHA256}  ${pacote}" | sha256sum -c --quiet
rm -rf plugins/frser-sqlite-datasource
install -d -m 755 plugins
python3 -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$pacote" plugins
chmod -R a+rX plugins
# O zipfile do Python não guarda a permissão de execução: os binários do plugin a perdem.
find plugins/frser-sqlite-datasource -name "gpx_*" -type f -exec chmod 755 {} +
echo "plugin ${VERSAO} conferido e instalado em plugins/"
