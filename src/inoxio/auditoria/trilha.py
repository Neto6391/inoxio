"""Trilha de auditoria: registra os eventos que importam e apaga os de mais de 90 dias."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from inoxio.auditoria.modelos import Evento
from inoxio.plataforma.banco import agora
from inoxio.plataforma.rede import origem

RETENCAO = timedelta(days=90)


def registrar(
    db: Session,
    tipo: str,
    ip: str,
    usuario: str | None = None,
    detalhe: str = "",
    *,
    sessao: str | None = None,
    quando: datetime | None = None,
) -> None:
    """`sessao` é o Sessao.ref de onde veio o evento; `quando` só muda no fim de uma
    sessão vencida, que acabou antes de alguém perceber."""
    db.execute(delete(Evento).where(Evento.quando < agora() - RETENCAO))
    db.add(
        Evento(
            tipo=tipo,
            usuario=usuario,
            ip=origem(ip),
            detalhe=detalhe[:300],
            sessao=sessao,
            quando=quando or agora(),
        )
    )


def contar(db: Session, tipo: str, ip: str, janela: timedelta) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Evento)
        .where(Evento.tipo == tipo, Evento.ip == origem(ip), Evento.quando >= agora() - janela)
    )


# Todo tipo de evento que o sistema registra; a tela da Auditoria dá nome a cada um.
TIPOS_EVENTO = (
    "login",
    "login_falhou",
    "login_bloqueado",
    "logout",
    "cadastro",
    "ativacao",
    "investigacao",
    "investigacao_alheia",
    "admin_cadastrou",
    "admin_alterou",
    "backup",
    "termos_aceitos",
    "conta_excluida",
    "senha_pedida",
    "senha_redefinida",
    "explicacao_pedida",
    "sessao_encerrada",
    "conta_alterada",
    "email_troca_pedida",
    "email_trocado",
)
