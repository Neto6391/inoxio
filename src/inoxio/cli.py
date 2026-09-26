"""Criação de usuários pelo terminal. A senha é lida sem eco, nunca por argumento."""

from __future__ import annotations

import argparse
import getpass
import sys

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from inoxio import usuarios
from inoxio.config import Config
from inoxio.db import criar_fabrica
from inoxio.usuarios import PAPEIS


def criar_usuario(fabrica: sessionmaker, nome: str, papel: str, senha: str) -> None:
    with fabrica() as db, db.begin():
        usuarios.criar(db, nome, papel, senha)


def main(argv: list[str] | None = None) -> int:
    analisador = argparse.ArgumentParser(prog="inoxio")
    comandos = analisador.add_subparsers(dest="comando", required=True)
    criar = comandos.add_parser("criar-usuario", help="a senha é pedida no terminal")
    criar.add_argument("nome")
    criar.add_argument("--papel", choices=PAPEIS, required=True)
    argumentos = analisador.parse_args(argv)

    senha = getpass.getpass("Senha: ")
    if senha != getpass.getpass("Repita a senha: "):
        print("As senhas não conferem.", file=sys.stderr)
        return 1
    fabrica = criar_fabrica(Config.do_ambiente().banco_url)
    try:
        criar_usuario(fabrica, argumentos.nome, argumentos.papel, senha)
    except ValueError as erro:
        print(erro, file=sys.stderr)
        return 1
    except IntegrityError:
        print(f"Já existe um usuário chamado {argumentos.nome}.", file=sys.stderr)
        return 1
    print(f"Usuário {argumentos.nome} criado com papel {argumentos.papel}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
