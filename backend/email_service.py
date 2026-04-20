"""
Простой SMTP-отправитель для транзакционных писем (сброс пин-кода и т.п.).

Конфигурация через env:
  EMAIL_SMTP_HOST   — например, smtp.yandex.ru
  EMAIL_SMTP_PORT   — 465 (SSL) или 587 (STARTTLS), по умолчанию 465
  EMAIL_SMTP_USER   — логин (обычно полный email)
  EMAIL_SMTP_PASS   — пароль или app-password
  EMAIL_FROM        — From-заголовок ("Фреди <noreply@example.com>"); по умолчанию = USER
  EMAIL_SMTP_TLS    — '1' (default) → SSL на 465, '0' → STARTTLS на 587

Если EMAIL_SMTP_HOST/USER/PASS пустые — сервис отключён, send() возвращает False.
"""
import logging
import os
from email.message import EmailMessage
from typing import Optional

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self):
        self.host = (os.environ.get("EMAIL_SMTP_HOST") or "").strip()
        try:
            self.port = int(os.environ.get("EMAIL_SMTP_PORT") or "465")
        except ValueError:
            self.port = 465
        self.user = (os.environ.get("EMAIL_SMTP_USER") or "").strip()
        self.password = (os.environ.get("EMAIL_SMTP_PASS") or "").strip()
        self.from_addr = (os.environ.get("EMAIL_FROM") or self.user).strip()
        self.use_tls = (os.environ.get("EMAIL_SMTP_TLS") or "1").strip() == "1"
        self.enabled = bool(self.host and self.user and self.password)
        if self.enabled:
            logger.info(
                f"📧 EmailService готов: host={self.host}:{self.port} "
                f"from={self.from_addr} ssl={self.use_tls}"
            )
        else:
            logger.warning(
                "📧 EmailService отключён (нет EMAIL_SMTP_HOST/USER/PASS в env)"
            )

    async def send(self, to: str, subject: str, body: str,
                    html: Optional[str] = None) -> bool:
        """Отправляет письмо. True — если SMTP принял, False — иначе/отключено."""
        if not self.enabled:
            logger.warning(f"send_email skipped (disabled): to={to} subject={subject!r}")
            return False
        try:
            import aiosmtplib  # ленивый импорт — модуль может отсутствовать в dev
        except ImportError:
            logger.error("aiosmtplib не установлен — пропускаю отправку")
            return False

        msg = EmailMessage()
        msg["From"] = self.from_addr
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        if html:
            msg.add_alternative(html, subtype="html")

        try:
            if self.use_tls:
                # Implicit SSL/TLS на порту 465
                await aiosmtplib.send(
                    msg,
                    hostname=self.host,
                    port=self.port,
                    username=self.user,
                    password=self.password,
                    use_tls=True,
                    timeout=20,
                )
            else:
                # STARTTLS на порту 587
                await aiosmtplib.send(
                    msg,
                    hostname=self.host,
                    port=self.port,
                    username=self.user,
                    password=self.password,
                    start_tls=True,
                    timeout=20,
                )
            logger.info(f"📧 sent: to={to} subject={subject!r}")
            return True
        except Exception as e:
            logger.error(f"📧 send_email failed: to={to} err={e}")
            return False
