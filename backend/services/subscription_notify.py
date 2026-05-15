"""
subscription_notify.py — Оповещение пользователя об активации подписки.

Дублируется по всем доступным каналам:
  • email (если у юзера есть email в fredi_users)
  • Telegram / MAX (если есть привязка в fredi_messenger_links)

Web push осознанно не подключаем здесь: web push шлёт PushService,
но активация подписки часто происходит в контексте webhook/poller, где
у юзера нет «свежей сессии» в браузере — лучше дойти до него по email
или мессенджеру.

Каждый канал try/except — падение одного НЕ ломает активацию подписки.
"""
import asyncio
import logging
import os
from datetime import datetime
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


def _format_date(dt: datetime) -> str:
    months = [
        "января", "февраля", "марта", "апреля", "мая", "июня",
        "июля", "августа", "сентября", "октября", "ноября", "декабря",
    ]
    return f"{dt.day} {months[dt.month - 1]} {dt.year}"


def _app_link() -> str:
    return (os.environ.get("FREDI_APP_URL") or "https://meysternlp.ru/fredi/").rstrip("/")


def _build_email(name_or_empty: str, expires_at: datetime, is_renewal: bool) -> tuple[str, str, str]:
    """Returns (subject, plain_body, html_body)."""
    title = "Подписка продлена" if is_renewal else "Подписка активирована"
    greet = f"Привет{', ' + name_or_empty if name_or_empty else ''}!"
    date_str = _format_date(expires_at)
    link = _app_link()
    plain = (
        f"{greet}\n\n"
        f"{title}. Фреди Premium открыт до {date_str}.\n"
        f"Полный доступ ко всем возможностям: безлимитные сессии, "
        f"AI-дневник, гипноз, зеркала, транзактный анализ.\n\n"
        f"Открыть Фреди: {link}\n\n"
        f"— Команда Фреди"
    )
    html = (
        f"<div style=\"font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;"
        f"max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;\">"
        f"<div style=\"font-size:13px;color:#888;letter-spacing:1.2px;"
        f"text-transform:uppercase;margin-bottom:8px;\">⭐ PREMIUM</div>"
        f"<h1 style=\"font-size:22px;margin:0 0 12px;color:#111;\">{title}</h1>"
        f"<p style=\"font-size:15px;line-height:1.55;color:#333;margin:0 0 16px;\">"
        f"{greet} Фреди Premium открыт до <b>{date_str}</b>.</p>"
        f"<p style=\"font-size:14px;line-height:1.55;color:#555;margin:0 0 24px;\">"
        f"Полный доступ ко всем возможностям: безлимитные сессии с Фреди, "
        f"AI-дневник, гипнотические практики, зеркала отношений, "
        f"транзактный анализ по Берну.</p>"
        f"<a href=\"{link}\" style=\"display:inline-block;padding:12px 24px;"
        f"background:linear-gradient(135deg,#3b82ff,#6366f1);color:#fff;"
        f"text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;\">"
        f"Открыть Фреди →</a>"
        f"<div style=\"margin-top:32px;font-size:11px;color:#aaa;\">"
        f"Это автоматическое письмо. Если вы не оформляли подписку — "
        f"напишите в поддержку.</div>"
        f"</div>"
    )
    return title, plain, html


def _build_messenger_text(expires_at: datetime, is_renewal: bool) -> str:
    verb = "продлена" if is_renewal else "активирована"
    date_str = _format_date(expires_at)
    return (
        f"✨ Подписка Фреди Premium {verb} до {date_str}.\n\n"
        f"Тебе открыт полный доступ: безлимитные сессии, AI-дневник, "
        f"гипноз, зеркала отношений.\n\n"
        f"Открыть → {_app_link()}"
    )


async def _send_telegram(chat_id: str, text: str) -> bool:
    token = (os.environ.get("TELEGRAM_TOKEN") or "").strip()
    if not token or not chat_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text},
            )
        return r.status_code == 200
    except Exception as e:
        logger.warning(f"notify TG send failed: {e}")
        return False


