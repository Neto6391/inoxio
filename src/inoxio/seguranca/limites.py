"""Limites de uso, contados no banco para sobreviver a reinícios."""

from __future__ import annotations

import ipaddress
from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from inoxio.db import Investigacao, TentativaLogin, agora

JANELA_LOGIN = timedelta(minutes=15)
FALHAS_POR_CONTA = 5
FALHAS_POR_IP = 20
INVESTIGACOES_POR_HORA = 20
JANELA_INVESTIGACOES = timedelta(hours=1)


def origem(ip: str) -> str:
    """IPv6 conta pela rede /64: quem tem uma tem milhões de endereços para trocar."""
    try:
        endereco = ipaddress.ip_address(ip)
    except ValueError:
        return ip[:64]
    if endereco.version == 6:
        return str(ipaddress.ip_network(f"{endereco}/64", strict=False))
    return str(endereco)


def login_bloqueado(db: Session, nome: str, ip: str) -> bool:
    falhas = (
        select(func.count())
        .select_from(TentativaLogin)
        .where(
            TentativaLogin.sucesso.is_(False), TentativaLogin.criada_em >= agora() - JANELA_LOGIN
        )
    )
    por_conta = db.scalar(falhas.where(TentativaLogin.nome == nome))
    por_ip = db.scalar(falhas.where(TentativaLogin.ip == origem(ip)))
    return por_conta >= FALHAS_POR_CONTA or por_ip >= FALHAS_POR_IP


def registrar_tentativa(db: Session, nome: str, ip: str, sucesso: bool) -> None:
    # Só a janela importa para o bloqueio; o resto é apagado para a tabela não crescer.
    db.execute(delete(TentativaLogin).where(TentativaLogin.criada_em < agora() - JANELA_LOGIN))
    db.add(TentativaLogin(nome=nome[:64], ip=origem(ip), sucesso=sucesso))


def investigacao_excedida(db: Session, usuario_id: str) -> bool:
    feitas = db.scalar(
        select(func.count())
        .select_from(Investigacao)
        .where(
            Investigacao.usuario_id == usuario_id,
            Investigacao.criada_em >= agora() - JANELA_INVESTIGACOES,
        )
    )
    return feitas >= INVESTIGACOES_POR_HORA
