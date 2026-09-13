# -*- coding: utf-8 -*-
"""Что бесплатная версия помнит, а что нет — одним местом.

Решение владельца 13.09.2026: «после второго-третьего вопроса дать знать
пользователю, что он в бесплатной версии, эти диалоги не сохраняются и
завтра всё нужно начинать сначала». Чтобы это было правдой, а не текстом
на стене, бэкенд у человека без аккаунта:

- не подмешивает сводки прошлых сессий (session_memory);
- кладёт в промпт только реплики текущего разговора — с разрывом меньше
  40 минут, как считает _session_meta, — а не последние десять сообщений
  за все дни с этого устройства.

До этого память и история грузились всем по user_id, а аноним на одном
устройстве получал вчерашний разговор в промпт и слышал «помню, ты
говорил про…», хотя стена обещала обратное.

Аккаунт (почта и четыре цифры) — история сохраняется и Фреди помнит.
Это обещание двери аккаунта, и оно остаётся в силе.

Опрос «что остановило» из письма третьего дня: четыре ссылки с why=<код>,
приложение читает параметр и пишет событие sub_why_not.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

SESSION_GAP_MINUTES = 40

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
    """История для промпта. С аккаунтом — как есть; без аккаунта — только
    текущий разговор. Реплика без времени у анонима считается чужой и
    отбрасывается: лучше пустая история, чем вчерашняя под видом сегодняшней."""
    if registered:
        return history
    now = now or datetime.now(timezone.utc)
    limit = now - timedelta(minutes=SESSION_GAP_MINUTES)
    out = []
    for m in history:
        ts = _parse_ts(m.get("created_at"))
        if ts is not None and ts >= limit:
            out.append(m)
    return out


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
