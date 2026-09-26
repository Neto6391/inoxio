# Inóxio

Investigador de indicadores suspeitos. Cole um IP, um domínio ou o hash de um
arquivo e receba um veredito calculado por regra fixa a partir do VirusTotal e do
AbuseIPDB, com uma explicação em português escrita por uma IA que não decide
nada.

> *innoxius* (lat.): inofensivo. O veredito decide se o artefato é *noxius* ou
> *innoxius*.

Projeto da disciplina **Projeto Aplicado: Práticas de Mercado**
([escopo](https://github.com/ziraldocardoso/Projeto_aplicado-praticas_de_mercado/blob/main/Escopo_e_elementos_obrigatorios.md)).

## Como funciona

<!-- Gerado por `uv run python -m inoxio.agente.desenhar`; um teste falha se divergir do grafo. -->
<!-- grafo:inicio -->
```mermaid
---
config:
  flowchart:
    curve: linear
---
graph TD;
	__start__([<p>__start__</p>]):::first
	classificar(classificar)
	buscar_recente(buscar_recente)
	consultar_fontes(consultar_fontes)
	decidir(decidir)
	mente(mente)
	__end__([<p>__end__</p>]):::last
	__start__ --> classificar;
	buscar_recente -. &nbsp;pronto&nbsp; .-> __end__;
	buscar_recente -. &nbsp;consultar&nbsp; .-> consultar_fontes;
	buscar_recente -. &nbsp;explicar&nbsp; .-> mente;
	classificar -. &nbsp;rejeitado&nbsp; .-> __end__;
	classificar -. &nbsp;ioc&nbsp; .-> buscar_recente;
	consultar_fontes --> decidir;
	decidir --> mente;
	mente --> __end__;
	classDef default fill:#f2f0ff,line-height:1.2
	classDef first fill-opacity:0
	classDef last fill:#bfb6fc
```
<!-- grafo:fim -->

- **Classificar:** a entrada só segue se for IP público, hash MD5/SHA-1/SHA-256
  ou domínio. O resto é recusado sem consultar nada.
- **Reaproveitar:** o mesmo indicador investigado há menos de 24 h devolve o
  resultado salvo, sem gastar a cota das fontes nem da IA.
- **Consultar e decidir:** VirusTotal e AbuseIPDB em paralelo. O veredito
  (`malicioso`, `suspeito`, `sem_evidencia`, `desconhecido` ou `inconclusivo`) e a
  nota de risco saem de regras fixas.
- **Mente:** um LLM no Groq lê os resultados e devolve resumo, técnicas MITRE
  ATT&CK e recomendações num esquema fixo. Ele não tem ferramentas e não tem
  campo de veredito.

## OWASP Top 10:2025

Os três itens exigidos e o controle de cada um, todos cobertos por testes:

| Item | Resumo do controle |
| --- | --- |
| **A01 Broken Access Control** | Sessão obrigatória, investigação alheia → 404, CSRF por cabeçalho e corpo só JSON |
| **A05 Injection** | Indicador validado por tipo antes de qualquer uso, SQL parametrizado, o app não executa processo, React sem injeção de HTML + CSP com nonce |
| **A07 Authentication Failures** | argon2id, limite de tentativas, mensagem única, sessão nova a cada login, logout que invalida no servidor |

Extras: A10 (falha nunca vira "sem evidência") e A03 (dependências e Actions
fixadas). Para a IA: LLM01, LLM02, LLM05, LLM06, LLM07 e LLM10.

## Stack

FastAPI + LangGraph (Python 3.12) na API, React 19 + Ant Design 6 no frontend,
SQLite, Groq para a IA.

## Conta e repositório

- Conta GitHub gratuita com 2FA; operações por chave SSH.
- Repositório público, com *push protection* de segredos ativada.
- Segredos só nos Secrets do GitHub (`INOXIO_SSH_KEY`, `INOXIO_SSH_KNOWN_HOSTS`)
  e, na VPS, num arquivo com modo 600 fora do repositório.

## Uso de IA

Como pede o escopo, o desenvolvimento e a auditoria do código usaram IA: o
**Claude Code**, no lugar do Google Antigravity recomendado, para escrever e
revisar o código e a segurança.

## Desvios declarados

- **Free Tier:** a aplicação roda numa VPS paga que já existia, compartilhada com
  outro sistema do autor, e não num nível gratuito de nuvem. Um Nginx na frente
  separa o tráfego dos dois pelo nome pedido na conexão TLS.
- **Portas de outro sistema:** há portas UDP abertas na mesma máquina que
  pertencem a esse outro sistema. O Inóxio expõe só 80 e 443 (e 22).
