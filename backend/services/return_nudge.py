"""
return_nudge.py — «напомнить завтра, на чём остановились».

Зачем. Замер 25.09.2026 по выгрузке 264 разговоров: писали больше чем в
один день трое (1%). Подписка — товар для второго и третьего раза, а
второго раза почти не бывает. Письма d1 «как прошло?» уже есть, но
уходят только на почту, а почта есть у 2%. Этот модуль — тот же
«как прошло?» для остальных: по web-push или в привязанный Telegram/MAX.

Откуда берётся канал. После третьего своего сообщения приложение
спрашивает одной строкой «Напомнить завтра, на чём остановились?» —
человек либо разрешает push, либо открывает бота (deep link
t.me/<бот>?start=web_<id>, бот заводит строку в fredi_messenger_links).
Вход через Telegram (social_auth) ставит ту же строку сам.

Кому. Разговор был 20–40 часов назад, канал есть, почты нет (у тех, у
кого есть почта, эту же работу делает письмо d1 — два напоминания в
день не нужны), утреннего сообщения сегодня не было, этой кампании ещё
не было. Окно отправки 10:00–20:59 МСК.

Дедуп и отписка — те же, что у писем: fredi_reengagement_log,
(user_id, campaign) уникальны, opted_out_at глушит всё.
"""
from __future__ import annotations

import asyncio
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

CAMPAIGN = "d1_push"
APP_BASE_URL = (os.environ.get("APP_BASE_URL")
                or "https://meysternlp.ru/fredi/").rstrip("/") + "/"
# Окно отправки по Москве: не будить и не писать в ночь.
SEND_HOUR_FROM_MSK = 10
SEND_HOUR_TO_MSK = 20  # включительно
MSK_OFFSET = 3

CANDIDATES_SQL = """
SELECT u.user_id, COALESCE(c.name, '') AS name
  FROM fredi_users u
  LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id
 WHERE COALESCE(u.is_active, TRUE) = TRUE
   AND (u.email IS NULL OR u.email::text = '')
   AND u.last_activity < NOW() - INTERVAL '20 hours'
   AND u.last_activity > NOW() - INTERVAL '40 hours'
   AND (u.last_morning_sent_at IS NULL
        OR u.last_morning_sent_at < NOW() - INTERVAL '12 hours')
   AND EXISTS (SELECT 1 FROM fredi_messages m
                WHERE m.user_id = u.user_id AND m.role = 'user'
                  AND m.created_at > NOW() - INTERVAL '2 days')
   AND (EXISTS (SELECT 1 FROM fredi_push_subscriptions ps
                 WHERE ps.user_id = u.user_id AND ps.is_active = TRUE)
        OR EXISTS (SELECT 1 FROM fredi_messenger_links ml
                    WHERE ml.user_id = u.user_id AND ml.is_active = TRUE))
   AND NOT EXISTS (SELECT 1 FROM fredi_reengagement_log l
                    WHERE l.user_id = u.user_id AND l.campaign = $1)
   AND NOT EXISTS (SELECT 1 FROM fredi_reengagement_log l
                    WHERE l.user_id = u.user_id AND l.opted_out_at IS NOT NULL)
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


def return_link(token: str) -> str:
    return (f"{APP_BASE_URL}?ref=push-d1&cid={token}"
            f"&utm_source=fredi_push&utm_medium=push&utm_campaign={CAMPAIGN}")


def push_body(name: str, topic: str) -> str:
    who = f"{name}, " if name else ""
    if topic:
        return f"{who}вчера вы остановились на «{topic}». Продолжим с того же места?"
    return f"{who}вчера мы не договорили. Продолжим с того же места?"


def messenger_text(name: str, topic: str, link: str) -> str:
    who = f"{name}, " if name else ""
    head = (f"{who}вчера вы остановились на «{topic}»."
            if topic else f"{who}вчера мы не договорили.")
    return (f"{head}\n\nЕсли хотите — продолжим с того же места, Фреди помнит, "
            f"о чём шла речь:\n{link}\n\n"
            f"Если такие напоминания не нужны — просто напишите «стоп».")


# -------------------- отправка --------------------

async def _send_one(db, push_service, user_id: int, name: str) -> bool:
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
        user_id, CAMPAIGN, channel, token,
    )
    if not inserted:
        return False

    topic = topic_short(await _last_user_topic(db, user_id))
    link = return_link(token)
    delivered = False
    text = ""
    try:
        if channel == "push":
            text = push_body(name, topic)
            delivered = await push_service.send_to_user(user_id, "Фреди", text, link)
        else:
            text = messenger_text(name, topic, link)
            delivered = await push_service.send_text_to_messenger(user_id, text)
            if not delivered:
                # Мессенджер не ответил — пробуем push, если он есть.
                fallback = await push_service.send_to_user(user_id, "Фреди", push_body(name, topic), link)
                if fallback:
                    channel, delivered = "push", True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[d1_push] user {user_id}: отправка не удалась: {e}")

    await db.execute(
        "UPDATE fredi_reengagement_log SET message_text = $1, delivered = $2, channel = $3 WHERE id = $4",
        text, delivered, channel, inserted["id"],
    )
    logger.info(f"[d1_push] user {user_id} via {channel}: {'ушло' if delivered else 'НЕ ушло'}")
    return delivered


async def scan_and_send(db, push_service, now: Optional[datetime] = None) -> int:
    """Один проход. Возвращает число доставленных напоминаний."""
    if push_service is None or not in_send_window(now):
        return 0
    rows = await db.fetch(CANDIDATES_SQL, CAMPAIGN)
    if not rows:
        return 0
    logger.info(f"[d1_push] кандидатов: {len(rows)}")
    sent = 0
    for r in rows:
        try:
            if await _send_one(db, push_service, int(r["user_id"]), (r["name"] or "").strip()):
                sent += 1
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[d1_push] user {r['user_id']}: {e}")
        await asyncio.sleep(0.3)
    return sent
