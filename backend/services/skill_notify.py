"""
skill_notify.py — Доставка сообщений 21-дневного плана в выбранный канал.

Использует существующую инфраструктуру:
- fredi_skill_plans   — какой канал и время выбрал пользователь
- fredi_messenger_links — куда (chat_id) слать (заполняется через Настройки)
- bot_service._tg_send / _max_send — фактическая отправка

Импортируется планировщиком (Этап C) и эндпоинтом test-send.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "").strip()
MAX_TOKEN = os.environ.get("MAX_TOKEN", "").strip()


async def get_link_status(db, user_id: int) -> dict:
    """Возвращает {telegram: bool, max: bool, ...} — что привязано."""
    rows = await db.fetch(
        "SELECT platform, is_active FROM fredi_messenger_links WHERE user_id = $1",
        user_id
    )
    out = {"telegram": False, "max": False}
    for r in rows:
        if r["is_active"]:
            out[r["platform"]] = True
    return out


async def get_chat_id(db, user_id: int, platform: str) -> Optional[str]:
    """Ищет chat_id для пользователя на указанной платформе."""
    row = await db.fetchrow(
        "SELECT chat_id FROM fredi_messenger_links "
        "WHERE user_id = $1 AND platform = $2 AND is_active = TRUE",
        user_id, platform
    )
    return row["chat_id"] if row else None


async def send_telegram(chat_id: str, text: str) -> bool:
    if not TELEGRAM_TOKEN:
        logger.warning("TELEGRAM_TOKEN not set")
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return False


async def send_max(chat_id: str, text: str) -> bool:
    if not MAX_TOKEN:
        logger.warning("MAX_TOKEN not set")
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://platform-api.max.ru/messages?chat_id={chat_id}",
                json={"text": text},
                headers={"Authorization": MAX_TOKEN, "Content-Type": "application/json"}
            )
            return resp.status_code in (200, 201)
    except Exception as e:
        logger.error(f"MAX send error: {e}")
        return False


async def send_to_channel(db, user_id: int, channel: str, text: str) -> dict:
    """Шлёт текст пользователю по указанному каналу.
    Возвращает {success: bool, error?: str, sent_via?: str}.
    """
    if channel == "none":
        return {"success": False, "error": "channel disabled"}

    if channel in ("telegram", "max"):
        chat_id = await get_chat_id(db, user_id, channel)
        if not chat_id:
            return {"success": False, "error": f"{channel} not linked"}
        ok = (await send_telegram(chat_id, text)) if channel == "telegram" else (await send_max(chat_id, text))
        return {"success": ok, "sent_via": channel} if ok else {"success": False, "error": f"{channel} send failed"}

    if channel == "email":
        # Используем существующий EmailService, если он есть.
        try:
            from email_service import EmailService
            row = await db.fetchrow(
                "SELECT email FROM fredi_skill_plans WHERE user_id = $1", user_id
            )
            email = row["email"] if row else None
            if not email:
                # Fallback на email из fredi_users, если есть.
                row = await db.fetchrow(
                    "SELECT email FROM fredi_users WHERE user_id = $1", user_id
                )
                email = row["email"] if row else None
            if not email:
                return {"success": False, "error": "email not set"}
            es = EmailService()
            await es.send(to=email, subject="Задание дня — Фреди", body=text)
            return {"success": True, "sent_via": "email"}
        except Exception as e:
            logger.error(f"Email send error: {e}")
            return {"success": False, "error": str(e)}

    if channel == "web":
        # Web push — через PushService (services/push_service.py).
        try:
            from services.push_service import PushService
            ps = PushService(db)
            ok = await ps.send_to_user(user_id, title="Фреди", body=text)
            return {"success": bool(ok), "sent_via": "web"}
        except Exception as e:
            logger.error(f"Web push error: {e}")
            return {"success": False, "error": str(e)}

    return {"success": False, "error": f"unknown channel: {channel}"}


def build_day_message(skill_name: str, day: int, exercise: dict) -> str:
    """Собирает текст сообщения для дня тренировки."""
    task = exercise.get("task", "")
    dur = exercise.get("dur", "")
    inst = exercise.get("inst", "")
    return (
        f"🎯 *День {day} из 21 — {skill_name}*\n\n"
        f"*{task}* (⏱ {dur})\n\n"
        f"{inst}\n\n"
        f"Откройте Фреди и отметьте выполнение, когда сделаете."
    )


async def send_day_message(db, user_id: int) -> dict:
    """Шлёт сегодняшнее задание пользователю в выбранный канал."""
    plan = await db.fetchrow(
        "SELECT * FROM fredi_skill_plans WHERE user_id = $1", user_id
    )
    if not plan:
        return {"success": False, "error": "plan not found"}
    if not plan["channel"] or plan["channel"] == "none":
        return {"success": False, "error": "no channel"}

    # Текущий день
    started = plan["started_at"]
    if not started:
        return {"success": False, "error": "no start date"}
    days_since = (datetime.now(timezone.utc) - started).days + 1
    day = max(1, min(21, days_since))

    plan_data = plan["plan"]
    if isinstance(plan_data, str):
        plan_data = json.loads(plan_data)
    if not plan_data or not plan_data.get("weeks"):
        return {"success": False, "error": "plan invalid"}

    # Ищем упражнение для текущего дня
    exercise = None
    for week in plan_data["weeks"]:
        for ex in week.get("exercises", []):
            if ex.get("day") == day:
                exercise = ex
                break
        if exercise:
            break

    if not exercise:
        return {"success": False, "error": f"day {day} not found in plan"}

    text = build_day_message(plan["skill_name"], day, exercise)
    return await send_to_channel(db, user_id, plan["channel"], text)


async def send_test_message(db, user_id: int) -> dict:
    """Шлёт тестовое сообщение в выбранный канал — для проверки привязки."""
    plan = await db.fetchrow(
        "SELECT skill_name, channel FROM fredi_skill_plans WHERE user_id = $1", user_id
    )
    if not plan:
        return {"success": False, "error": "plan not found"}
    if not plan["channel"] or plan["channel"] == "none":
        return {"success": False, "error": "no channel selected"}

    name = plan["skill_name"] or "ваш навык"
    text = (
        f"✅ *Тестовое сообщение*\n\n"
        f"Канал работает. Сюда будут приходить ежедневные задания "
        f"по навыку «{name}» — каждое утро в выбранное вами время."
    )
    return await send_to_channel(db, user_id, plan["channel"], text)
