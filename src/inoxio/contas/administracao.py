"""O que o admin muda nas contas: papel, senha, cota, situação e sessões."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inoxio.contas import sessoes
from inoxio.contas.credenciais import gerar_hash
from inoxio.contas.modelos import (
    Usuario,
)
from inoxio.contas.regras import Conflito, conferir_papel, pendente, situacao
from inoxio.plataforma.banco import agora


def filtrar(
    db: Session, busca: str = "", papel: str | None = None, situacao_: str | None = None
) -> list[Usuario]:
    """As contas em ordem de nome, filtradas como nas telas de Usuários e de Auditoria.
    A busca procura no usuário, no nome de exibição e no e-mail, sem diferenciar
    maiúsculas."""
    termo = busca.strip().casefold()
    contas = db.scalars(select(Usuario).order_by(Usuario.nome)).all()
    return [
        conta
        for conta in contas
        if (not papel or conta.papel == papel)
        and (not situacao_ or situacao(conta) == situacao_)
        and (
            not termo
            or any(
                termo in (campo or "").casefold()
                for campo in (conta.nome, conta.nome_exibicao, conta.email)
            )
        )
    ]


def alterar(
    db: Session,
    alvo: Usuario,
    quem_altera: Usuario,
    *,
    papel: str | None = None,
    senha: str | None = None,
    ativo: bool | None = None,
    cota_diaria: int | None = None,
    sem_cota: bool = False,
    zerar_uso: bool = False,
    encerrar_sessoes: bool = False,
    sessao_mantida: str | None = None,
) -> None:
    """Muda papel, senha, cota ou situação. Senha nova ou desativação derruba as sessões,
    menos a `sessao_mantida` (o hash do token): o admin que troca a própria senha segue
    dentro. `sem_cota` tira a cota diária; `cota_diaria=None` só deixa como está.
    `zerar_uso` devolve os créditos de hoje; `encerrar_sessoes` derruba as sessões sem
    desativar a conta. O admin não tem cota: virar admin tira a que havia."""
    if papel is not None:
        conferir_papel(papel)
    if cota_diaria is not None and not 1 <= cota_diaria <= 10_000:
        raise ValueError("A cota diária precisa ficar entre 1 e 10.000 investigações.")
    if sem_cota and cota_diaria is not None:
        raise ValueError("Informe a cota ou peça para tirá-la, não as duas coisas.")
    if cota_diaria is not None and (papel or alvo.papel) == "admin":
        raise ValueError("O admin não tem cota diária.")
    novo_hash = gerar_hash(senha) if senha is not None else None
    if ativo is False and alvo.id == quem_altera.id:
        raise Conflito("Você não pode desativar a própria conta.")
    if papel is not None and papel != alvo.papel and alvo.id == quem_altera.id:
        # Trocar o próprio papel tranca o admin do lado de fora, como desativar a conta.
        raise Conflito("Você não pode mudar o próprio papel. Peça a outro admin.")
    deixa_de_ser_admin = (
        alvo.papel == "admin"
        and alvo.ativo
        and (ativo is False or (papel is not None and papel != "admin"))
    )
    if deixa_de_ser_admin and admins_ativos(db) <= 1:
        raise Conflito("Precisa sobrar pelo menos um admin ativo.")
    if papel is not None:
        alvo.papel = papel
        if papel == "admin":
            alvo.cota_diaria = None
    if novo_hash is not None:
        alvo.senha_hash = novo_hash
    if ativo is not None:
        # Ativar pela tela também vale como confirmação para quem ainda esperava o e-mail,
        # ou para a conta que o admin tinha recusado.
        if ativo and (pendente(alvo) or alvo.recusada_em is not None):
            alvo.email_confirmado_em = agora()
            alvo.recusada_em = None
        # Desativar quem ainda esperava o e-mail é recusar: o link e um cadastro novo
        # com o mesmo e-mail não a ativam mais.
        if not ativo and pendente(alvo):
            alvo.recusada_em = agora()
        alvo.ativo = ativo
    if cota_diaria is not None:
        alvo.cota_diaria = cota_diaria
    if sem_cota:
        alvo.cota_diaria = None
    if zerar_uso:
        alvo.uso_zerado_em = agora()
    if ativo is False:
        motivo = "conta desativada pelo admin"
    elif novo_hash is not None:
        motivo = "senha trocada pelo admin"
    elif encerrar_sessoes:
        motivo = "encerrada pelo admin"
    else:
        return
    sessoes.fechar_todas(db, alvo.id, motivo, exceto=sessao_mantida)


def admins_ativos(db: Session) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Usuario)
        .where(Usuario.papel == "admin", Usuario.ativo.is_(True))
    )


# Páginas curtas: a paginação aparece já com poucos usuários e poucas sessões.
USUARIOS_POR_PAGINA = 10
