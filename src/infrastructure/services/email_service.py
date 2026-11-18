import smtplib
from email.message import EmailMessage
from typing import Iterable

from src.infrastructure.services.env_load import get_env
from src.shared.exception import IntegracaoException


class EmailService:
    def send_html(
        self,
        to_email: str | Iterable[str],
        subject: str,
        html: str,
        attachments: list[dict[str, object]] | None = None,
    ) -> None:
        remetente = get_env("EMAIL", required=True)
        senha = get_env("EMAIL_SENHA", required=True)
        smtp_host = get_env("EMAIL_SMTP_HOST", default="smtp.gmail.com") or "smtp.gmail.com"
        smtp_port = int(get_env("EMAIL_SMTP_PORT", default="465") or "465")
        destinatarios = [to_email] if isinstance(to_email, str) else list(to_email)

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = remetente
        msg["To"] = ", ".join(destinatarios)
        msg.set_content("Seu cliente de email nao suporta HTML.")
        msg.add_alternative(html, subtype="html")
        for attachment in attachments or []:
            content = attachment.get("content")
            if not isinstance(content, bytes):
                continue
            msg.add_attachment(
                content,
                maintype=str(attachment.get("maintype") or "application"),
                subtype=str(attachment.get("subtype") or "octet-stream"),
                filename=str(attachment.get("filename") or "anexo"),
            )

        try:
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as smtp:
                smtp.login(remetente, senha)
                smtp.send_message(msg)
        except Exception as exc:
            raise IntegracaoException(f"Falha ao enviar e-mail: {exc}") from exc
