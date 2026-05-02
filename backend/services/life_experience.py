#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/services/life_experience.py

«Жизненный опыт» Фреди для BasicMode + «интуиция» для подмешивания
в системный промпт. Дешёвая схема, рассчитанная на экономию API:

  • Раз в сутки крон забирает все BasicMode-диалоги за прошедшие 24ч,
    делает ОДИН Anthropic-вызов и извлекает повторяющиеся паттерны
    (тема, ключи-триггеры, наблюдение, что сработало, что не сработало).
    Результат UPSERT в fredi_life_experience.

  • На каждом сообщении BasicMode мы НЕ ходим в LLM повторно: матчинг
    идёт по ключевым словам поверх кэша паттернов в памяти (TTL 1ч).
    Топ-2-3 паттерна склеиваются в короткий блок «ИНТУИЦИЯ» и подаются
    в системный промпт основного LLM-вызова. Стоимость: +~300 токенов
    на ответ, никаких дополнительных запросов.

main.py:
  - вызывает set_db(db) после инициализации Database
  - один раз в сутки в фоне дёргает run_daily_aggregation()
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ============================================================
# DDL — создаётся из main.init_database()
# ============================================================

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS fredi_life_experience (
    id BIGSERIAL PRIMARY KEY,
    theme TEXT NOT NULL,
    trigger_keywords TEXT[] NOT NULL,
    observation TEXT NOT NULL,
    successful_move TEXT DEFAULT '',
    fail_move TEXT DEFAULT '',
    sample_count INT DEFAULT 1,
    success_rate REAL DEFAULT 0.5,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
)
"""

CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_fredi_life_experience_kw
ON fredi_life_experience USING GIN (trigger_keywords)
"""


# ============================================================
# DB handle — main.py вызовет set_db(db)
# ============================================================

_db_module = None


def set_db(db_module) -> None:
    global _db_module
    _db_module = db_module


# ============================================================
# In-memory кэш паттернов (для runtime-интуиции).
# ============================================================

_PATTERN_CACHE: List[Dict[str, Any]] = []
_CACHE_LOADED_AT: Optional[datetime] = None
_CACHE_TTL_SEC = 3600  # 1 час


def _invalidate_cache() -> None:
    global _CACHE_LOADED_AT, _PATTERN_CACHE
    _PATTERN_CACHE = []
    _CACHE_LOADED_AT = None


# ============================================================
# DAILY AGGREGATION — один LLM-вызов в сутки.
# ============================================================

async def run_daily_aggregation(max_dialogs: int = 30, max_msgs_per_dialog: int = 20) -> int:
    """Агрегирует BasicMode-диалоги за последние 24ч в паттерны.
    Возвращает число upsert'нутых паттернов. Безопасно к повторному вызову.
    """
    if _db_module is None:
        logger.warning("life_experience: db not initialized — skip aggregation")
        return 0

    try:
        rows = await _fetch_yesterday_dialogs(max_dialogs, max_msgs_per_dialog)
        if not rows:
            logger.info("life_experience: no basic dialogs in last 24h — skip")
            return 0

        prompt = _build_aggregation_prompt(rows)

        from services.anthropic_client import call_anthropic, is_available
        if not is_available():
            logger.warning("life_experience: ANTHROPIC_API_KEY missing — abort")
            return 0

        raw = await call_anthropic(prompt, max_tokens=2000, temperature=0.3)
        if not raw:
            logger.warning("life_experience: LLM returned empty")
            return 0

        patterns = _parse_patterns(raw)
        if not patterns:
            logger.warning(f"life_experience: failed to parse patterns from: {raw[:300]}")
            return 0

        upserted = await _upsert_patterns(patterns)
        _invalidate_cache()
        logger.info(f"🧠 life_experience: {upserted} patterns upserted from {len(rows)} dialogs")
        return upserted

    except Exception as e:
        logger.error(f"life_experience.run_daily_aggregation failed: {e}")
        return 0


