"""Números do painel: do próprio usuário e, para o admin, do sistema todo."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inoxio.db import Evento, Investigacao, Usuario, agora
from inoxio.linha_do_tempo import situacao
from inoxio.seguranca.limites import FUSO_BRASILIA, inicio_do_dia

TOP = 10
DIAS_DO_GRAFICO = 14
JANELA_USO = timedelta(days=30)
AMEACAS = ("malicioso", "suspeito")
SITES = ("dominio", "url")
SITUACOES = ("ativa", "desativada", "aguardando", "recusada")


def _deteccoes(evidencias: list[dict[str, Any]]) -> int:
    """Motores do VirusTotal que marcaram o indicador (na URL ou no domínio, o maior)."""
    contagens = [
        (item.get("dados") or {}).get("malicioso", 0)
        for item in evidencias
        if item.get("fonte") in ("virustotal", "virustotal_url") and item.get("status") == "ok"
    ]
    return max(contagens, default=0)


def _por_dia(investigacoes: list[Investigacao]) -> list[dict[str, Any]]:
    """Vereditos de cada um dos últimos 14 dias, de meia-noite a meia-noite de Brasília."""
    primeiro = inicio_do_dia() - timedelta(days=DIAS_DO_GRAFICO - 1)
    dias = [
        {
            "dia": (primeiro + timedelta(days=n))
            .replace(tzinfo=UTC)
            .astimezone(FUSO_BRASILIA)
            .date()
            .isoformat(),
            "vereditos": Counter(),
        }
        for n in range(DIAS_DO_GRAFICO)
    ]
    for investigacao in investigacoes:
        if investigacao.criada_em >= primeiro:
            indice = (investigacao.criada_em - primeiro) // timedelta(days=1)
            if indice < DIAS_DO_GRAFICO:
                dias[indice]["vereditos"][investigacao.veredito] += 1
    return [{"dia": dia["dia"], "vereditos": dict(dia["vereditos"])} for dia in dias]


def do_usuario(db: Session, usuario_id: str) -> dict[str, Any]:
    investigacoes = db.scalars(
        select(Investigacao)
        .where(Investigacao.usuario_id == usuario_id)
        .order_by(Investigacao.criada_em.desc())
    ).all()
    por_veredito = Counter(investigacao.veredito for investigacao in investigacoes)
    vezes = Counter((investigacao.tipo, investigacao.valor) for investigacao in investigacoes)
    # A lista vem da mais nova para a mais antiga: a primeira de cada indicador é a última.
    ultima: dict[tuple[str, str], Investigacao] = {}
    for investigacao in investigacoes:
        ultima.setdefault((investigacao.tipo, investigacao.valor), investigacao)
    mais_pesquisados = [
        {"tipo": tipo, "valor": valor, "vezes": quantas, "veredito": ultima[(tipo, valor)].veredito}
        for (tipo, valor), quantas in vezes.most_common(TOP)
    ]
    ameacas = sorted(
        (investigacao for investigacao in ultima.values() if investigacao.veredito in AMEACAS),
        key=lambda investigacao: (investigacao.nota or 0, investigacao.criada_em),
        reverse=True,
    )[:TOP]
    return {
        "total": len(investigacoes),
        "por_veredito": dict(por_veredito),
        "por_tipo": dict(Counter(investigacao.tipo for investigacao in investigacoes)),
        "por_dia": _por_dia(investigacoes),
        "mais_pesquisados": mais_pesquisados,
        "ameacas": [
            {
                "id": investigacao.id,
                "tipo": investigacao.tipo,
                "valor": investigacao.valor,
                "veredito": investigacao.veredito,
                "nota": investigacao.nota,
                "deteccoes": _deteccoes(investigacao.evidencias),
            }
            for investigacao in ameacas
        ],
    }


def geral(db: Session) -> dict[str, Any]:
    contas = db.scalars(select(Usuario).order_by(Usuario.nome)).all()
    situacoes = Counter(situacao(usuario) for usuario in contas)
    desde = agora() - JANELA_USO
    # Usou no período: entrou ou investigou pelo menos uma vez.
    nomes_que_usaram = set(
        db.scalars(
            select(Evento.usuario).where(
                Evento.quando >= desde, Evento.tipo.in_(("login", "investigacao"))
            )
        )
    )
    ids_que_investigaram = set(
        db.scalars(select(Investigacao.usuario_id).where(Investigacao.criada_em >= desde))
    )
    ativas = [usuario for usuario in contas if usuario.ativo]
    sem_uso = [
        usuario.nome
        for usuario in ativas
        if usuario.nome not in nomes_que_usaram and usuario.id not in ids_que_investigaram
    ]
    total = db.scalar(select(func.count()).select_from(Investigacao))
    sites = db.scalar(
        select(func.count(func.distinct(Investigacao.valor))).where(Investigacao.tipo.in_(SITES))
    )
    indicadores = db.scalar(select(func.count(func.distinct(Investigacao.valor))))
    ameacas = db.scalar(
        select(func.count(func.distinct(Investigacao.valor))).where(
            Investigacao.veredito.in_(AMEACAS)
        )
    )
    ranking = db.execute(
        select(Usuario.nome, func.count(Investigacao.id).label("investigacoes"))
        .join(Investigacao, Investigacao.usuario_id == Usuario.id)
        .group_by(Usuario.nome)
        .order_by(func.count(Investigacao.id).desc(), Usuario.nome)
        .limit(TOP)
    ).all()
    return {
        "contas": len(contas),
        # Toda situação aparece, mesmo com zero: a tela não precisa adivinhar a lista.
        "situacoes": {nome: situacoes.get(nome, 0) for nome in SITUACOES},
        "usaram_30_dias": len(ativas) - len(sem_uso),
        "sem_uso_30_dias": sem_uso,
        "investigacoes": total,
        "sites_distintos": sites,
        "indicadores_distintos": indicadores,
        "ameacas_distintas": ameacas,
        "top_usuarios": [{"nome": nome, "investigacoes": quantas} for nome, quantas in ranking],
    }
