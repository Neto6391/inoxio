"""O que o titular corrige no próprio perfil."""

from __future__ import annotations

from inoxio.contas.modelos import (
    Usuario,
)

NOME_EXIBICAO_MAXIMO = 80


def definir_nome_exibicao(usuario: Usuario, texto: str) -> None:
    """Em branco volta a mostrar o nome de usuário."""
    limpo = " ".join(texto.split())
    if len(limpo) > NOME_EXIBICAO_MAXIMO:
        raise ValueError(f"O nome pode ter até {NOME_EXIBICAO_MAXIMO} caracteres.")
    if any(not caractere.isprintable() for caractere in limpo):
        raise ValueError("O nome tem caracteres que não aparecem na tela.")
    usuario.nome_exibicao = limpo or None
