"""Os e-mails que o Inóxio manda às contas: o assunto e o texto de cada um, num lugar só."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import BackgroundTasks, Request

from inoxio.plataforma.correio import Enviar


@dataclass(frozen=True)
class Email:
    assunto: str
    texto: str


def link(request: Request, tela: str, token: str) -> str:
    """O token vai depois do "#": o navegador não o manda ao servidor nem ao log."""
    return f"{request.app.state.config.url_publica}/{tela}#{token}"


def agendar(tarefas: BackgroundTasks, enviar: Enviar, para: str, email: Email) -> None:
    """O envio sai depois da resposta: o SMTP lento não segura a tela."""
    tarefas.add_task(enviar, para, email.assunto, email.texto)


def ativacao(nome: str, link: str) -> Email:
    return Email(
        "Ative sua conta no Inóxio",
        f"Olá, {nome}.\n\n"
        "Recebemos um cadastro no Inóxio com este e-mail. Para ativar a conta, abra o link "
        f"abaixo nas próximas 24 horas:\n\n{link}\n\n"
        "Se não foi você, ignore esta mensagem: sem a ativação, a conta não entra.\n",
    )


def senha_nova(nome: str, link: str) -> Email:
    return Email(
        "Senha nova no Inóxio",
        f"Olá, {nome}.\n\n"
        "Recebemos um pedido para criar uma senha nova para a sua conta no Inóxio. "
        f"Abra o link abaixo na próxima hora:\n\n{link}\n\n"
        "Se não foi você, ignore esta mensagem: a senha atual continua valendo.\n",
    )


def confirmar_email_novo(nome: str, link: str) -> Email:
    return Email(
        "Confirme o seu novo e-mail no Inóxio",
        f"Olá, {nome}.\n\nPara usar este e-mail na sua conta do Inóxio, abra o "
        f"link abaixo nas próximas 24 horas:\n\n{link}\n\n"
        "Se não foi você, ignore esta mensagem: nada muda.\n",
    )


def aviso_de_troca_de_email(nome: str) -> Email:
    return Email(
        "Pedido de troca do e-mail da sua conta no Inóxio",
        f"Olá, {nome}.\n\nPediram para trocar o e-mail da sua conta no "
        "Inóxio. Ele só muda depois da confirmação pelo e-mail novo.\n\n"
        "Se não foi você, troque a sua senha em Minha conta.\n",
    )
