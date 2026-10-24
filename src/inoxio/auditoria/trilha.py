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


def _contar(db: Session, janela: timedelta, *filtros) -> int:
    return db.scalar(
        select(func.count()).select_from(Evento).where(Evento.quando >= agora() - janela, *filtros)
    )


def contar_do_ip(db: Session, tipo: str, ip: str, janela: timedelta) -> int:
    """Eventos de um tipo vindos de um endereço: os limites por IP."""
    return _contar(db, janela, Evento.tipo == tipo, Evento.ip == origem(ip))


def contar_da_conta(
    db: Session, tipo: str, usuario: str, janela: timedelta, detalhe: str | None = None
) -> int:
    """Eventos de um tipo de uma conta, de qualquer IP: os limites por conta."""
    filtros = [Evento.tipo == tipo, Evento.usuario == usuario]
    if detalhe is not None:
        filtros.append(Evento.detalhe == detalhe)
    return _contar(db, janela, *filtros)


# Todo tipo de evento que o sistema registra, com o nome que a tela da Auditoria mostra.
NOMES_EVENTO = {
    "login": "entrou",
    "login_falhou": "senha errada",
    "login_bloqueado": "login bloqueado",
    "logout": "saiu",
    "cadastro": "cadastro",
    "ativacao": "ativação",
    "investigacao": "investigação",
    "investigacao_alheia": "abriu investigação de outro",
    "admin_cadastrou": "admin cadastrou",
    "admin_alterou": "admin alterou",
    "backup": "backup",
    "termos_aceitos": "aceitou os termos",
    "conta_excluida": "conta excluída",
    "senha_pedida": "pediu senha nova",
    "senha_redefinida": "trocou a senha",
    "explicacao_pedida": "pediu a explicação de novo",
    "sessao_encerrada": "sessão encerrada",
    "conta_alterada": "mudou a própria conta",
    "email_troca_pedida": "pediu troca de e-mail",
    "email_trocado": "trocou o e-mail",
}
