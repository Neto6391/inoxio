"""Números do painel: do próprio usuário e, para o admin, do sistema todo."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from inoxio.db import Evento, Investigacao, Usuario, agora
from inoxio.seguranca.limites import FUSO_BRASILIA, inicio_do_dia

TOP = 10
DIAS_DO_GRAFICO = 14
JANELA_USO = timedelta(days=30)
AMEACAS = ("malicioso", "suspeito")
SITES = ("dominio", "url")


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


def _porcentagem(parte: int, todo: int) -> float:
    return round(100 * parte / todo, 1) if todo else 0.0


def geral(db: Session) -> dict[str, Any]:
    contas = db.scalar(select(func.count()).select_from(Usuario))
    ativas = db.scalar(select(func.count()).select_from(Usuario).where(Usuario.ativo.is_(True)))
    desde = agora() - JANELA_USO
    # Usou no período: entrou ou investigou pelo menos uma vez.
    nomes_que_usaram = select(Evento.usuario).where(
        Evento.quando >= desde, Evento.tipo.in_(("login", "investigacao"))
    )
    ids_que_investigaram = select(Investigacao.usuario_id).where(Investigacao.criada_em >= desde)
    usaram = db.scalar(
        select(func.count())
        .select_from(Usuario)
        .where(
            Usuario.ativo.is_(True),
            or_(Usuario.nome.in_(nomes_que_usaram), Usuario.id.in_(ids_que_investigaram)),
        )
    )
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
        "contas": contas,
        "contas_ativas": ativas,
        "porcentagem_ativas": _porcentagem(ativas, contas),
        "usaram_30_dias": usaram,
        "porcentagem_uso_30_dias": _porcentagem(usaram, ativas),
        "investigacoes": total,
        "sites_distintos": sites,
        "indicadores_distintos": indicadores,
        "ameacas_distintas": ameacas,
        "top_usuarios": [{"nome": nome, "investigacoes": quantas} for nome, quantas in ranking],
    }
