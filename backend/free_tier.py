# -*- coding: utf-8 -*-
"""Что бесплатная версия помнит, а что нет — одним местом.

25.09.2026, план удержания: без аккаунта Фреди помнит разговоры СЕМЬ
ДНЕЙ на этом устройстве, с аккаунтом — всегда и с любого устройства.

Что было. 13.09 решили, что аноним «завтра начинает сначала»: в промпт
шёл только текущий разговор (разрыв меньше 40 минут), сводки прошлых
сессий не подмешивались. Замер 25.09 по 259 разговорам: вернулись на
второй день 1%. Человеку без аккаунта возвращаться было не к чему — и
стена ему это прямо обещала. Аккаунт при этом заводят 2%: обещание
«с аккаунтом помню» почти никого не двигало, а память отнимало у всех.

Хуже того: история в промпт собиралась без времени (только role и
content), а фильтр «только текущий разговор» отбрасывал реплики без
времени. С 13.09 аноним получал ПУСТУЮ историю — Фреди не видел даже
предыдущей реплики того же разговора. Отсюда «анкета» из вопросов и
отражение чувств в 2% ответов. Теперь фильтр стоит до отбрасывания
времени (main.py), и здесь он режет по семи дням.

Аккаунт — по-прежнему память без срока и перенос между устройствами.

Опрос «что остановило» из письма третьего дня: четыре ссылки с why=<код>,
приложение читает параметр и пишет событие sub_why_not.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

# Разговор — реплики с разрывом меньше 40 минут (так считает _session_meta).
SESSION_GAP_MINUTES = 40
# Сколько дней аноним помнится на устройстве. Столько же — сводки сессий.
ANON_MEMORY_DAYS = 7

WHY_NOT_REASONS = [
    ("expensive", "дорого"),
    ("unclear", "не понял, что даёт"),
    ("doubt", "не верю, что поможет"),
    ("later", "попробую потом"),
]


def _parse_ts(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def session_history(history: List[Dict[str, Any]], registered: bool,
                    now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """История для промпта. С аккаунтом — как есть; без аккаунта — последние
    ANON_MEMORY_DAYS дней. Реплика без времени у анонима отбрасывается:
    лучше короче история, чем прошлогодняя под видом недавней. Подавать
    сюда надо строки С временем (created_at) — до того, как их обрежут
    до role/content."""
    if registered:
        return history
    now = now or datetime.now(timezone.utc)
    limit = now - timedelta(days=ANON_MEMORY_DAYS)
    out = []
    for m in history:
        ts = _parse_ts(m.get("created_at"))
        if ts is not None and ts >= limit:
            out.append(m)
    return out


def return_context(history: List[Dict[str, Any]], registered: bool,
                   now: Optional[datetime] = None) -> Dict[str, Any]:
    """Человек вернулся после паузы: когда и о чём был прошлый разговор.

    history — от старых к новым, с временем. Если последняя реплика была
    меньше SESSION_GAP_MINUTES назад — это тот же разговор, возвращения
    нет. Иначе — тема прошлого захода (первая реплика человека в нём,
    как считает шапка приложения) и сколько дней прошло. Анониму — только
    в пределах ANON_MEMORY_DAYS, с аккаунтом — до 30 дней: дальше «в
    прошлый раз вы говорили» звучит как слежка, а не как память.
    """
    now = now or datetime.now(timezone.utc)
    rows = [m for m in history if m.get("content")]
    if not rows:
        return {}
    last_at = _parse_ts(rows[-1].get("created_at"))
    if last_at is None:
        return {}
    gap = now - last_at
    if gap < timedelta(minutes=SESSION_GAP_MINUTES):
        return {}
    max_days = ANON_MEMORY_DAYS if not registered else 30
    if gap > timedelta(days=max_days):
        return {}
    # Отрезаем последний заход: назад, пока паузы меньше двух часов.
    start = len(rows) - 1
    for i in range(len(rows) - 1, 0, -1):
        a, b = _parse_ts(rows[i - 1].get("created_at")), _parse_ts(rows[i].get("created_at"))
        if a and b and (b - a) > timedelta(hours=2):
            break
        start = i - 1
    session = rows[start:]
    first_user = next((m for m in session if m.get("role") == "user"), None)
    if not first_user:
        return {}
    text = " ".join(str(first_user["content"]).split())
    if len(text) > 80:
        text = (text[:80].rsplit(" ", 1)[0] or text[:80]).rstrip(" ,.;:—-") + "…"
    hours = gap.total_seconds() / 3600
    if hours < 20:
        when = "сегодня, несколько часов назад"
    elif gap.days <= 1:
        when = "вчера"
    elif gap.days < 7:
        when = f"{gap.days} дня назад" if gap.days < 5 else f"{gap.days} дней назад"
    else:
        when = f"{gap.days} дней назад"
    return {"return_topic": text, "return_when": when, "return_days": gap.days}


def why_not_block(return_link: str) -> str:
    """Текст с четырьмя ссылками для письма третьего дня."""
    sep = "&" if "?" in return_link else "?"
    lines = ["Один вопрос, без обязательств: что остановило от подписки?"]
    for code, label in WHY_NOT_REASONS:
        lines.append(f"— {label}: {return_link}{sep}why={code}")
    return "\n".join(lines)


def why_not_html(return_link: str) -> str:
    sep = "&" if "?" in return_link else "?"
    items = "".join(
        f'<a href="{return_link}{sep}why={code}" style="display:inline-block;margin:0 8px 8px 0;'
        f'padding:8px 14px;border:1px solid #d1d1d6;border-radius:20px;color:#1c1c1e;'
        f'text-decoration:none;font-size:14px">{label}</a>'
        for code, label in WHY_NOT_REASONS)
    return ('<p style="margin-top:28px;font-size:14px;color:#3c3c43">Один вопрос, без обязательств: '
            'что остановило от подписки?</p><p>' + items + '</p>')
