"""
feedback_routes.py — «Связаться с разработчиком» из настроек Фреди.

Сообщение пользователя сохраняется в fredi_feedback и уходит владельцу
двумя путями, в порядке убывания скорости:

  1. Telegram — бот из TELEGRAM_TOKEN, чат из FEEDBACK_TG_CHAT_ID.
     Работает только если чат задан: числовой id личного чата (владелец
     должен был хоть раз написать боту) или @имя канала, где бот админ.
  2. Почта — тот же SMTP, которым Фреди шлёт письма о сбросе пин-кода.
     Адрес берётся из FEEDBACK_EMAIL, по умолчанию OWNER_EMAIL_DEFAULT.
     Настраивать нечего: SMTP на проде уже поднят.

Почта отправляется, когда Telegram не настроен или не принял сообщение,
— то есть пустой FEEDBACK_TG_CHAT_ID больше не значит «обращение видно
только в базе». Если не вышло ни то ни другое, запись всё равно лежит в
fredi_feedback, и в ответе честно сказано, что доставки не было: терять
обращения нельзя, ради них форма и существует.

Свой chat_id владелец получает так: написать своему боту любое сообщение
и открыть https://api.telegram.org/bot<TOKEN>/getUpdates — id чата будет
в ответе; либо спросить у @userinfobot. Значение кладётся в переменную
окружения FEEDBACK_TG_CHAT_ID на Амвере.
"""

import logging
import os

import httpx

logger = logging.getLogger(__name__)

MAX_MESSAGE_LEN = 3000
MAX_CONTACT_LEN = 200
MAX_META_LEN = 300

OWNER_EMAIL_DEFAULT = "dron939@yandex.ru"


def _owner_chat_id() -> str:
    """Чат владельца: число (личный чат) или @имя (канал, где бот админ).

    Значение задаётся руками в панели Амверы, поэтому в него легко попадает
    не id, а ссылка — «https://web.telegram.org/k/#@meysternlp» или просто
    «meysternlp». Telegram на такое отвечает chat not found, и обращение
    молча уходит только в базу. Приводим к тому, что API понимает.
    """
    raw = (os.environ.get("FEEDBACK_TG_CHAT_ID")
           or os.environ.get("ADMIN_TG_CHAT_ID") or "").strip()
    if not raw:
        return ""
    if "t.me/" in raw or "telegram.org" in raw:
        raw = raw.rstrip("/").split("/")[-1]
        raw = raw.split("#")[-1]
    raw = raw.strip()
    if not raw:
        return ""
    # Числовой id (у групп он отрицательный) оставляем как есть, имя — с @.
    if raw.lstrip("-").isdigit() or raw.startswith("@"):
        return raw
    return "@" + raw.lstrip("@")


def _bot_token() -> str:
    return (os.environ.get("TELEGRAM_TOKEN")
            or os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()


async def _send_to_owner(text: str) -> bool:
    token, chat_id = _bot_token(), _owner_chat_id()
    if not token or not chat_id:
        logger.warning("feedback: TELEGRAM_TOKEN/FEEDBACK_TG_CHAT_ID не заданы — доставка только в базу")
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                # Без parse_mode: текст пользователя — не разметка, а данные;
                # Markdown ломался бы о подчёркивания и звёздочки в тексте.
                json={"chat_id": chat_id, "text": text,
                      "disable_web_page_preview": True},
            )
        if r.status_code == 200:
            return True
        logger.error(f"feedback TG send failed: {r.status_code} {r.text[:200]}")
        return False
    except Exception as e:
        logger.error(f"feedback TG send error: {e}")
        return False


def _owner_email() -> str:
    return (os.environ.get("FEEDBACK_EMAIL") or OWNER_EMAIL_DEFAULT).strip()


async def _send_email_to_owner(subject: str, text: str) -> bool:
    """Почтовый запасной путь. Берёт EmailService, поднятый в main."""
    to = _owner_email()
    if not to:
        return False
    try:
        import sys
        main_mod = sys.modules.get("main") or sys.modules.get("__main__")
        service = getattr(main_mod, "email_service", None)
        if service is None:
            from email_service import EmailService
            service = EmailService()
        if not getattr(service, "enabled", False):
            logger.warning("feedback: SMTP не настроен — письмо владельцу не ушло")
            return False
        return await service.send(to, subject, text)
    except Exception as e:
        logger.error(f"feedback email send error: {e}")
        return False


def register_feedback_routes(app, db, limiter):
    from fastapi import Request

    async def init_feedback_table():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_feedback (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT,
                    message TEXT NOT NULL,
                    contact TEXT,
                    page TEXT,
                    user_agent TEXT,
                    delivered_tg BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            # delivered_tg заведён до почтового пути и остаётся флагом
            # «дошло вообще»; каким каналом — пишем отдельно.
            await conn.execute(
                "ALTER TABLE fredi_feedback ADD COLUMN IF NOT EXISTS channel TEXT")
        logger.info("Feedback table ready")

    @app.post("/api/feedback")
    @limiter.limit("5/minute")
    async def submit_feedback(request: Request):
        try:
            data = await request.json()
        except Exception:
            return {"success": False, "error": "invalid JSON"}

        # Honeypot: поле не показывается людям, его заполняют только боты.
        if (data.get("website") or "").strip():
            return {"success": True, "delivered": True}

        message = (data.get("message") or "").strip()
        if len(message) < 5:
            return {"success": False, "error": "message too short"}
        message = message[:MAX_MESSAGE_LEN]

        contact = (data.get("contact") or "").strip()[:MAX_CONTACT_LEN]
        page = (data.get("page") or "").strip()[:MAX_META_LEN]
        ua = (data.get("ua") or request.headers.get("user-agent", "")).strip()[:MAX_META_LEN]
        try:
            user_id = int(data.get("user_id") or 0) or None
        except (TypeError, ValueError):
            user_id = None

        tg_text = (
            "🛟 Сообщение из Фреди\n\n"
            f"{message}\n\n"
            f"— uid: {user_id or 'аноним'}\n"
            f"— контакт: {contact or 'не оставлен'}\n"
            f"— страница: {page or '—'}\n"
            f"— браузер: {ua or '—'}"
        )
        delivered = await _send_to_owner(tg_text)
        channel = "telegram" if delivered else None
        if not delivered:
            subject = "Фреди: сообщение из формы связи"
            if await _send_email_to_owner(subject, tg_text):
                delivered, channel = True, "email"

        try:
            async with db.get_connection() as conn:
                await conn.execute(
                    """INSERT INTO fredi_feedback
                       (user_id, message, contact, page, user_agent,
                        delivered_tg, channel)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                    user_id, message, contact or None, page or None,
                    ua or None, delivered, channel)
        except Exception as e:
            # База легла, но в Telegram ушло — обращение не потеряно.
            logger.error(f"feedback DB insert failed: {e}")
            if not delivered:
                return {"success": False, "error": "storage unavailable"}

        return {"success": True, "delivered": delivered, "channel": channel}

    return init_feedback_table
