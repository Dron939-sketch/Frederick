"""
skill_notify.py — Доставка сообщений 21-дневного плана в выбранный канал.

Использует существующую инфраструктуру:
- fredi_skill_plans   — какой канал и время выбрал пользователь
- fredi_messenger_links — куда (chat_id) слать (заполняется через Настройки)
- bot_service._tg_send / _max_send — фактическая отправка

Содержит планировщик (Этап C), который запускается из main.py фоновой задачей.
"""

import asyncio
import hashlib
import hmac
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
    ZoneInfo = None


# ============================================================
# АВТО-ЛОГИН ИЗ МЕССЕНДЖЕРА (HMAC-подписанный URL)
# Бот шлёт inline-кнопку «Открыть Фреди» с URL ?fid=<uid>&t=<hmac>.
# Юзер тыкает → фронт верифицирует через /api/auth/messenger-token
# → ставит USER_ID = fid → не просит регистрироваться повторно.
# ============================================================
def _auth_secret() -> str:
    """Секрет для HMAC. MESSENGER_AUTH_SECRET → fallback TELEGRAM_TOKEN."""
    s = os.environ.get("MESSENGER_AUTH_SECRET", "").strip()
    if s:
        return s
    return TELEGRAM_TOKEN or "fredi-default-secret-change-me"


def make_messenger_token(user_id: int) -> str:
    """16-символьный HMAC от user_id."""
    msg = str(int(user_id)).encode()
    key = _auth_secret().encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()[:16]


def verify_messenger_token(user_id: int, token: str) -> bool:
    """Проверка с защитой от timing-атак."""
    if not token or not user_id:
        return False
    try:
        expected = make_messenger_token(int(user_id))
        return hmac.compare_digest(expected, str(token))
    except Exception:
        return False


def _build_app_url(user_id: int) -> str:
    """URL приложения с подписанными fid+t. Тык → автологин."""
    base = (os.environ.get("WEB_URL") or "https://fredi-frontend.onrender.com").rstrip("/")
    token = make_messenger_token(user_id)
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}fid={user_id}&t={token}"

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


async def send_telegram(chat_id: str, text: str, app_url: Optional[str] = None) -> bool:
    if not TELEGRAM_TOKEN:
        logger.warning("TELEGRAM_TOKEN not set")
        return False
    try:
        body = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
        if app_url:
            body["reply_markup"] = {
                "inline_keyboard": [[{"text": "🚀 Открыть Фреди", "url": app_url}]]
            }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json=body
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return False


async def send_max(chat_id: str, text: str, app_url: Optional[str] = None) -> bool:
    """Шлёт через Max Platform API.

    Пробует chat_id, при 404 dialog.not.found — fallback на user_id
    (в БД иногда лежит user_id вместо chat_id из-за фоллбэка в bot_service).
    """
    if not MAX_TOKEN:
        logger.warning("MAX_TOKEN not set")
        return False
    attachments = []
    if app_url:
        # MAX inline_keyboard поддерживает type=link (TamTam-style API).
        attachments.append({
            "type": "inline_keyboard",
            "payload": {
                "buttons": [[{"type": "link", "text": "🚀 Открыть Фреди", "url": app_url}]]
            }
        })
    body = {"text": text, "attachments": attachments, "format": "markdown", "notify": True}
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
        # Inline-кнопка «Открыть Фреди» с подписанным URL — авто-логин на сайте.
        app_url = _build_app_url(user_id)
        if channel == "telegram":
            ok = await send_telegram(chat_id, text, app_url)
        else:
            ok = await send_max(chat_id, text, app_url)
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


# ============================================================
# ИМЯ + ПРИВЕТСТВИЕ ПО ВРЕМЕНИ СУТОК
# ============================================================
async def _get_user_name(db, user_id: int) -> str:
    """Имя из fredi_users.name (профиль). Пусто если нет."""
    try:
        row = await db.fetchrow(
            "SELECT name FROM fredi_users WHERE user_id = $1", user_id
        )
        if row and row["name"]:
            n = str(row["name"]).strip()
            if n and n.lower() not in ("друг", "подруга"):
                return n
    except Exception:
        pass
    return ""


def _greeting(hour: int, name: str = "") -> str:
    """Приветствие по локальному часу. С эмодзи и именем (если есть)."""
    if 5 <= hour < 12:
        base = "🌅 Доброе утро"
    elif 12 <= hour < 18:
        base = "🌤 Добрый день"
    elif 18 <= hour < 23:
        base = "🌙 Добрый вечер"
    else:
        base = "🌃 Доброй ночи"
    return f"{base}, {name}!" if name else f"{base}!"


