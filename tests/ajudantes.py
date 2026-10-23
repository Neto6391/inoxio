"""Ajudantes dos testes da API."""

SENHA = "senha-de-teste-longa"


def entrar(cliente, nome, senha=SENHA):
    return cliente.post("/api/login", json={"nome": nome, "senha": senha})


def csrf(cliente) -> dict[str, str]:
    """Cabeçalho CSRF da sessão atual, como o frontend envia."""
    return {"X-CSRF-Token": cliente.get("/api/sessao").json()["csrf"]}


class CaixaDeSaida:
    """Faz o papel do SMTP: guarda (destino, assunto, texto) de cada envio."""

    def __init__(self):
        self.mensagens = []

    def __call__(self, destino, assunto, texto):
        self.mensagens.append((destino, assunto, texto))

    def token(self, caminho="/ativar#"):
        return self.mensagens[-1][2].split(caminho)[1].split()[0]
