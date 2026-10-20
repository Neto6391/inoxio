"""Envio de e-mail por SMTP com STARTTLS (Gmail com senha de app, por padrão)."""

from __future__ import annotations

import logging
import smtplib
import ssl
from collections.abc import Callable
from email.message import EmailMessage

from inoxio.config import Config

log = logging.getLogger("inoxio.correio")
TIMEOUT = 15

Enviar = Callable[[str, str, str], None]


def criar_envio(config: Config) -> Enviar | None:
    """Função que envia (destino, assunto, texto), ou None sem SMTP configurado."""
    if not (config.smtp_usuario and config.smtp_senha):
        return None

    def enviar(destino: str, assunto: str, texto: str) -> None:
        mensagem = EmailMessage()
        mensagem["From"] = f"Inóxio <{config.smtp_usuario}>"
        mensagem["To"] = destino
        mensagem["Subject"] = assunto
        mensagem.set_content(texto)
        try:
            with smtplib.SMTP(config.smtp_host, config.smtp_porta, timeout=TIMEOUT) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(config.smtp_usuario, config.smtp_senha)
                smtp.send_message(mensagem)
        except (OSError, smtplib.SMTPException):
            # O cadastro já foi gravado; o admin ainda pode ativar a conta pela tela.
            log.warning("email_nao_enviado", exc_info=True)

    return enviar