def _user_now(plan_row) -> datetime:
    tz_str = plan_row["tz"] if "tz" in plan_row.keys() else "UTC"
    return datetime.now(timezone.utc).astimezone(_user_tz(tz_str))


# ============================================================
# ШАБЛОНЫ СООБЩЕНИЙ
# ============================================================
def build_day_message(skill_name: str, day: int, exercise: dict, name: str, hour: int) -> str:
    """Утреннее сообщение — задание дня."""
    task = exercise.get("task", "")
    dur = exercise.get("dur", "")
    inst = exercise.get("inst", "")
    why = exercise.get("why", "")

    parts = [
        _greeting(hour, name),
        "",
        f"━━━ *ДЕНЬ {day} · 21* ━━━",
        skill_name,
        "",
        f"📌 *{task}* · ⏱ {dur}",
        "",
        inst,
    ]
    if why:
        parts += [
            "",
            "💭 *Зачем это*",
            why,
        ]
    parts += [
        "",
        "—",
        "✅ *Как отметить выполнение*",
        "Открой Фреди → раздел *💬 Сообщения* → нажми кнопку *«✅ Выполнил»* "
        "под этим заданием.",
    ]
    return "\n".join(parts)


def build_check_message(skill_name: str, day: int, exercise: dict, name: str, hour: int) -> str:
    """Дневной чек-ин (active mode) — короткое подбадривание."""
    task = exercise.get("task", "")
    parts = [
        _greeting(hour, name),
        "",
        f"Получилось начать «{task}»? Это день {day} из 21.",
        "",
        "Если ещё нет — 5 минут хватит, чтобы сделать первый шаг.",
    ]
    return "\n".join(parts)


def build_evening_message(skill_name: str, day: int, name: str, hour: int) -> str:
    """Вечерняя рефлексия (active mode)."""
    parts = [
        _greeting(hour, name),
        "",
        f"Что получилось сегодня по навыку «{skill_name}»? Что было неудобно?",
        "",
        "Можешь записать 1–2 предложения в дневник Фреди — это закрепляет результат. Или просто подумать.",
    ]
    return "\n".join(parts)


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

    tz_str = plan["tz"] if "tz" in plan.keys() else "UTC"
    tz = _user_tz(tz_str)
    day = _current_day(plan["started_at"], tz)

    plan_data = plan["plan"]
    if isinstance(plan_data, str):
        plan_data = json.loads(plan_data)
    exercise = _find_exercise(plan_data, day)
    if not exercise:
        return {"success": False, "error": f"day {day} not found in plan"}

    name = await _get_user_name(db, user_id)
    user_now = datetime.now(timezone.utc).astimezone(tz)

    text = build_day_message(plan["skill_name"], day, exercise, name, user_now.hour)
    return await send_to_channel(db, user_id, plan["channel"], text)


