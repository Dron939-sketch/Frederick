"""drip_campaign.py — 3-дневный прогрев VK-друзей (Д1 voice+text → Д2 text → Д3 text).

Архитектура:
  - Очередь хранится в Postgres (fredi_drip_queue): по одной строке на VK-id,
    с полями day_status (0..3) и last_sent_at.
  - Scheduler — отдельная asyncio-таска, запускаемая из lifespan() в main.py.
    Каждые SCHEDULER_INTERVAL секунд (15 мин по умолчанию) она:
      * проверяет «рабочие часы» (10:00–21:00 Москва)
      * проверяет дневной лимит (DAILY_CAP сообщений/сутки)
      * берёт батч eligible-кандидатов на Д1/Д2/Д3 и шлёт их по очереди
  - Шаблоны (DRIP_TEMPLATES) хардкодом — Д1 разделён на name+body для
    кэширования TTS-тела через vk_send_voice.send_voice_with_split().
  - Тексты Д2/Д3 шлются напрямую через messages.send (user-токен).

Чтобы запустить кампанию админ дёргает /api/admin/vk/drip/init с фильтром —
это вызывает friends.get, фильтрует по полу/возрасту/открытой личке и
INSERT'ит в очередь. Дальше scheduler работает сам.
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ===== Конфиг =====
# Часовой пояс Москвы — фиксированный +3 (без перехода на летнее).
MSK = timezone(timedelta(hours=3))
# Окно отправки (по Москве). Полночь и утренние часы — категорически нет:
# в это время VK быстрее банит за рассылки.
ALLOWED_HOUR_FROM = 10
ALLOWED_HOUR_TO = 21
# Дневной лимит сообщений (Д1+Д2+Д3 суммарно). VK-аккаунты типично
# держат ~40-50/сутки до жалоб; 40 — безопасный потолок.
DAILY_CAP = 40
# Пауза между отдельными отправками внутри одного цикла scheduler-а.
INTER_SEND_PAUSE_SEC = 4.0
# Интервал между запусками scheduler-цикла (15 мин по умолчанию). Можно
# изменить через /api/admin/vk/drip/config — scheduler перечитывает БД на
# каждом тике, новое значение применяется со следующего цикла без рестарта.
DEFAULT_SCHEDULER_INTERVAL = 900
SCHEDULER_INTERVAL = DEFAULT_SCHEDULER_INTERVAL
# Минимум/максимум для интервала (защита от случайного 0/огромного значения).
MIN_INTERVAL_SEC = 60
MAX_INTERVAL_SEC = 24 * 3600
# Получателей за один цикл (а не сообщений). Д1 = голос+текст = 2 msg,
# Д2/Д3 = 1 msg. С limit=1 у одного юзера за тик максимум 2 сообщения.
TICK_TOTAL_LIMIT = 1
# Размер «батча» при выборке из БД — берём с запасом, чтобы пропустить
# FATAL'ы (закрытая личка и т.п.) и дойти до живого кандидата.
BATCH_LOOKAHEAD = 4
# Кулдаун после VK error 9 (flood). Часовой пояс — UTC, чтобы не
# зависеть от перевода времени.
FLOOD_COOLDOWN_SEC = 1800

# ===== Шаблоны =====
# Новый формат — 2 шага:
#   Д1: только голосовое, без текста и без ссылки. Создаёт интерес, обещает
#       завтра написать со ссылкой.
#   Д2: только текст со ссылкой («как обещал — вот ссылочка»).
# Так короче, меньше шансов словить блок за длинные тексты с ссылками
# в первой же отправке от нового VK-аккаунта.
DRIP_TEMPLATES = {
    "female": {
        "d1": {
            "voice_name": "{name}, привет. Это Фреди. ",
            "voice_body": (
                "Слушай, такая штука. Ты, наверное, не раз замечала: "
                "рассказала подруге что-то очень личное — стало легче, "
                "а потом она это помнит. Годами. И иногда вдруг всплывает "
                "не вовремя. Я появился, чтобы у тебя был кто-то, с кем "
                "можно поговорить без свидетелей. Без памяти, без сплетен, "
                "без «давай я тебя спасу». Не буду сейчас грузить и кидать "
                "ссылок. Завтра напишу — скину ссылочку, посмотришь сама."
            ),
        },
        "d2": {
            "text": (
                "{name}, как обещал — вот ссылка 👇\n"
                "👉 https://meysternlp.ru/fredi/\n\n"
                "Виртуальный психолог. Без обид и без памяти. "
                "Поговорили → закрыла → всё. Никто ничего не помнит.\n\n"
                "Зайди, когда будет минутка. Без регистрации души и "
                "подписи кровью.\n\nФреди"
            ),
        },
    },
    "male": {
        "d1": {
            "voice_name": "{name}, привет. Это Фреди. ",
            "voice_body": (
                "Слушай, такая штука. Есть вещи, которые не очень "
                "расскажешь друзьям — не потому что не доверяешь, а "
                "потому что друзья помнят. А потом эта инфа всплывает "
                "не вовремя. Я появился, чтобы был кто-то, с кем можно "
                "обсудить серьёзное без последствий. Без памяти, без "
                "оценок, без «соберись, мужик». Не буду сейчас грузить "
                "и кидать ссылок. Завтра напишу — скину ссылочку, "
                "посмотришь сам."
            ),
        },
        "d2": {
            "text": (
                "{name}, как обещал — вот ссылка 👇\n"
                "👉 https://meysternlp.ru/fredi/\n\n"
                "Виртуальный психолог. Без обид и без памяти. "
                "Поговорили → закрыл → всё. Никто ничего не помнит.\n\n"
                "Зайди, когда будет минутка. Без регистрации души и "
                "подписи кровью.\n\nФреди"
            ),
        },
    },
}

# ===== Состояние scheduler-а (in-memory) =====
class _DripState:
    paused = False  # глобальная пауза от админа
    flood_until: Optional[datetime] = None  # cooldown после VK error 9
    last_run_at: Optional[datetime] = None
    last_run_summary: Dict[str, int] = {}

_STATE = _DripState()


# ===== БД =====
async def init_drip_tables(db) -> None:
    """Создаёт таблицу очереди + таблицу шаблонов (idempotent)."""
    async with db.get_connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_drip_queue (
                id BIGSERIAL PRIMARY KEY,
                vk_id BIGINT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                sex SMALLINT,
                age SMALLINT,
                day_status SMALLINT NOT NULL DEFAULT 0,
                last_sent_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                last_error TEXT,
                last_error_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fredi_drip_queue_vk_id_unique UNIQUE (vk_id)
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_fredi_drip_queue_status
            ON fredi_drip_queue(day_status, last_sent_at)
        """)
        # Шаблоны хранятся как JSON в одной строке (singleton id=1).
        # Если строки нет — drip берёт DRIP_TEMPLATES из кода.
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_drip_templates (
                id INT PRIMARY KEY,
                templates_json TEXT NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fredi_drip_templates_singleton CHECK (id = 1)
            )
        """)
        # Конфиг кампании (интервал scheduler-а). Singleton.
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_drip_config (
                id INT PRIMARY KEY,
                interval_sec INT NOT NULL DEFAULT 900,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fredi_drip_config_singleton CHECK (id = 1)
            )
        """)
    logger.info("drip_campaign: tables ready")