async def _fetch_yesterday_dialogs(max_dialogs: int, max_msgs: int) -> List[Dict]:
    """Берёт юзеров с >=4 сообщениями BasicMode за 24ч; собирает их в массивы."""
    async with _db_module.get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT user_id,
                   array_agg(json_build_object(
                       'role', role, 'content', content
                   ) ORDER BY created_at) AS msgs
            FROM fredi_messages
            WHERE created_at >= NOW() - INTERVAL '24 hours'
              AND COALESCE(metadata->>'mode', '') = 'basic'
            GROUP BY user_id
            HAVING COUNT(*) >= 4
            ORDER BY MAX(created_at) DESC
            LIMIT $1
            """,
            max_dialogs,
        )

    out = []
    for r in rows:
        msgs = r["msgs"] or []
        if isinstance(msgs, str):
            try:
                msgs = json.loads(msgs)
            except Exception:
                msgs = []
        normalized = []
        for m in msgs[:max_msgs]:
            if isinstance(m, str):
                try:
                    m = json.loads(m)
                except Exception:
                    continue
            normalized.append({
                "role": m.get("role"),
                "content": (m.get("content") or "")[:280],
            })
        if normalized:
            out.append({"user_id": r["user_id"], "msgs": normalized})
    return out


def _build_aggregation_prompt(rows: List[Dict]) -> str:
    blocks = []
    for r in rows:
        lines = []
        for m in r["msgs"]:
            role = "U" if m["role"] == "user" else "F"
            lines.append(f"{role}: {m['content']}")
        blocks.append(f"--- DIALOG {r['user_id']} ---\n" + "\n".join(lines))

    return (
        "Ты — аналитик диалогов виртуального собеседника Фреди (базовый режим).\n"
        "Ниже подборка диалогов за сутки. Найди до 8 ПОВТОРЯЮЩИХСЯ паттернов\n"
        "типичных запросов и удачных/неудачных ходов Фреди.\n\n"
        "ДЛЯ КАЖДОГО ПАТТЕРНА верни JSON-объект:\n"
        '  "theme": тема одной фразой (например: «отношения», «выгорание», '
        '«страх перед руководителем»),\n'
        '  "trigger_keywords": [4-8 ключевых слов или корней в нижнем регистре, '
        'по которым этот паттерн узнаётся в тексте юзера],\n'
        '  "observation": что обычно стоит за такой жалобой (1-2 предложения),\n'
        '  "successful_move": какой ход Фреди в этих диалогах работал '
        '(1 предложение),\n'
        '  "fail_move": какой ход НЕ работал или вызывал отписку (1 предложение).\n\n'
        "СИГНАЛ УСПЕХА: после ответа Фреди юзер пишет содержательную (>50 символов) "
        "реплику или продолжает диалог.\n"
        "СИГНАЛ ПРОВАЛА: юзер отвечает односложно или прерывает разговор.\n\n"
        "ВАЖНО: верни ТОЛЬКО JSON-массив объектов. Без markdown, без пояснений.\n\n"
        "ДИАЛОГИ:\n\n" + "\n\n".join(blocks)
    )


def _parse_patterns(raw: str) -> List[Dict]:
    """Best-effort извлечение JSON-массива из ответа LLM."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    m = re.search(r"\[\s*\{.*\}\s*\]", raw, re.DOTALL)
    text = m.group(0) if m else raw
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
    except Exception:
        return []
    return []