async def _send_max(chat_id: str, text: str) -> bool:
    token = (os.environ.get("MAX_TOKEN") or "").strip()
    if not token or not chat_id:
        return False
    # MAX chat_id может быть '<число>@<имя>' — берём только число.
    raw = str(chat_id).strip()
    numeric = raw.split("@", 1)[0].strip() if "@" in raw else raw
    try:
        cid_int = int(numeric)
    except ValueError:
        logger.warning(f"notify MAX bad chat_id: {chat_id!r}")
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://platform-api.max.ru/messages",
                params={"chat_id": cid_int, "access_token": token},
                json={"text": text},
                headers={"Authorization": token, "Content-Type": "application/json"},
            )
        return r.status_code == 200
    except Exception as e:
        logger.warning(f"notify MAX send failed: {e}")
        return False


async def _send_email(db, user_id: int, expires_at: datetime, is_renewal: bool) -> bool:
    """Достаёт email из fredi_users и шлёт через EmailService (если поднят)."""
    email = None
    first_name = ""
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT email, first_name FROM fredi_users WHERE user_id = $1",
                user_id,
            )
        if row:
            email = (row.get("email") or "").strip() or None
            first_name = (row.get("first_name") or "").strip()
    except Exception as e:
        logger.warning(f"notify email lookup failed: {e}")
        return False

    if not email:
        return False

    try:
        # Не создаём свой EmailService — берём тот, что уже инициализирован
        # в main.py с правильной env-конфигурацией.
        try:
            import main as _main  # type: ignore
            email_service = getattr(_main, "email_service", None)
        except Exception:
            email_service = None
        if email_service is None:
            # Fallback: создаём временный, чтобы не молчать.
            from email_service import EmailService
            email_service = EmailService()

        subject, plain, html = _build_email(first_name, expires_at, is_renewal)
        ok = await email_service.send(email, subject, plain, html=html)
        return bool(ok)
    except Exception as e:
        logger.warning(f"notify email send failed for {user_id}: {e}")
        return False


async def _send_messengers(db, user_id: int, text: str) -> dict:
    """Шлёт во ВСЕ активные привязки мессенджеров пользователя.
    Возвращает {'telegram': bool, 'max': bool}."""
    result = {"telegram": False, "max": False}
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch(
                "SELECT platform, chat_id FROM fredi_messenger_links "
                "WHERE user_id = $1 AND is_active = TRUE",
                user_id,
            )
    except Exception as e:
        logger.warning(f"notify messenger lookup failed: {e}")
        return result

    for r in rows:
        platform = (r["platform"] or "").strip().lower()
        chat_id = r["chat_id"]
        if platform == "telegram" and not result["telegram"]:
            result["telegram"] = await _send_telegram(str(chat_id), text)
        elif platform == "max" and not result["max"]:
            result["max"] = await _send_max(str(chat_id), text)
    return result


async def notify_subscription_activated(
    db,
    user_id: int,
    expires_at: datetime,
    is_renewal: bool = False,
) -> dict:
    """Главная функция: дублирует уведомление по всем доступным каналам.

    Не падает наружу — любая ошибка ловится и логируется, чтобы НЕ
    блокировать активацию подписки. Возвращает словарь с результатом
    каждого канала (для логов/админки).
    """
    msg_text = _build_messenger_text(expires_at, is_renewal)

    # Все каналы параллельно — никакой канал не ждёт другого.
    email_task = asyncio.create_task(_send_email(db, user_id, expires_at, is_renewal))
    msg_task = asyncio.create_task(_send_messengers(db, user_id, msg_text))

    try:
        email_ok, msg_result = await asyncio.gather(email_task, msg_task, return_exceptions=True)
    except Exception as e:
        logger.error(f"notify_subscription_activated gather failed: {e}")
        return {"email": False, "telegram": False, "max": False, "error": str(e)}

    if isinstance(email_ok, Exception):
        logger.warning(f"notify email exc: {email_ok}")
        email_ok = False
    if isinstance(msg_result, Exception):
        logger.warning(f"notify messenger exc: {msg_result}")
        msg_result = {"telegram": False, "max": False}

    out = {
        "email": bool(email_ok),
        "telegram": bool(msg_result.get("telegram")),
        "max": bool(msg_result.get("max")),
    }
    logger.info(f"Subscription activation notify user={user_id}: {out}")
    return out