async def get_templates(db) -> Dict[str, Any]:
    """Возвращает текущие шаблоны: из БД если сохранены, иначе дефолт.
    Дефолты тоже отдаём всегда отдельно, чтобы фронт мог показать «вернуть как было»."""
    import json
    saved = None
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow("SELECT templates_json FROM fredi_drip_templates WHERE id = 1")
        if row and row["templates_json"]:
            saved = json.loads(row["templates_json"])
    except Exception as e:
        logger.warning(f"get_templates DB read failed: {e}")
    current = saved if saved else DRIP_TEMPLATES
    return {"current": current, "defaults": DRIP_TEMPLATES, "is_custom": saved is not None}


async def save_templates(db, templates: Dict[str, Any]) -> None:
    """UPSERT новых шаблонов. Минимальная валидация структуры (2 дня)."""
    import json
    # Валидация: ждём ключи 'female' и 'male', внутри 'd1' (voice_name, voice_body),
    # 'd2' (text). Поле text у d1 необязательное (теперь только голос).
    for sex in ("female", "male"):
        if sex not in templates:
            raise ValueError(f"missing sex section: {sex}")
        s = templates[sex]
        for d in ("d1", "d2"):
            if d not in s:
                raise ValueError(f"missing day section: {sex}.{d}")
        if not s["d1"].get("voice_body"):
            raise ValueError(f"{sex}.d1: voice_body required")
        if not s["d2"].get("text"):
            raise ValueError(f"{sex}.d2: text required")
    js = json.dumps(templates, ensure_ascii=False)
    async with db.get_connection() as conn:
        await conn.execute("""
            INSERT INTO fredi_drip_templates (id, templates_json, updated_at)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE SET
                templates_json = EXCLUDED.templates_json,
                updated_at = NOW()
        """, js)


