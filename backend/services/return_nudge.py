"""
return_nudge.py — напоминания без почты: push и мессенджер.

Зачем. Замер 25.09.2026 по выгрузке 264 разговоров: писали больше чем в
один день трое (1%). Подписка — товар для второго и третьего раза, а
второго раза почти не бывает. Письма d1/d3 уже есть, но уходят только
на почту, а почта есть у 2%. Этот модуль — те же напоминания для
остальных: по web-push или в привязанный Telegram/MAX.

Откуда берётся канал. После третьего своего сообщения приложение
спрашивает одной строкой «Напомнить завтра, на чём остановились?» —
человек либо разрешает push, либо открывает бота (deep link
t.me/<бот>?start=web_<id>, бот заводит строку в fredi_messenger_links).
Вход через Telegram (social_auth) ставит ту же строку сам.

Кампании (25.09.2026, план удержания, мера 5) — и каждая со своим
текстом, потому что «как прошло?» три раза подряд читается как спам:

  d1_push  — через сутки: «вчера вы остановились на …». Продолжим?
  d3_push  — через трое суток: одно упражнение на сегодня по теме.
  d7_push  — через неделю: что из того разговора ещё в силе.
  sos_1h   — через час после экрана «Мне плохо прямо сейчас»: «как вы
             сейчас?». Единственная кампания без дневного окна: человек
             час назад был здесь, значит, не спит.

Кому. Канал есть, почты нет (у тех, у кого есть почта, ту же работу
делают письма — два напоминания в день не нужны), утреннего сообщения
сегодня не было, этой кампании у человека ещё не было. Окно отправки
10:00–20:59 МСК, кроме sos_1h.

Дедуп и отписка — те же, что у писем: fredi_reengagement_log,
(user_id, campaign) уникальны, opted_out_at глушит всё.
"""
from __future__ import annotations

import asyncio
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Dict, Optional

logger = logging.getLogger(__name__)

APP_BASE_URL = (os.environ.get("APP_BASE_URL")
                or "https://meysternlp.ru/fredi/").rstrip("/") + "/"
# Окно отправки по Москве: не будить и не писать в ночь.
SEND_HOUR_FROM_MSK = 10
SEND_HOUR_TO_MSK = 20  # включительно
MSK_OFFSET = 3

# Кампания → (от, до) часов после последней активности. Окна не
# пересекаются, чтобы человек не получил два напоминания в один день.
CAMPAIGNS: Dict[str, tuple] = {
    "d1_push": (20, 40),
    "d3_push": (68, 88),
    "d7_push": (164, 188),
}
# Обратная совместимость: старое имя единственной кампании.
CAMPAIGN = "d1_push"

SOS_CAMPAIGN = "sos_1h"
SOS_MIN_MINUTES = 60
SOS_MAX_MINUTES = 180

# $1 — кампания, $2 — нижняя граница часов, $3 — верхняя.
CANDIDATES_SQL = """
SELECT u.user_id, COALESCE(c.name, '') AS name
  FROM fredi_users u
  LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id
 WHERE COALESCE(u.is_active, TRUE) = TRUE
   AND (u.email IS NULL OR u.email::text = '')
   AND u.last_activity < NOW() - ($2 || ' hours')::interval
   AND u.last_activity > NOW() - ($3 || ' hours')::interval
   AND (u.last_morning_sent_at IS NULL
        OR u.last_morning_sent_at < NOW() - INTERVAL '12 hours')
   AND EXISTS (SELECT 1 FROM fredi_messages m
                WHERE m.user_id = u.user_id AND m.role = 'user'
                  AND m.created_at > NOW() - ($3 || ' hours')::interval)
   AND (EXISTS (SELECT 1 FROM fredi_push_subscriptions ps
                 WHERE ps.user_id = u.user_id AND ps.is_active = TRUE)
        OR EXISTS (SELECT 1 FROM fredi_messenger_links ml
                    WHERE ml.user_id = u.user_id AND ml.is_active = TRUE))
   AND NOT EXISTS (SELECT 1 FROM fredi_reengagement_log l
                    WHERE l.user_id = u.user_id AND l.campaign = $1)
   AND NOT EXISTS (SELECT 1 FROM fredi_reengagement_log l
                    WHERE l.user_id = u.user_id AND l.opted_out_at IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM fredi_skill_plans sp
                    WHERE sp.user_id = u.user_id
                      AND sp.channel IS NOT NULL AND sp.channel <> 'none'
                      AND sp.started_at > NOW() - INTERVAL '21 days')
 LIMIT 50
"""
# Последнее условие: у кого идёт план (навык или «семь дней по теме») с
# каналом, тому планировщик skill_notify и так пишет каждое утро — второе
# «как прошло?» в тот же день читается спамом.

