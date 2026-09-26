"""Ajudantes dos testes da API."""

SENHA = "senha-de-teste-longa"


def entrar(cliente, nome, senha=SENHA):
    return cliente.post("/api/login", json={"nome": nome, "senha": senha})


def csrf(cliente) -> dict[str, str]:
    """Cabeçalho CSRF da sessão atual, como o frontend envia."""
    return {"X-CSRF-Token": cliente.get("/api/sessao").json()["csrf"]}