async def reset_templates_to_default(db) -> None:
    async with db.get_connection() as conn:
        await conn.execute("DELETE FROM fredi_drip_templates WHERE id = 1")


async def _load_templates_or_default(db) -> Dict[str, Any]:
    """Используется при отправке — кэшируется на время одного тика."""
    info = await get_templates(db)
    return info["current"]


async def get_recent_log(db, limit: int = 30) -> List[Dict[str, Any]]:
    """Возвращает последние N изменений в очереди (отправки и ошибки)."""
    limit = max(1, min(int(limit), 200))
    async with db.get_connection() as conn:
        rows = await conn.fetch("""
            SELECT vk_id, first_name, last_name, day_status, last_sent_at,
                   last_error, last_error_at
            FROM fredi_drip_queue
            WHERE last_sent_at IS NOT NULL OR last_error_at IS NOT NULL
            ORDER BY GREATEST(
                COALESCE(last_sent_at, '1970-01-01'::timestamptz),
                COALESCE(last_error_at, '1970-01-01'::timestamptz)
            ) DESC
            LIMIT $1
        """, limit)
    out = []
    for r in rows:
        is_err = bool(r["last_error"])
        ts = r["last_error_at"] if is_err and (not r["last_sent_at"] or r["last_error_at"] and r["last_error_at"] > r["last_sent_at"]) else r["last_sent_at"]
        out.append({
            "vk_id": int(r["vk_id"]),
            "first_name": r["first_name"] or "",
            "last_name": r["last_name"] or "",
            "day_status": int(r["day_status"]),
            "ts": ts.isoformat() if ts else None,
            "is_error": is_err,
            "error": r["last_error"] if is_err else None,
        })
    return out