# Открыл «Мне плохо прямо сейчас» час-три назад, канал есть, догона ещё
# не было. Почта не помеха: у писем такой кампании нет. $1 — кампания.
SOS_CANDIDATES_SQL = """
SELECT DISTINCT a.user_id, COALESCE(c.name, '') AS name
  FROM fredi_analytics a
  JOIN fredi_users u ON u.user_id = a.user_id
  LEFT JOIN fredi_user_contexts c ON c.user_id = a.user_id
 WHERE a.event = 'feature_opened'
   AND a.data->>'feature' = 'sos'
   AND a.created_at < NOW() - INTERVAL '60 minutes'
   AND a.created_at > NOW() - INTERVAL '180 minutes'
   AND COALESCE(u.is_active, TRUE) = TRUE
   AND (EXISTS (SELECT 1 FROM fredi_push_subscriptions ps
                 WHERE ps.user_id = a.user_id AND ps.is_active = TRUE)
        OR EXISTS (SELECT 1 FROM fredi_messenger_links ml
                    WHERE ml.user_id = a.user_id AND ml.is_active = TRUE))
   AND NOT EXISTS (SELECT 1 FROM fredi_reengagement_log l
                    WHERE l.user_id = a.user_id AND l.campaign = $1)
   AND NOT EXISTS (SELECT 1 FROM fredi_reengagement_log l
                    WHERE l.user_id = a.user_id AND l.opted_out_at IS NOT NULL)
 LIMIT 50
"""


# -------------------- чистые функции --------------------

def in_send_window(now: Optional[datetime] = None) -> bool:
    now = now or datetime.now(timezone.utc)
    hour_msk = (now.hour + MSK_OFFSET) % 24
    return SEND_HOUR_FROM_MSK <= hour_msk <= SEND_HOUR_TO_MSK


def topic_short(text: str, limit: int = 60) -> str:
    """Тема из последней реплики: одна строка, по границе слова, без
    хвоста из знаков. Пустая реплика — пустая тема."""
    t = " ".join((text or "").split())
    if len(t) <= limit:
        return t
    cut = t[:limit]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip(" ,.;:!?—-") + "…"


def _ref(campaign: str) -> str:
    # d1_push → push-d1, sos_1h → push-sos: login.js считает возврат по
    # префиксу push-, кампания — из utm_campaign.
    short = campaign.replace("_push", "").split("_")[0]
    return f"push-{short}"


def return_link(token: str, campaign: str = CAMPAIGN) -> str:
    return (f"{APP_BASE_URL}?ref={_ref(campaign)}&cid={token}"
            f"&utm_source=fredi_push&utm_medium=push&utm_campaign={campaign}")


def push_body(name: str, topic: str, campaign: str = CAMPAIGN) -> str:
    """Тело push. Коротко: на экране телефона живут две строки."""
    who = f"{name}, " if name else ""
    if campaign == "d3_push":
        if topic:
            return (f"{who}три дня назад вы говорили о «{topic}». Одно упражнение на "
                    f"сегодня: запишите одной фразой, что с тех пор изменилось, а что нет.")
        return (f"{who}три дня назад мы говорили. Одно упражнение на сегодня: "
                f"запишите одной фразой, что с тех пор изменилось, а что нет.")
    if campaign == "d7_push":
        if topic:
            return (f"{who}неделю назад вы говорили о «{topic}». Что из этого сейчас "
                    f"в силе, а что отпустило? Фреди помнит, можно продолжить.")
        return f"{who}прошла неделя с нашего разговора. Что сейчас в силе, а что отпустило?"
    if campaign == SOS_CAMPAIGN:
        return (f"{who}час назад вам было плохо. Как вы сейчас? Если не отпустило — "
                f"напишите Фреди, он рядом. При угрозе жизни — 112.")
    if topic:
        return f"{who}вчера вы остановились на «{topic}». Продолжим с того же места?"
    return f"{who}вчера мы не договорили. Продолжим с того же места?"


