"""Grafo da investigação. As rotas são funções puras do estado; nenhuma depende da IA."""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from inoxio.agente.classificar import MOTIVO, classificar_entrada, host_da_url
from inoxio.agente.decidir import decidir_veredito
from inoxio.agente.estado import Estado
from inoxio.agente.fontes import Fonte, consultar_fontes
from inoxio.agente.mente import Invocar, analisar
from inoxio.historico import Buscar


def rota_entrada(estado: Estado) -> str:
    return "rejeitado" if estado["tipo"] == "rejeitado" else "ioc"


def rota_reaproveitamento(estado: Estado) -> str:
    if not estado["reaproveitada"]:
        return "consultar"
    # Fontes reaproveitadas; a mente só roda se a análise anterior tinha falhado.
    return "pronto" if estado.get("analise") else "explicar"


def dados_da_mente(estado: Estado) -> dict[str, Any]:
    indicador = {"tipo": estado["tipo"], "valor": estado["valor"]}
    nao_confiaveis: list[dict[str, Any]] = list(estado["evidencias"])
    if estado["tipo"] == "url":
        # Caminho e parâmetros da URL são texto de quem investiga: vão com os dados
        # não confiáveis, e fora deles fica só o host, já validado.
        indicador = {"tipo": "url", "host": host_da_url(estado["valor"])[1]}
        nao_confiaveis.append({"fonte": "url_investigada", "dados": {"url": estado["valor"]}})
    return {
        "indicador": indicador,
        "veredito_decidido": estado["veredito"],
        "nota": estado.get("nota"),
        "DADOS_NAO_CONFIAVEIS": nao_confiaveis,
    }


def construir_grafo(fontes: list[Fonte], invocar: Invocar | None, buscar: Buscar | None = None):
    def classificar(estado: Estado) -> dict[str, Any]:
        tipo, valor = classificar_entrada(estado.get("entrada", ""))
        return {"tipo": tipo, "valor": valor, "motivo": MOTIVO if tipo == "rejeitado" else ""}

    def buscar_recente(estado: Estado) -> dict[str, Any]:
        anterior = buscar(estado["tipo"], estado["valor"]) if buscar else None
        return {"reaproveitada": True, **anterior} if anterior else {"reaproveitada": False}

    def consultar(estado: Estado) -> dict[str, Any]:
        # O argumento vem da entrada classificada, nunca da IA.
        evidencias = consultar_fontes(fontes, estado["tipo"], estado["valor"])
        if estado["tipo"] == "url":
            # A URL e também o domínio (ou IP) dela: o veredito considera os dois.
            evidencias += consultar_fontes(fontes, *host_da_url(estado["valor"]))
        return {"evidencias": evidencias}

    def decidir(estado: Estado) -> dict[str, Any]:
        veredito, nota = decidir_veredito(estado["evidencias"])
        return {"veredito": veredito, "nota": nota}

    def mente(estado: Estado) -> dict[str, Any]:
        return {"analise": analisar(dados_da_mente(estado), invocar)}

    grafo = StateGraph(Estado)
    grafo.add_node("classificar", classificar)
    grafo.add_node("buscar_recente", buscar_recente)
    grafo.add_node("consultar_fontes", consultar)
    grafo.add_node("decidir", decidir)
    grafo.add_node("mente", mente)
    grafo.add_edge(START, "classificar")
    grafo.add_conditional_edges(
        "classificar", rota_entrada, {"ioc": "buscar_recente", "rejeitado": END}
    )
    grafo.add_conditional_edges(
        "buscar_recente",
        rota_reaproveitamento,
        {"consultar": "consultar_fontes", "explicar": "mente", "pronto": END},
    )
    grafo.add_edge("consultar_fontes", "decidir")
    grafo.add_edge("decidir", "mente")
    grafo.add_edge("mente", END)
    return grafo.compile()