async def _upsert_patterns(patterns: List[Dict]) -> int:
    upserted = 0
    async with _db_module.get_connection() as conn:
        for p in patterns:
            try:
                theme = (p.get("theme") or "").strip()[:200]
                kws = p.get("trigger_keywords") or []
                kws = [str(k).strip().lower() for k in kws if k]
                kws = [k for k in kws if 2 <= len(k) <= 60][:10]
                observation = (p.get("observation") or "").strip()[:600]
                successful = (p.get("successful_move") or "").strip()[:300]
                failed = (p.get("fail_move") or "").strip()[:300]
                if not theme or not kws or not observation:
                    continue

                # Слияние: тот же theme + пересечение по ключам.
                existing = await conn.fetchrow(
                    """
                    SELECT id FROM fredi_life_experience
                    WHERE theme = $1 AND trigger_keywords && $2::text[]
                    ORDER BY sample_count DESC
                    LIMIT 1
                    """,
                    theme, kws,
                )
                if existing:
                    await conn.execute(
                        """
                        UPDATE fredi_life_experience
                        SET sample_count = sample_count + 1,
                            last_seen_at = NOW(),
                            trigger_keywords = (
                                SELECT array_agg(DISTINCT k)
                                FROM unnest(trigger_keywords || $2::text[]) AS k
                            ),
                            observation = $3,
                            successful_move = $4,
                            fail_move = $5
                        WHERE id = $1
                        """,
                        existing["id"], kws, observation, successful, failed,
                    )
                else:
                    await conn.execute(
                        """
                        INSERT INTO fredi_life_experience
                        (theme, trigger_keywords, observation,
                         successful_move, fail_move)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        theme, kws, observation, successful, failed,
                    )
                upserted += 1
            except Exception as e:
                logger.warning(f"life_experience upsert one failed: {e}")
    return upserted


# ============================================================
# RUNTIME INTUITION — без LLM, по in-memory кэшу.
# ============================================================

async def _ensure_cache() -> None:
    global _CACHE_LOADED_AT, _PATTERN_CACHE
    if _db_module is None:
        return
    now = datetime.now(timezone.utc)
    if (
        _CACHE_LOADED_AT
        and (now - _CACHE_LOADED_AT).total_seconds() < _CACHE_TTL_SEC
        and _PATTERN_CACHE
    ):
        return
    try:
        async with _db_module.get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT theme, trigger_keywords, observation,
                       successful_move, fail_move, sample_count
                FROM fredi_life_experience
                WHERE sample_count >= 1
                ORDER BY sample_count DESC, last_seen_at DESC
                LIMIT 100
                """
            )
        _PATTERN_CACHE = [
            {
                "theme": r["theme"],
                "trigger_keywords": list(r["trigger_keywords"] or []),
                "observation": r["observation"],
                "successful_move": r["successful_move"] or "",
                "fail_move": r["fail_move"] or "",
                "sample_count": r["sample_count"] or 1,
            }
            for r in rows
        ]
        _CACHE_LOADED_AT = now
    except Exception as e:
        logger.warning(f"life_experience cache load failed: {e}")
        _PATTERN_CACHE = []
        _CACHE_LOADED_AT = now  # не дёргаем БД на каждом сообщении


def _score(message_lower: str, keywords: List[str]) -> int:
    return sum(1 for k in keywords if k and k in message_lower)


async def find_relevant_patterns(user_message: str, top_n: int = 3) -> List[Dict]:
    """Возвращает топ-N паттернов из кэша, которые матчатся по сообщению.
    Без LLM-вызовов, без сетевых походов кроме первой загрузки кэша.
    """
    if not user_message:
        return []
    await _ensure_cache()
    if not _PATTERN_CACHE:
        return []
    msg_lower = user_message.lower()
    scored = []
    for p in _PATTERN_CACHE:
        s = _score(msg_lower, p.get("trigger_keywords") or [])
        if s > 0:
            scored.append((s, p))
    scored.sort(key=lambda x: (-x[0], -int(x[1].get("sample_count") or 0)))
    return [p for _, p in scored[:top_n]]


def format_for_prompt(patterns: List[Dict]) -> str:
    """Формат «ИНТУИЦИЯ» для системного промпта BasicMode.
    Пустая строка, если паттернов нет."""
    if not patterns:
        return ""
    lines = [
        "ИНТУИЦИЯ ИЗ ОПЫТА (по похожим разговорам — учитывай, не цитируй):"
    ]
    for p in patterns:
        theme = p.get("theme") or ""
        obs = (p.get("observation") or "").strip()
        succ = (p.get("successful_move") or "").strip()
        fail = (p.get("fail_move") or "").strip()
        line = f"— {theme}. Наблюдение: {obs}"
        if succ:
            line += f" Срабатывает: {succ}"
        if fail:
            line += f" Не работает: {fail}"
        lines.append(line)
    return "\n".join(lines) + "\n\n"


# ============================================================
# Admin helpers (для будущей вкладки в /admin-analytics).
# ============================================================

async def list_patterns(limit: int = 50) -> List[Dict]:
    if _db_module is None:
        return []
    try:
        async with _db_module.get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT id, theme, trigger_keywords, observation,
                       successful_move, fail_move, sample_count,
                       last_seen_at, created_at
                FROM fredi_life_experience
                ORDER BY last_seen_at DESC
                LIMIT $1
                """,
                limit,
            )
        return [
            {
                "id": r["id"],
                "theme": r["theme"],
                "trigger_keywords": list(r["trigger_keywords"] or []),
                "observation": r["observation"],
                "successful_move": r["successful_move"],
                "fail_move": r["fail_move"],
                "sample_count": r["sample_count"],
                "last_seen_at": r["last_seen_at"].isoformat() if r["last_seen_at"] else None,
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
    except Exception as e:
        logger.warning(f"list_patterns failed: {e}")
        return []