def messenger_text(name: str, topic: str, link: str, campaign: str = CAMPAIGN) -> str:
    head = push_body(name, topic, campaign)
    if campaign == SOS_CAMPAIGN:
        tail = "Написать Фреди:"
    elif campaign == "d3_push":
        tail = "Потом приходите — разберём, что за этим стоит. Фреди помнит, о чём шла речь:"
    elif campaign == "d7_push":
        tail = "Расскажите Фреди — он начнёт с того места, где вы остановились:"
    else:
        tail = "Если хотите — продолжим с того же места, Фреди помнит, о чём шла речь:"
    return (f"{head}\n\n{tail}\n{link}\n\n"
            f"Если такие напоминания не нужны — просто напишите «стоп».")


# -------------------- отправка --------------------

async def _send_one(db, push_service, user_id: int, name: str, campaign: str = CAMPAIGN) -> bool:
    from services.reengagement import _last_user_topic

    token = secrets.token_urlsafe(20)
    async with db.get_connection() as conn:
        link_row = await conn.fetchrow(
            "SELECT platform, chat_id FROM fredi_messenger_links "
            "WHERE user_id = $1 AND is_active = TRUE ORDER BY linked_at DESC LIMIT 1",
            user_id,
        )
    channel = link_row["platform"] if link_row else "push"

    # INSERT-first: застолбить строку раньше отправки, чтобы два прохода
    # не прислали два напоминания.
    inserted = await db.fetchrow(
        """INSERT INTO fredi_reengagement_log
               (user_id, campaign, channel, message_text, delivered, opt_out_token, sent_at)
           VALUES ($1, $2, $3, '', FALSE, $4, NOW())
           ON CONFLICT (user_id, campaign) DO NOTHING
           RETURNING id""",
        user_id, campaign, channel, token,
    )
    if not inserted:
        return False

    topic = "" if campaign == SOS_CAMPAIGN else topic_short(await _last_user_topic(db, user_id))
    link = return_link(token, campaign)
    delivered = False
    text = ""
    try:
        if channel == "push":
            text = push_body(name, topic, campaign)
            delivered = await push_service.send_to_user(user_id, "Фреди", text, link)
        else:
            text = messenger_text(name, topic, link, campaign)
            delivered = await push_service.send_text_to_messenger(user_id, text)
            if not delivered:
                # Мессенджер не ответил — пробуем push, если он есть.
                fallback = await push_service.send_to_user(
                    user_id, "Фреди", push_body(name, topic, campaign), link)
                if fallback:
                    channel, delivered = "push", True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[{campaign}] user {user_id}: отправка не удалась: {e}")

    await db.execute(
        "UPDATE fredi_reengagement_log SET message_text = $1, delivered = $2, channel = $3 WHERE id = $4",
        text, delivered, channel, inserted["id"],
    )
    logger.info(f"[{campaign}] user {user_id} via {channel}: {'ушло' if delivered else 'НЕ ушло'}")
    return delivered


async def _send_rows(db, push_service, rows, campaign: str) -> int:
    if not rows:
        return 0
    logger.info(f"[{campaign}] кандидатов: {len(rows)}")
    sent = 0
    for r in rows:
        try:
            if await _send_one(db, push_service, int(r["user_id"]), (r["name"] or "").strip(), campaign):
                sent += 1
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[{campaign}] user {r['user_id']}: {e}")
        await asyncio.sleep(0.3)
    return sent


async def scan_and_send(db, push_service, now: Optional[datetime] = None) -> int:
    """Один проход по всем кампаниям. Возвращает число доставленных."""
    if push_service is None:
        return 0
    sent = 0
    # Догон после SOS — в любое время суток: человек час назад был здесь.
    try:
        rows = await db.fetch(SOS_CANDIDATES_SQL, SOS_CAMPAIGN)
        sent += await _send_rows(db, push_service, rows, SOS_CAMPAIGN)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[{SOS_CAMPAIGN}] проход не удался: {e}")
    if not in_send_window(now):
        return sent
    for campaign, (h_from, h_to) in CAMPAIGNS.items():
        try:
            rows = await db.fetch(CANDIDATES_SQL, campaign, str(h_from), str(h_to))
            sent += await _send_rows(db, push_service, rows, campaign)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[{campaign}] проход не удался: {e}")
    return sent