# ===== VK friends.get =====
async def fetch_friends_filtered(
    *, sex: int = 1, age_min: int = 30, age_max: int = 55, max_count: int = 5000
) -> List[Dict[str, Any]]:
    """friends.get + локальная фильтрация по полу/возрасту/закрытой личке.
    Использует VK_USER_TOKEN (тот же, что для отправки сообщений).
    """
    import httpx
    token = (os.environ.get("VK_USER_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("VK_USER_TOKEN не задан")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://api.vk.com/method/friends.get",
            params={
                "access_token": token,
                "v": "5.199",
                "fields": "sex,bdate,first_name,last_name,can_write_private_message,last_seen,is_closed,deactivated",
                "count": max(1, min(int(max_count), 10000)),
                "order": "name",
            },
        )
    data = resp.json()
    if "error" in data:
        err = data["error"]
        raise RuntimeError(f"VK friends.get: {err.get('error_code')}/{err.get('error_msg')}")
    items = (data.get("response") or {}).get("items") or []

    out = []
    today = datetime.now()
    for u in items:
        if u.get("deactivated"):
            continue
        if u.get("is_closed"):
            continue
        if u.get("can_write_private_message") == 0:
            continue
        if sex in (1, 2) and int(u.get("sex") or 0) != sex:
            continue
        # Возраст из bdate (нам важен ТОЛЬКО если есть год)
        bdate = u.get("bdate") or ""
        age = None
        parts = str(bdate).split(".")
        if len(parts) == 3:
            try:
                day = int(parts[0]); month = int(parts[1]); year = int(parts[2])
                if 1900 < year < 2100:
                    age = today.year - year - (1 if (today.month, today.day) < (month, day) else 0)
            except ValueError:
                age = None
        if age is None:
            # Возраст неизвестен — для друзей-30+ безопаснее пропустить.
            continue
        if age < age_min or age > age_max:
            continue
        out.append({
            "vk_id": int(u["id"]),
            "first_name": u.get("first_name") or "",
            "last_name": u.get("last_name") or "",
            "sex": int(u.get("sex") or 0),
            "age": age,
        })
    return out


async def init_campaign(db, *, sex: int = 1, age_min: int = 30, age_max: int = 55) -> Dict[str, Any]:
    """Парсит друзей, INSERT'ит новых в очередь (старых не трогает).
    Возвращает счётчики: total_friends, inserted, skipped_existing.
    Legacy-эндпоинт — фронт теперь идёт по preview→enqueue.
    """
    friends = await fetch_friends_filtered(sex=sex, age_min=age_min, age_max=age_max)
    inserted = 0
    skipped = 0
    async with db.get_connection() as conn:
        for f in friends:
            row = await conn.fetchrow(
                "SELECT id, day_status FROM fredi_drip_queue WHERE vk_id = $1", f["vk_id"]
            )
            if row:
                skipped += 1
                continue
            await conn.execute("""
                INSERT INTO fredi_drip_queue (vk_id, first_name, last_name, sex, age, day_status)
                VALUES ($1, $2, $3, $4, $5, 0)
            """, f["vk_id"], f["first_name"], f["last_name"], f["sex"], f["age"])
            inserted += 1
    logger.info(f"drip init: friends={len(friends)} inserted={inserted} skipped={skipped}")
    return {"total_friends": len(friends), "inserted": inserted, "skipped_existing": skipped}


async def preview_friends(db, *, sex: int = 1, age_min: int = 30, age_max: int = 55) -> Dict[str, Any]:
    """Парсит друзей и возвращает список БЕЗ записи в очередь. Помечает
    флагом already_in_queue тех, кто уже стоит в очереди — фронт их
    подсветит и не даст повторно ставить."""
    friends = await fetch_friends_filtered(sex=sex, age_min=age_min, age_max=age_max)
    if not friends:
        return {"total_friends": 0, "friends": []}
    vk_ids = [int(f["vk_id"]) for f in friends]
    async with db.get_connection() as conn:
        rows = await conn.fetch(
            "SELECT vk_id, day_status FROM fredi_drip_queue WHERE vk_id = ANY($1::bigint[])",
            vk_ids,
        )
    in_queue = {int(r["vk_id"]): int(r["day_status"]) for r in rows}
    out = []
    for f in friends:
        item = dict(f)
        item["already_in_queue"] = f["vk_id"] in in_queue
        item["day_status"] = in_queue.get(f["vk_id"])
        out.append(item)
    return {"total_friends": len(out), "friends": out}


async def enqueue_friends(db, friends: List[Dict[str, Any]]) -> Dict[str, int]:
    """Принимает выбранный фронтом список и кладёт в очередь (только тех,
    кого ещё нет). Поля: vk_id, first_name, last_name, sex, age."""
    if not friends or not isinstance(friends, list):
        return {"inserted": 0, "skipped_existing": 0}
    inserted = 0
    skipped = 0
    async with db.get_connection() as conn:
        for f in friends:
            try:
                vk_id = int(f.get("vk_id") or 0)
            except (TypeError, ValueError):
                vk_id = 0
            if vk_id <= 0:
                continue
            row = await conn.fetchrow(
                "SELECT id FROM fredi_drip_queue WHERE vk_id = $1", vk_id
            )
            if row:
                skipped += 1
                continue
            try:
                sex = int(f.get("sex") or 1)
            except (TypeError, ValueError):
                sex = 1
            try:
                age = int(f.get("age") or 0)
            except (TypeError, ValueError):
                age = 0
            await conn.execute("""
                INSERT INTO fredi_drip_queue (vk_id, first_name, last_name, sex, age, day_status)
                VALUES ($1, $2, $3, $4, $5, 0)
            """, vk_id, (f.get("first_name") or "").strip(), (f.get("last_name") or "").strip(), sex, age)
            inserted += 1
    logger.info(f"drip enqueue: inserted={inserted} skipped={skipped}")
    return {"inserted": inserted, "skipped_existing": skipped}


async def get_config(db) -> Dict[str, Any]:
    """Возвращает текущий интервал scheduler-а."""
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow("SELECT interval_sec FROM fredi_drip_config WHERE id = 1")
        interval = int(row["interval_sec"]) if row and row["interval_sec"] else DEFAULT_SCHEDULER_INTERVAL
    except Exception as e:
        logger.warning(f"drip get_config failed: {e}")
        interval = DEFAULT_SCHEDULER_INTERVAL
    return {
        "interval_sec": interval,
        "interval_min": interval // 60,
        "daily_cap": DAILY_CAP,
        "working_hours": [ALLOWED_HOUR_FROM, ALLOWED_HOUR_TO],
        "tick_total_limit": TICK_TOTAL_LIMIT,
    }


async def save_config(db, interval_sec: int) -> None:
    interval_sec = max(MIN_INTERVAL_SEC, min(int(interval_sec), MAX_INTERVAL_SEC))
    async with db.get_connection() as conn:
        await conn.execute("""
            INSERT INTO fredi_drip_config (id, interval_sec, updated_at)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE SET
                interval_sec = EXCLUDED.interval_sec,
                updated_at = NOW()
        """, interval_sec)


async def _get_interval_sec_or_default(db) -> int:
    """Используется scheduler-ом каждый цикл — читает свежее значение."""
    try:
        cfg = await get_config(db)
        return int(cfg["interval_sec"])
    except Exception:
        return DEFAULT_SCHEDULER_INTERVAL


async def get_status(db) -> Dict[str, Any]:
    """Счётчики по day_status + последние ошибки."""
    async with db.get_connection() as conn:
        rows = await conn.fetch("""
            SELECT day_status, COUNT(*) AS c FROM fredi_drip_queue
            WHERE last_error IS NULL OR last_error NOT LIKE 'FATAL:%'
            GROUP BY day_status ORDER BY day_status
        """)
        sent_today = await conn.fetchval("""
            SELECT COUNT(*) FROM fredi_drip_queue
            WHERE last_sent_at >= NOW() - INTERVAL '24 hours'
        """) or 0
        fatal_errors = await conn.fetchval("""
            SELECT COUNT(*) FROM fredi_drip_queue
            WHERE last_error LIKE 'FATAL:%'
        """) or 0
        last_sent = await conn.fetchrow("""
            SELECT vk_id, first_name, day_status, last_sent_at
            FROM fredi_drip_queue
            WHERE last_sent_at IS NOT NULL
            ORDER BY last_sent_at DESC LIMIT 1
        """)
    by_status = {0: 0, 1: 0, 2: 0, 3: 0}
    for r in rows:
        ds = int(r["day_status"])
        if ds in by_status:
            by_status[ds] = int(r["c"])
    return {
        "queue_total": sum(by_status.values()),
        "pending_d1": by_status[0],
        "got_d1": by_status[1],
        "got_d2": by_status[2] + by_status[3],
        "completed_d3": 0,  # legacy поле, не используется в 2-дневной схеме
        "sent_last_24h": int(sent_today),
        "fatal_errors": int(fatal_errors),
        "daily_cap": DAILY_CAP,
        "paused": _STATE.paused,
        "in_working_hours": _in_working_hours(),
        "flood_cooldown_until": _STATE.flood_until.isoformat() if _STATE.flood_until else None,
        "last_run_at": _STATE.last_run_at.isoformat() if _STATE.last_run_at else None,
        "last_run_summary": _STATE.last_run_summary,
        "last_sent_user": ({
            "vk_id": last_sent["vk_id"],
            "first_name": last_sent["first_name"],
            "day_status": last_sent["day_status"],
            "at": last_sent["last_sent_at"].isoformat(),
        } if last_sent else None),
    }


# ===== Eligibility =====
def _in_working_hours() -> bool:
    h = datetime.now(MSK).hour
    return ALLOWED_HOUR_FROM <= h < ALLOWED_HOUR_TO


async def _pick_eligible(conn, kind: str, limit: int) -> List[Dict[str, Any]]:
    """kind in {'d1', 'd2', 'd3'}. Возвращает строки готовых к отправке."""
    if kind == "d1":
        rows = await conn.fetch("""
            SELECT id, vk_id, first_name, sex FROM fredi_drip_queue
            WHERE day_status = 0
              AND (last_error IS NULL OR last_error NOT LIKE 'FATAL:%')
            ORDER BY id ASC LIMIT $1
        """, limit)
    elif kind == "d2":
        rows = await conn.fetch("""
            SELECT id, vk_id, first_name, sex FROM fredi_drip_queue
            WHERE day_status = 1
              AND last_sent_at < NOW() - INTERVAL '20 hours'
              AND (last_error IS NULL OR last_error NOT LIKE 'FATAL:%')
            ORDER BY last_sent_at ASC LIMIT $1
        """, limit)
    else:
        rows = []
    return [dict(r) for r in rows]


def _fmt(template: str, name: str) -> str:
    return template.replace("{name}", name or "Привет")


def _gender_key(sex: int) -> str:
    return "male" if sex == 2 else "female"


# ===== Отправка =====
async def _send_d1(row: Dict[str, Any], templates: Dict[str, Any]) -> Dict[str, Any]:
    """Только голосовое (без текста вдогонку и без ссылки).
    Текст со ссылкой уйдёт на Д2 («как обещал — вот ссылочка»)."""
    from vk_send_voice import send_voice_with_split
    g = _gender_key(int(row.get("sex") or 1))
    tpl = templates[g]["d1"]
    name = (row.get("first_name") or "").strip() or "Привет"
    # text_followup=None — никакого follow-up текста после голоса.
    # Поле tpl.get("text") игнорируем, даже если кто-то прислал.
    return await send_voice_with_split(
        voice_name_text=_fmt(tpl["voice_name"], name),
        voice_body_text=tpl["voice_body"],
        vk_peer_id=int(row["vk_id"]),
        text_followup=None,
        pause_ms=350,
    )


async def _send_text_only(vk_peer_id: int, text: str) -> Dict[str, Any]:
    """Text-only через messages.send (user-токен)."""
    from vk_send_voice import _vk_method
    msg_random_id = random.randint(1, 2**31 - 1)
    out = await _vk_method("messages.send", {
        "peer_id": vk_peer_id,
        "random_id": msg_random_id,
        "message": text,
        "dont_parse_links": 0,
    })
    return {"message_id": out if isinstance(out, int) else None}


async def _send_dN(row: Dict[str, Any], kind: str, templates: Dict[str, Any]) -> Dict[str, Any]:
    """kind='d2' — текст со ссылкой («как обещал»)."""
    g = _gender_key(int(row.get("sex") or 1))
    tpl = templates[g][kind]
    name = (row.get("first_name") or "").strip() or "Привет"
    return await _send_text_only(int(row["vk_id"]), _fmt(tpl["text"], name))


def _classify_error(exc: Exception) -> str:
    """Возвращает FATAL:<code> (юзера больше не трогаем) или RETRY:<code>."""
    msg = str(exc).lower()
    # 902 — пользователь закрыл личку: FATAL
    if "902" in msg or "private message" in msg or "privacy" in msg:
        return "FATAL:902_privacy"
    # 7 — нет прав; 15 — доступ запрещён; deleted; banned — FATAL
    if "deactivated" in msg or "banned" in msg or "deleted" in msg:
        return "FATAL:account_dead"
    if "/7/" in msg or "/15/" in msg:
        return "FATAL:no_permission"
    # 9 — flood control: RETRY с глобальным cooldown
    if " 9/" in msg or "flood" in msg:
        return "RETRY:flood"
    # 10 — internal server error VK: RETRY
    if " 10/" in msg or "internal server" in msg:
        return "RETRY:vk_internal"
    return "RETRY:unknown"


async def _process_one(db, row: Dict[str, Any], kind: str, templates: Dict[str, Any]) -> str:
    """Возвращает 'sent' / 'fatal' / 'retry' / 'flood'."""
    next_status = {"d1": 1, "d2": 2}[kind]
    try:
        if kind == "d1":
            await _send_d1(row, templates)
        else:
            await _send_dN(row, kind, templates)
    except Exception as e:
        cls = _classify_error(e)
        logger.warning(f"drip {kind} vk={row['vk_id']}: {e} [{cls}]")
        async with db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_drip_queue SET last_error = $1, last_error_at = NOW()
                WHERE id = $2
            """, cls, row["id"])
        if cls.startswith("FATAL"):
            return "fatal"
        if cls == "RETRY:flood":
            return "flood"
        return "retry"
    # Успех — продвигаем day_status, чистим last_error.
    async with db.get_connection() as conn:
        await conn.execute("""
            UPDATE fredi_drip_queue
            SET day_status = $1, last_sent_at = NOW(),
                last_error = NULL, last_error_at = NULL
            WHERE id = $2
        """, next_status, row["id"])
    return "sent"


# ===== Scheduler =====
async def drip_scheduler(db):
    """Основной цикл — запускается из lifespan() main.py.
    Интервал между циклами читается из fredi_drip_config — админ может
    менять его на лету через /api/admin/vk/drip/config."""
    logger.info("drip_scheduler: started")
    await asyncio.sleep(60)
    while True:
        try:
            await _tick(db)
        except Exception as e:
            logger.error(f"drip_scheduler tick error: {e}")
        interval = await _get_interval_sec_or_default(db)
        await asyncio.sleep(interval)


async def _tick(db):
    summary = {"d1_sent": 0, "d2_sent": 0, "d3_sent": 0, "fatal": 0, "retry": 0, "skipped_reason": None}
    _STATE.last_run_at = datetime.now(timezone.utc)
    _STATE.last_run_summary = summary

    if _STATE.paused:
        summary["skipped_reason"] = "paused"
        return
    if not _in_working_hours():
        summary["skipped_reason"] = "out_of_hours"
        return
    if _STATE.flood_until and datetime.now(timezone.utc) < _STATE.flood_until:
        summary["skipped_reason"] = "flood_cooldown"
        return
    _STATE.flood_until = None

    async with db.get_connection() as conn:
        sent_24h = await conn.fetchval("""
            SELECT COUNT(*) FROM fredi_drip_queue
            WHERE last_sent_at >= NOW() - INTERVAL '24 hours'
        """) or 0
    remaining = DAILY_CAP - int(sent_24h)
    if remaining <= 0:
        summary["skipped_reason"] = "daily_cap_reached"
        return

    # Один раз за тик грузим актуальные шаблоны (юзер мог их отредактировать).
    templates = await _load_templates_or_default(db)

    # Один получатель за тик. Приоритет: Д2 > Д1 — быстрее доводим
    # юзера до конца воронки (получил ссылку = терминальное состояние).
    # FATAL/retry — пробуем следующего, в лимит тика не считается.
    sent_this_tick = 0

    for kind in ("d2", "d1"):
        if sent_this_tick >= TICK_TOTAL_LIMIT:
            break
        if remaining <= 0:
            break
        async with db.get_connection() as conn:
            batch = await _pick_eligible(conn, kind, BATCH_LOOKAHEAD)
        if not batch:
            continue
        for row in batch:
            if sent_this_tick >= TICK_TOTAL_LIMIT:
                break
            if remaining <= 0:
                break
            res = await _process_one(db, row, kind, templates)
            if res == "sent":
                summary[f"{kind}_sent"] += 1
                sent_this_tick += 1
                remaining -= 1
            elif res == "fatal":
                summary["fatal"] += 1
                # пробуем следующего кандидата того же типа
            elif res == "flood":
                _STATE.flood_until = datetime.now(timezone.utc) + timedelta(seconds=FLOOD_COOLDOWN_SEC)
                summary["skipped_reason"] = "flood_triggered"
                logger.warning(f"drip: flood control triggered, cooldown {FLOOD_COOLDOWN_SEC}s")
                return
            else:
                summary["retry"] += 1
                # retry тоже не считается в лимит тика, пробуем следующего
            await asyncio.sleep(INTER_SEND_PAUSE_SEC + random.uniform(0, 2))

    if any(summary[k] for k in ("d1_sent", "d2_sent", "d3_sent")):
        logger.info(f"drip tick: {summary}")


# ===== Pause/Resume/Stop =====
def set_paused(v: bool):
    _STATE.paused = bool(v)
    return _STATE.paused


async def stop_and_clear(db) -> int:
    """Удаляет ВСЕ записи из очереди (для перезапуска кампании)."""
    async with db.get_connection() as conn:
        before = await conn.fetchval("SELECT COUNT(*) FROM fredi_drip_queue") or 0
        await conn.execute("DELETE FROM fredi_drip_queue")
    return int(before)
