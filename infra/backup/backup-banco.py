#!/usr/bin/env python3
"""Backup diário do banco do Inóxio, só com a biblioteca padrão.

Usa a API de backup do SQLite (cópia consistente mesmo com o app gravando),
confere a cópia com PRAGMA integrity_check, guarda comprimida com modo 600,
apaga as mais antigas além de --manter e registra um evento "backup" na
auditoria, para o backup não falhar calado.
"""

from __future__ import annotations

import argparse
import gzip
import os
import shutil
import sqlite3
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

PREFIXO = "inoxio-"
SUFIXO = ".db.gz"


def _agora() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _registrar(banco: Path, detalhe: str) -> None:
    with sqlite3.connect(banco, timeout=30) as conexao:
        conexao.execute(
            "INSERT INTO eventos (quando, tipo, usuario, ip, detalhe) VALUES (?, 'backup', NULL, 'local', ?)",
            (_agora().isoformat(sep=" "), detalhe[:300]),
        )


def fazer_backup(banco: Path, destino: Path, manter: int) -> Path:
    destino.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destino) as temporaria:
        copia = Path(temporaria) / "copia.db"
        origem = sqlite3.connect(f"file:{banco}?mode=ro", uri=True, timeout=30)
        alvo = sqlite3.connect(copia)
        try:
            origem.backup(alvo)
            resultado = alvo.execute("PRAGMA integrity_check").fetchone()[0]
        finally:
            alvo.close()
            origem.close()
        if resultado != "ok":
            raise RuntimeError(f"cópia corrompida: {resultado}")
        nome = destino / f"{PREFIXO}{_agora():%Y%m%d-%H%M%S}{SUFIXO}"
        parcial = nome.with_suffix(".parcial")
        with open(copia, "rb") as entrada, gzip.open(parcial, "wb") as saida:
            shutil.copyfileobj(entrada, saida)
        os.chmod(parcial, 0o600)
        parcial.rename(nome)
    antigos = sorted(destino.glob(f"{PREFIXO}*{SUFIXO}"))[:-manter]
    for velho in antigos:
        velho.unlink()
    return nome


def main(argv: list[str] | None = None) -> int:
    analisador = argparse.ArgumentParser(description=__doc__)
    analisador.add_argument("--banco", type=Path, default=Path("/home/inoxio/dados/inoxio.db"))
    analisador.add_argument("--destino", type=Path, default=Path("/home/inoxio/backups"))
    analisador.add_argument("--manter", type=int, default=14)
    argumentos = analisador.parse_args(argv)
    try:
        nome = fazer_backup(argumentos.banco, argumentos.destino, argumentos.manter)
    except (OSError, sqlite3.Error, RuntimeError) as erro:
        print(f"backup falhou: {erro}", file=sys.stderr)
        return 1
    tamanho = nome.stat().st_size
    _registrar(argumentos.banco, f"{nome.name} ({tamanho // 1024} KB)")
    print(f"backup feito: {nome} ({tamanho} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
