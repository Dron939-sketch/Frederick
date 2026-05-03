"""
skill_notify.py — Доставка сообщений 21-дневного плана в выбранный канал.

Использует существующую инфраструктуру:
- fredi_skill_plans   — какой канал и время выбрал пользователь
- fredi_messenger_links — куда (chat_id) слать (заполняется через Настройки)
- bot_service._tg_send / _max_send — фактическая отправка

Содержит планировщик (Этап C), который запускается из main.py фоновой задачей.
"""

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx


def _strip_markdown(text: str) -> str:
    """Убирает *bold* и _italic_ для каналов без поддержки разметки (MAX, email)."""
    if not text:
        return text
    # *жирный* → жирный
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    # _курсив_ → курсив (внутри слова не трогаем)
    text = re.sub(r'(?<!\w)_([^_]+)_(?!\w)', r'\1', text)
    return text

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None  # Python < 3.9 — fallback на UTC

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
    """Шлёт через Max Platform API.

    Пробует chat_id, при 404 dialog.not.found — fallback на user_id
    (в БД иногда лежит user_id вместо chat_id из-за фоллбэка в bot_service).
    """
    if not MAX_TOKEN:
        logger.warning("MAX_TOKEN not set")
        return False
    body = {"text": text, "attachments": [], "format": "markdown", "notify": True}
    headers = {"Authorization": MAX_TOKEN, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            # 1) Сначала пробуем chat_id (нормальный путь).
            resp = await client.post(
                "https://platform-api.max.ru/messages",
                params={"chat_id": chat_id},
                json=body, headers=headers
            )
            if resp.status_code in (200, 201):
                return True
            # 2) Fallback на user_id — на случай, если в БД user_id (баг bot_service).
            if resp.status_code == 404 and "dialog.not.found" in resp.text:
                logger.warning(
                    f"MAX chat_id={chat_id} not found, retrying with user_id"
                )
                resp = await client.post(
                    "https://platform-api.max.ru/messages",
                    params={"user_id": chat_id},
                    json=body, headers=headers
                )
                if resp.status_code in (200, 201):
                    return True
            logger.error(f"MAX send failed: {resp.status_code} {resp.text[:200]}")
            return False
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
        try:
            from email_service import EmailService
            row = await db.fetchrow(
                "SELECT email FROM fredi_skill_plans WHERE user_id = $1", user_id
            )
            email = row["email"] if row else None
            if not email:
                row = await db.fetchrow(
                    "SELECT email FROM fredi_users WHERE user_id = $1", user_id
                )
                email = row["email"] if row else None
            if not email:
                return {"success": False, "error": "email not set"}
            es = EmailService()
            if not es.enabled:
                return {"success": False, "error": "email service disabled (no SMTP env)"}
            ok = await es.send(
                to=email,
                subject="Задание дня — Фреди",
                body=_strip_markdown(text)
            )
            return {"success": ok, "sent_via": "email"} if ok else {"success": False, "error": "smtp failed"}
        except Exception as e:
            logger.error(f"Email send error: {e}")
            return {"success": False, "error": str(e)}

    if channel == "web":
        # Web push — через PushService. В проде используется send_to_user(uid, title, body, url).
        try:
            from services.push_service import PushService
            ps = PushService(db)
            short = _strip_markdown(text)[:120]  # для push — только короткий заголовок
            ok = await ps.send_to_user(user_id, "Фреди — задание дня", short, "/")
            return {"success": bool(ok), "sent_via": "web"} if ok else {"success": False, "error": "push not delivered"}
        except Exception as e:
            logger.error(f"Web push error: {e}")
            return {"success": False, "error": str(e)}

    return {"success": False, "error": f"unknown channel: {channel}"}


def build_day_message(skill_name: str, day: int, exercise: dict) -> str:
    """Утреннее сообщение — задание дня."""
    task = exercise.get("task", "")
    dur = exercise.get("dur", "")
    inst = exercise.get("inst", "")
    return (
        f"🎯 *День {day} из 21 — {skill_name}*\n\n"
        f"*{task}* (⏱ {dur})\n\n"
        f"{inst}\n\n"
        f"Откройте Фреди и отметьте выполнение, когда сделаете."
    )


def build_check_message(skill_name: str, day: int, exercise: dict) -> str:
    """Дневной чек-ин — поддержка в середине дня (только active mode)."""
    task = exercise.get("task", "")
    return (
        f"🌤 *Как идёт?* — день {day} из 21 ({skill_name})\n\n"
        f"Получилось начать «{task}»?\n"
        f"Если ещё нет — короткое окно сейчас: 5 минут хватит, "
        f"чтобы сделать первый шаг."
    )


def build_evening_message(skill_name: str, day: int) -> str:
    """Вечерняя рефлексия (только active mode)."""
    return (
        f"🌙 *Вечерняя рефлексия* — день {day} из 21 ({skill_name})\n\n"
        f"Что получилось сегодня по навыку? Что было неудобно?\n"
        f"Запишите 1–2 предложения в дневник Фреди — это закрепляет результат."
    )


def _user_tz(tz_str: Optional[str]):
    """Возвращает tz-объект по IANA-имени или UTC при ошибке."""
    if not tz_str or tz_str == "UTC" or ZoneInfo is None:
        return timezone.utc
    try:
        return ZoneInfo(tz_str)
    except Exception:
        return timezone.utc


def _current_day(started_at, tz) -> int:
    """Сколько дней прошло от старта в локальной зоне юзера. 1..21."""
    now_local = datetime.now(timezone.utc).astimezone(tz)
    started_local = started_at.astimezone(tz) if started_at else now_local
    days = (now_local.date() - started_local.date()).days + 1
    return max(1, min(21, days))


def _find_exercise(plan_data, day: int):
    if not plan_data or not plan_data.get("weeks"):
        return None
    for week in plan_data["weeks"]:
        for ex in week.get("exercises", []):
            if ex.get("day") == day:
                return ex
    return None


async def send_day_message(db, user_id: int) -> dict:
    """Шлёт утреннее задание дня (используется test-send и планировщиком)."""
    plan = await db.fetchrow(
        "SELECT * FROM fredi_skill_plans WHERE user_id = $1", user_id
    )
    if not plan:
        return {"success": False, "error": "plan not found"}
    if not plan["channel"] or plan["channel"] == "none":
        return {"success": False, "error": "no channel"}
    if not plan["started_at"]:
        return {"success": False, "error": "no start date"}

    tz = _user_tz(plan.get("tz") if hasattr(plan, "get") else None)
    day = _current_day(plan["started_at"], tz)

    plan_data = plan["plan"]
    if isinstance(plan_data, str):
        plan_data = json.loads(plan_data)
    exercise = _find_exercise(plan_data, day)
    if not exercise:
        return {"success": False, "error": f"day {day} not found in plan"}

    text = build_day_message(plan["skill_name"], day, exercise)
    return await send_to_channel(db, user_id, plan["channel"], text)


async def send_welcome_message(db, user_id: int) -> dict:
    """Шлёт поздравление со стартом 21-дневной программы.
    Вызывается из фронта после нажатия «Поехали!».
    """
    plan = await db.fetchrow(
        "SELECT * FROM fredi_skill_plans WHERE user_id = $1", user_id
    )
    if not plan:
        return {"success": False, "error": "plan not found"}
    if not plan["channel"] or plan["channel"] == "none":
        return {"success": False, "error": "no channel"}

    skill_name = plan["skill_name"] or "ваш навык"
    notify_time = plan["notify_time"] or "09:00"
    tz_str = plan["tz"] if "tz" in plan.keys() else "UTC"

    # Достаём задание дня 1 чтобы упомянуть в приветствии
    plan_data = plan["plan"]
    if isinstance(plan_data, str):
        plan_data = json.loads(plan_data)
    day1 = _find_exercise(plan_data, 1) or {}
    day1_task = day1.get("task", "первое задание")
    day1_dur = day1.get("dur", "5 мин")

    text = (
        f"🎉 *Поехали!* — 21 день навыка «{skill_name}»\n\n"
        f"Сегодня — день 1: *{day1_task}* (⏱ {day1_dur}).\n"
        f"Уже на экране Фреди — открой и сделай.\n\n"
        f"📨 Завтра в *{notify_time} ({tz_str})* пришлю задание дня 2 сюда."
    )
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


# ============================================================
# ПЛАНИРОВЩИК (Этап C/D)
# Каждую минуту:
#   - проходит активные планы
#   - для каждого считает локальное время юзера по его tz
#   - для mode='calm': шлёт утро в notify_time
#   - для mode='active': утро + чек-ин в +5h + рефлексия в +12h
#   - дедуп через 3 timestamp-колонки
# ============================================================
def _add_hours(notify_time: str, hours: int) -> str:
    """'09:00' + 5 → '14:00'. Wrap при 24+."""
    try:
        h, m = map(int, notify_time.split(":"))
    except Exception:
        h, m = 9, 0
    h = (h + hours) % 24
    return f"{h:02d}:{m:02d}"


async def _send_touchpoint(db, plan_row, kind: str) -> dict:
    """kind: 'morning' | 'check' | 'eve'."""
    user_id = plan_row["user_id"]
    skill_name = plan_row["skill_name"] or "навык"
    tz = _user_tz(plan_row.get("tz") if hasattr(plan_row, "get") else plan_row["tz"])
    day = _current_day(plan_row["started_at"], tz)

    plan_data = plan_row["plan"]
    if isinstance(plan_data, str):
        plan_data = json.loads(plan_data)
    exercise = _find_exercise(plan_data, day) or {}

    if kind == "morning":
        text = build_day_message(skill_name, day, exercise)
    elif kind == "check":
        text = build_check_message(skill_name, day, exercise)
    elif kind == "eve":
        text = build_evening_message(skill_name, day)
    else:
        return {"success": False, "error": f"unknown kind: {kind}"}

    return await send_to_channel(db, user_id, plan_row["channel"], text)


async def skill_plan_scheduler(db):
    """Фоновая корутина — запускается из main.py через asyncio.create_task."""
    logger.info("📅 skill_plan_scheduler started (tz-aware, 3 touchpoints, 1-minute tick)")
    await asyncio.sleep(60)
    while True:
        try:
            # Берём ВСЕ активные планы (фильтр: канал есть, план в окне 21 дня).
            # Фильтрацию по времени делаем в Python — нужны разные tz.
            rows = await db.fetch(
                """
                SELECT user_id, skill_name, channel, mode, notify_time, tz,
                       plan, started_at,
                       last_sent_at, last_check_sent_at, last_eve_sent_at
                FROM fredi_skill_plans
                WHERE channel IS NOT NULL
                  AND channel <> 'none'
                  AND started_at IS NOT NULL
                  AND (NOW() - started_at) < INTERVAL '21 days'
                """
            )

            if not rows:
                await asyncio.sleep(60)
                continue

            now_utc = datetime.now(timezone.utc)

            for row in rows:
                uid = row["user_id"]
                tz = _user_tz(row["tz"])
                user_now = now_utc.astimezone(tz)
                cur_hhmm = user_now.strftime("%H:%M")

                # Начало текущих суток в локальной зоне → в UTC (для дедупа).
                today_start_local = user_now.replace(hour=0, minute=0, second=0, microsecond=0)
                today_start_utc = today_start_local.astimezone(timezone.utc)

                notify_time = row["notify_time"] or "09:00"
                mode = row["mode"] or "calm"

                # Расписание точек касания
                schedule = [("morning", notify_time, "last_sent_at")]
                if mode == "active":
                    schedule.append(("check", _add_hours(notify_time, 5),  "last_check_sent_at"))
                    schedule.append(("eve",   _add_hours(notify_time, 12), "last_eve_sent_at"))

                for kind, target_hhmm, last_col in schedule:
                    if cur_hhmm != target_hhmm:
                        continue
                    last_sent = row[last_col]
                    if last_sent is not None and last_sent >= today_start_utc:
                        continue  # уже отправлено сегодня
                    try:
                        res = await _send_touchpoint(db, row, kind)
                        if res.get("success"):
                            await db.execute(
                                f"UPDATE fredi_skill_plans SET {last_col} = NOW() "
                                f"WHERE user_id = $1", uid
                            )
                            logger.info(
                                f"📨 [{kind}] sent to {uid} ({row['skill_name']}) "
                                f"via {res.get('sent_via')} at {cur_hhmm} {row['tz'] or 'UTC'}"
                            )
                        else:
                            logger.warning(
                                f"skill scheduler: [{kind}] to {uid} failed: {res.get('error')}"
                            )
                    except Exception as e:
                        logger.error(f"skill scheduler [{kind}] to {uid} error: {e}")

        except asyncio.CancelledError:
            logger.info("skill_plan_scheduler cancelled")
            break
        except Exception as e:
            logger.error(f"skill scheduler loop error: {e}")

        await asyncio.sleep(60)
