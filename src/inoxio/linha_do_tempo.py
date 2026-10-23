"""Auditoria por usuário: a situação de cada conta e as sessões, com o que houve em cada uma.

Daqui em diante cada evento feito dentro de uma sessão leva o Sessao.ref, e o fim da
sessão também vira evento (saiu, venceu, foi encerrada). Os eventos de antes não têm o
ref: a sessão deles é reconstruída de um login até o próximo e sai marcada como
aproximada.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inoxio.db import Evento, Sessao, Usuario, agora
from inoxio.seguranca.limites import FUSO_BRASILIA
from inoxio.seguranca.sessoes import fim_por_validade
from inoxio.usuarios import pendente

# Acontecem dentro de uma sessão; os outros (senha errada, cadastro, link de senha) não.
DA_SESSAO = (
    "login",
    "logout",
    "sessao_encerrada",
    "investigacao",
    "investigacao_alheia",
    "explicacao_pedida",
    "admin_cadastrou",
    "admin_alterou",
    "termos_aceitos",
)
FALHAS = ("login_falhou", "login_bloqueado")


def situacao(usuario: Usuario) -> str:
    if usuario.ativo:
        return "ativa"
    if pendente(usuario):
        return "aguardando"
    return "recusada" if usuario.recusada_em is not None else "desativada"


def _por_nome(db: Session, *filtro) -> dict[str, Any]:
    linhas = db.execute(
        select(Evento.usuario, func.count(), func.max(Evento.quando))
        .where(Evento.usuario.is_not(None), *filtro)
        .group_by(Evento.usuario)
    )
    return {nome: (quantos, ultimo) for nome, quantos, ultimo in linhas}


def _abertas(db: Session) -> dict[str, int]:
    momento = agora()
    contagem: dict[str, int] = {}
    for sessao in db.scalars(select(Sessao)):
        if fim_por_validade(sessao)[0] > momento:
            contagem[sessao.usuario_id] = contagem.get(sessao.usuario_id, 0) + 1
    return contagem


def resumo_por_usuario(db: Session) -> list[dict[str, Any]]:
    logins = _por_nome(db, Evento.tipo == "login")
    falhas = _por_nome(db, Evento.tipo.in_(FALHAS))
    investigacoes = _por_nome(db, Evento.tipo == "investigacao")
    abertas = _abertas(db)
    return [
        {
            "nome": usuario.nome,
            "papel": usuario.papel,
            "situacao": situacao(usuario),
            "ultimo_acesso": _data(logins.get(usuario.nome, (0, None))[1]),
            "sessoes": logins.get(usuario.nome, (0, None))[0],
            "abertas": abertas.get(usuario.id, 0),
            "falhas_de_login": falhas.get(usuario.nome, (0, None))[0],
            "investigacoes": investigacoes.get(usuario.nome, (0, None))[0],
        }
        for usuario in db.scalars(select(Usuario).order_by(Usuario.nome))
    ]


def _data(momento: datetime | None) -> str | None:
    return momento.isoformat() if momento else None


def _em_utc(dia: date) -> datetime:
    """Meia-noite de Brasília do dia, em UTC sem fuso, como o banco guarda."""
    return datetime.combine(dia, time(), tzinfo=FUSO_BRASILIA).astimezone(UTC).replace(tzinfo=None)


def _evento(evento: Evento) -> dict[str, Any]:
    return {
        "quando": evento.quando.isoformat(),
        "tipo": evento.tipo,
        "ip": evento.ip,
        "detalhe": evento.detalhe,
    }


def _nova(primeiro: Evento, aproximada: bool) -> dict[str, Any]:
    return {
        "id": primeiro.sessao or f"aprox-{primeiro.id}",
        "aproximada": aproximada,
        # Sessão antiga que não começou com login: o começo dela ficou fora da trilha.
        "inicio_registrado": primeiro.tipo == "login",
        "inicio": primeiro.quando,
        "ip": primeiro.ip,
        "fim": None,
        "motivo_fim": None,
        "aberta": False,
        "eventos": [],
    }


def _fechar(sessao: dict[str, Any], evento: Evento) -> None:
    sessao["fim"] = evento.quando
    sessao["motivo_fim"] = "saiu" if evento.tipo == "logout" else evento.detalhe


def _sessoes(db: Session, eventos: list[Evento]) -> list[dict[str, Any]]:
    exatas: dict[str, dict[str, Any]] = {}
    aproximadas: list[dict[str, Any]] = []
    atual: dict[str, Any] | None = None
    for evento in eventos:
        if evento.sessao:
            sessao = exatas.setdefault(evento.sessao, _nova(evento, aproximada=False))
        elif evento.tipo == "login" or atual is None or atual["fim"] is not None:
            atual = _nova(evento, aproximada=True)
            aproximadas.append(atual)
            sessao = atual
        else:
            sessao = atual
        sessao["eventos"].append(_evento(evento))
        if evento.tipo in ("logout", "sessao_encerrada"):
            _fechar(sessao, evento)
    # A sessão exata que não terminou com evento: ainda está no banco, aberta ou vencida
    # sem que o navegador tenha voltado.
    sem_fim = [ref for ref, sessao in exatas.items() if sessao["fim"] is None]
    if sem_fim:
        momento = agora()
        for linha in db.scalars(select(Sessao).where(Sessao.ref.in_(sem_fim))):
            fim, motivo = fim_por_validade(linha)
            sessao = exatas[linha.ref]
            if fim > momento:
                sessao["aberta"] = True
                sessao["expira_em"] = fim
            else:
                sessao["fim"], sessao["motivo_fim"] = fim, motivo
    todas = list(exatas.values()) + aproximadas
    for sessao in todas:
        sessao["acoes"] = sum(
            evento["tipo"] not in ("login", "logout", "sessao_encerrada")
            for evento in sessao["eventos"]
        )
        for campo in ("inicio", "fim", "expira_em"):
            if isinstance(sessao.get(campo), datetime):
                sessao[campo] = sessao[campo].isoformat()
    return sorted(todas, key=lambda sessao: sessao["inicio"], reverse=True)


def sessoes_de(db: Session, nome: str, de: date | None, ate: date | None) -> dict[str, Any]:
    """Sessões que começaram no período (dias de Brasília, `ate` incluso) e os eventos
    do usuário fora de sessão no mesmo período."""
    filtro = [Evento.usuario == nome]
    eventos = db.scalars(select(Evento).where(*filtro).order_by(Evento.quando, Evento.id)).all()
    inicio = _em_utc(de) if de else None
    fim = _em_utc(ate + timedelta(days=1)) if ate else None

    def no_periodo(momento: str) -> bool:
        quando = datetime.fromisoformat(momento)
        return (inicio is None or quando >= inicio) and (fim is None or quando < fim)

    sessoes = _sessoes(db, [evento for evento in eventos if evento.tipo in DA_SESSAO])
    fora = [_evento(evento) for evento in reversed(eventos) if evento.tipo not in DA_SESSAO]
    return {
        "sessoes": [sessao for sessao in sessoes if no_periodo(sessao["inicio"])],
        "fora_de_sessao": [evento for evento in fora if no_periodo(evento["quando"])],
    }
