"""O formato da resposta da IA e os limites conferidos aqui.

O formato pedido traz apenas os tipos; os limites (tamanho, formato MITRE) são
conferidos aqui, porque nem todo provedor os aceita no esquema.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints

from inoxio.investigacoes.ia.filtro import frases

Confianca = Literal["baixa", "media", "alta"]


Tecnica = Annotated[str, StringConstraints(pattern=r"^T\d{4}(\.\d{3})?$")]


Recomendacao = Annotated[str, StringConstraints(max_length=300)]


Paragrafo = Annotated[str, StringConstraints(max_length=800)]


TECNICA_VALIDA = re.compile(r"^T\d{4}(\.\d{3})?$")


class Termo(BaseModel):
    """Um termo técnico do resultado, explicado para quem não é da área."""

    termo: str
    significado: str


class TermoAceito(BaseModel):
    termo: Annotated[str, StringConstraints(max_length=60)]
    significado: Annotated[str, StringConstraints(max_length=300)]


class RespostaMente(BaseModel):
    """O que se pede ao modelo. Só o resumo é obrigatório: o modelo às vezes para no
    meio, e o provedor recusaria o que veio antes. Os campos mais valiosos vêm primeiro."""

    resumo: str
    por_fonte: list[str] = Field(default_factory=list)
    recomendacoes: list[str] = Field(default_factory=list)
    termos: list[Termo] = Field(default_factory=list)
    tecnicas_mitre: list[str] = Field(default_factory=list)
    confianca: Confianca | None = None


class AnaliseMente(BaseModel):
    """O que se aceita do modelo."""

    resumo: Annotated[str, StringConstraints(max_length=1200)]
    tecnicas_mitre: list[Tecnica] = Field(default_factory=list, max_length=5)
    recomendacoes: list[Recomendacao] = Field(default_factory=list, max_length=8)
    # Sem confiança informada, a tela diz isso; não se inventa uma.
    confianca: Confianca | None = None
    # Análises guardadas antes do glossário não têm termos.
    termos: list[TermoAceito] = Field(default_factory=list, max_length=6)
    # Um parágrafo por fonte consultada; as análises antigas não têm.
    por_fonte: list[Paragrafo] = Field(default_factory=list, max_length=4)


def dentro_dos_limites(bruto: Any) -> Any:
    """O modelo às vezes passa de um limite. Sai só o que passou (o item longo demais,
    o código MITRE inválido, o excesso da lista), e o resto da explicação continua."""
    if not isinstance(bruto, dict):
        return bruto

    def texto(maximo: int) -> Callable[[Any], bool]:
        return lambda item: isinstance(item, str) and len(item) <= maximo

    def termo(item: Any) -> bool:
        return (
            isinstance(item, dict)
            and len(str(item.get("termo", ""))) <= 60
            and len(str(item.get("significado", ""))) <= 300
        )

    def tecnica(item: Any) -> bool:
        return isinstance(item, str) and TECNICA_VALIDA.match(item) is not None

    regras = {
        "tecnicas_mitre": (5, tecnica),
        "recomendacoes": (8, texto(300)),
        "termos": (6, termo),
        "por_fonte": (4, texto(800)),
    }
    ajustado = dict(bruto)
    for campo, (maximo, cabe) in regras.items():
        if isinstance(ajustado.get(campo), list):
            ajustado[campo] = [item for item in ajustado[campo] if cabe(item)][:maximo]
    resumo = ajustado.get("resumo")
    if isinstance(resumo, str) and len(resumo) > 1200:
        # Fica com as frases inteiras que cabem; uma frase só, gigante, não cabe.
        cabem: list[str] = []
        for frase in frases(resumo):
            if len(" ".join([*cabem, frase])) > 1200:
                break
            cabem.append(frase)
        ajustado["resumo"] = " ".join(cabem)
    return ajustado