async def send_welcome_message(db, user_id: int) -> dict:
    """Шлёт поздравление со стартом + полное задание дня 1.
    Вызывается из фронта после нажатия «Поехали!».
    Это единственное место, где упоминается «завтра пришлю» — в ежедневных
    сообщениях этого уже нет (шум).
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

    plan_data = plan["plan"]
    if isinstance(plan_data, str):
        plan_data = json.loads(plan_data)
    day1 = _find_exercise(plan_data, 1) or {}
    day1_task = day1.get("task", "первое задание")
    day1_dur = day1.get("dur", "5 мин")
    day1_inst = day1.get("inst", "")
    day1_why = day1.get("why", "")

    name = await _get_user_name(db, user_id)
    name_part = f", {name}" if name else ""

    parts = [
        f"🚀 *Поехали{name_part}!*",
        "",
        f"21 день навыка «{skill_name}»",
        "",
        "━━━ *ДЕНЬ 1 · 21* ━━━",
        f"📌 *{day1_task}* · ⏱ {day1_dur}",
        "",
        day1_inst,
    ]
    if day1_why:
        parts += [
            "",
            "💭 *Зачем это*",
            day1_why,
        ]
    parts += [
        "",
        f"⏰ Завтра в *{notify_time} ({tz_str})* пришлю день 2 сюда.",
        "",
        "✅ *Как отметить выполнение*",
        "Открой Фреди → раздел *💬 Сообщения* → нажми *«✅ Выполнил»* "
        "под этим заданием.",
    ]
    text = "\n".join(parts)
    result = await send_to_channel(db, user_id, plan["channel"], text)

    # Дублируем день 1 в уведомления — чтобы у юзера сразу была кнопка «✅ Выполнил».
    # И ставим last_sent_at = NOW(), чтобы планировщик сегодня не отправил день 1 ещё раз
    # (если время старта совпало с notify_time).
    if result.get("success"):
        await _push_skill_notification(db, user_id, skill_name, 1, day1)
        try:
            await db.execute(
                "UPDATE fredi_skill_plans SET last_sent_at = NOW() WHERE user_id = $1",
                int(user_id)
            )
        except Exception as e:
            logger.warning(f"welcome: failed to stamp last_sent_at for {user_id}: {e}")

    return result


async def send_test_message(db, user_id: int) -> dict:
    """Шлёт тестовое сообщение в выбранный канал — для проверки привязки."""
    plan = await db.fetchrow(
        "SELECT skill_name, channel FROM fredi_skill_plans WHERE user_id = $1", user_id
    )
    if not plan:
        return {"success": False, "error": "plan not found"}
    if not plan["channel"] or plan["channel"] == "none":
        return {"success": False, "error": "no channel selected"}

    skill = plan["skill_name"] or "ваш навык"
    user_name = await _get_user_name(db, user_id)
    name_part = f", {user_name}" if user_name else ""

    text = (
        f"✅ *Канал работает{name_part}!*\n\n"
        f"Это тестовое сообщение. Сюда будут приходить ежедневные задания "
        f"по навыку «{skill}» — короткие, на 5–15 минут."
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


async def _push_skill_notification(db, user_id: int, skill_name: str, day: int, exercise: dict):
    """Дублирует утреннее задание в fredi_notifications (вкладка «Сообщения → Уведомления»).

    Это даёт юзеру второе место где видно задачу + кнопку «✅ Выполнил» прямо там.
    Никогда не бросает — если упадёт, основная отправка не страдает.
    """
    try:
        task = exercise.get("task", "")
        dur = exercise.get("dur", "")
        title = f"📌 День {day} · {task}"
        body_parts = []
        if dur:
            body_parts.append(f"⏱ {dur}")
        if exercise.get("inst"):
            body_parts.append(exercise["inst"])
        body = "\n".join(body_parts)[:500]

        data = {
            "skill_name": skill_name,
            "day": day,
            "task": task,
            "dur": dur,
            "why": exercise.get("why", "")
        }
        payload = json.dumps(data, ensure_ascii=False, default=str)

        await db.execute(
            """
            INSERT INTO fredi_notifications (user_id, type, title, body, data, is_read, created_at)
            VALUES ($1, 'skill_day_task', $2, $3, $4::jsonb, FALSE, NOW())
            """,
            int(user_id), title[:200], body, payload
        )
    except Exception as e:
        logger.warning(f"skill notification push failed: {e}")


async def _send_touchpoint(db, plan_row, kind: str) -> dict:
    """kind: 'morning' | 'check' | 'eve'."""
    user_id = plan_row["user_id"]
    skill_name = plan_row["skill_name"] or "навык"
    tz_str = plan_row["tz"] if "tz" in plan_row.keys() else "UTC"
    tz = _user_tz(tz_str)
    day = _current_day(plan_row["started_at"], tz)

    plan_data = plan_row["plan"]
    if isinstance(plan_data, str):
        plan_data = json.loads(plan_data)
    exercise = _find_exercise(plan_data, day) or {}

    name = await _get_user_name(db, user_id)
    user_hour = datetime.now(timezone.utc).astimezone(tz).hour

    if kind == "morning":
        text = build_day_message(skill_name, day, exercise, name, user_hour)
    elif kind == "check":
        text = build_check_message(skill_name, day, exercise, name, user_hour)
    elif kind == "eve":
        text = build_evening_message(skill_name, day, name, user_hour)
    else:
        return {"success": False, "error": f"unknown kind: {kind}"}

    result = await send_to_channel(db, user_id, plan_row["channel"], text)

    # Утреннее сообщение дублируем в in-app уведомления — там есть кнопка «✅ Выполнил».
    if kind == "morning" and result.get("success"):
        await _push_skill_notification(db, user_id, skill_name, day, exercise)

    return result


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
                    # Раньше была строгая проверка cur_hhmm == target_hhmm —
                    # если тик планировщика дрейфует (Render cold-start, GC,
                    # любая задержка >60с), мы промахивались мимо минуты и
                    # юзер не получал сообщение в этот день вовсе.
                    # Теперь триггерим, как только текущее локальное время
                    # >= целевого, и страхуемся дедупом по last_sent.
                    if cur_hhmm < target_hhmm:
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
