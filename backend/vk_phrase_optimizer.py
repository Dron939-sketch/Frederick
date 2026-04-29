#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_phrase_optimizer.py
Самокоррекция фраз поиска по проблеме.

Идея:
  • Каждый запуск search_by_problem пишет в БД, сколько постов вернула фраза
    (posts_seen) и сколько кандидатов из неё прошли фильтр (candidates_yielded).
  • Когда оператор кликает «🧠 Скорректировать фразы», мы читаем статистику
    и просим DeepSeek:
      - предложить новые фразы, похожие на топ-перформеры
      - удалить тех, что не дают кандидатов или слишком общие
  • Применённые фразы сохраняются в `fredi_vk_phrase_overrides` и используются
    при следующих поисках вместо seed_search_phrases из кода.

Вход для DeepSeek-оптимизатора:
  • категория (name_ru, audience_brief, pain_hint)
  • текущие фразы с их перформансом
  • короткий конспект какие фразы дают «постов 200+, кандидатов 0» (общие/мусорные)
    и какие «50 постов, 12 кандидатов» (точные).

DeepSeek возвращает строгий JSON с keep / drop / suggested + reasoning.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

from services.problem_categories import get_category

logger = logging.getLogger(__name__)

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT_S = 60.0


SYSTEM_PROMPT = (
    "Ты — оптимизатор поисковых фраз для русскоязычного VK. На вход дают категорию "
    "(описание аудитории и боли) и текущий список фраз с их статистикой:\n"
    "  • posts_seen — сколько постов нашлось\n"
    "  • candidates_yielded — сколько живых людей прошли фильтр\n"
    "  • drafts_made — для скольких из них оператор сгенерил черновик сообщения\n"
    "    (САМЫЙ СИЛЬНЫЙ сигнал: оператор счёл кандидата стоящим — значит фраза\n"
    "    нашла реально подходящих людей)\n\n"
    "Твоя задача:\n"
    "  • drop — фразы с posts_seen ≥ 30, но candidates_yielded ≤ 1: они слишком "
    "    общие, ловят мусор. Или posts_seen ≤ 1: вообще не работают. Или\n"
    "    candidates_yielded ≥ 5, но drafts_made = 0 после нескольких прогонов:\n"
    "    кандидаты есть, но не цепляют — фраза попадает не в ту аудиторию.\n"
    "  • keep — фразы с разумной конверсией постов→кандидатов и (особенно)\n"
    "    с drafts_made > 0.\n"
    "  • suggested — 4–8 НОВЫХ фраз, на которые можно ловить ту же аудиторию.\n"
    "    Опирайся на топ-перформеров (особенно по drafts_made) — что у них\n"
    "    общего? Это должны быть РЕАЛЬНЫЕ фразы из бытовой русской речи: то, что\n"
    "    человек в этом состоянии действительно пишет в посте/комменте VK.\n"
    "    Без терминов, без мотивационных штампов. Длина 3–7 слов.\n\n"
    "ФОРМАТ ВЫХОДА (строгий JSON, без markdown, без префиксов):\n"
    "{\n"
    "  \"keep\":      [\"фраза 1\", \"фраза 2\", ...],\n"
    "  \"drop\":      [\"фраза 3\", \"фраза 4\", ...],\n"
    "  \"suggested\": [\"новая фраза 1\", \"новая фраза 2\", ...],\n"
    "  \"reasoning\": \"одно-два предложения для оператора\"\n"
    "}\n"
)


def _build_user_message(
    category_meta: Dict[str, Any],
    perf_rows: List[Dict[str, Any]],
) -> str:
    name = category_meta.get("name_ru") or category_meta.get("code")
    audience = category_meta.get("audience_brief") or ""
    pain = category_meta.get("pain_hint") or ""

    lines: List[str] = [
        f"Категория: {name}",
        f"Аудитория: {audience}",
        f"Боль: {pain}",
        "",
        "Текущие фразы и их перформанс:",
    ]
    if not perf_rows:
        lines.append("(нет статистики — поиск ещё не запускался для этих фраз)")
    for r in perf_rows:
        phrase = r.get("phrase")
        posts = r.get("posts_seen") or 0
        cands = r.get("candidates_yielded") or 0
        used = r.get("times_used") or 0
        drafts = r.get("drafts_made") or 0
        ratio = f"{(cands * 100 / posts):.0f}%" if posts else "—"
        lines.append(
            f"  • «{phrase}» — постов {posts}, кандидатов {cands}, "
            f"черновиков {drafts} ({ratio} конверсия), запусков {used}"
        )
    lines.append("\nВерни JSON по схеме.")
    return "\n".join(lines)


# ============================================================
# Перфоманс-трекинг (увеличиваем счётчики после каждого поиска)
# ============================================================

async def track_phrase_performance(
    db, category: str,
    phrase_perf: Dict[str, Dict[str, int]],
) -> None:
    """phrase_perf: {phrase: {posts_seen: int, candidates_yielded: int}}.

    Использует UPSERT: если строки нет — создаётся, иначе суммируются счётчики.
    """
    if not phrase_perf:
        return
    async with db.get_connection() as conn:
        for phrase, stat in phrase_perf.items():
            ps = int(stat.get("posts_seen") or 0)
            cy = int(stat.get("candidates_yielded") or 0)
            await conn.execute(
                """
                INSERT INTO fredi_vk_phrase_perf
                    (category, phrase, times_used, posts_seen,
                     candidates_yielded, last_used_at)
                VALUES ($1, $2, 1, $3, $4, NOW())
                ON CONFLICT (category, phrase) DO UPDATE SET
                    times_used = fredi_vk_phrase_perf.times_used + 1,
                    posts_seen = fredi_vk_phrase_perf.posts_seen + EXCLUDED.posts_seen,
                    candidates_yielded = fredi_vk_phrase_perf.candidates_yielded + EXCLUDED.candidates_yielded,
                    last_used_at = NOW()
                """,
                category, phrase, ps, cy,
            )


async def track_drafts_made(db, category: str, phrase: str) -> None:
    """+1 к drafts_made для фразы. Вызывается после успешного draft-by-problem.

    Это самый сильный сигнал «эта фраза даёт людей, которым реально хочется
    написать сообщение». Phrase optimizer учитывает этот счётчик при выборе
    keep/drop.
    """
    if not category or not phrase:
        return
    async with db.get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO fredi_vk_phrase_perf
                (category, phrase, times_used, posts_seen, candidates_yielded,
                 drafts_made, last_used_at)
            VALUES ($1, $2, 0, 0, 0, 1, NOW())
            ON CONFLICT (category, phrase) DO UPDATE SET
                drafts_made = fredi_vk_phrase_perf.drafts_made + 1,
                last_used_at = NOW()
            """,
            category, phrase,
        )


# ============================================================
# Чтение/запись overrides
# ============================================================

async def get_active_phrases(db, category: str) -> Optional[List[str]]:
    """Если для категории применён override — возвращаем его.
    Иначе None (вызывающий код возьмёт seed_search_phrases из кода)."""
    async with db.get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT phrases FROM fredi_vk_phrase_overrides WHERE category = $1",
            category,
        )
    if not row:
        return None
    raw = row["phrases"]
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return None
    if isinstance(data, list):
        return [str(p).strip() for p in data if str(p).strip()]
    return None


async def save_override(db, category: str, phrases: List[str], suggested_by: str = "auto") -> None:
    cleaned = [str(p).strip() for p in phrases if str(p).strip()]
    if not cleaned:
        return
    async with db.get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO fredi_vk_phrase_overrides (category, phrases, suggested_by, updated_at)
            VALUES ($1, $2::jsonb, $3, NOW())
            ON CONFLICT (category) DO UPDATE SET
                phrases = EXCLUDED.phrases,
                suggested_by = EXCLUDED.suggested_by,
                updated_at = NOW()
            """,
            category, json.dumps(cleaned, ensure_ascii=False), suggested_by,
        )


# ============================================================
# Оптимизатор (вызывает DeepSeek)
# ============================================================

async def optimize_phrases(db, category: str) -> Dict[str, Any]:
    """Возвращает {category, current_phrases, perf, keep, drop, suggested, reasoning}.
    Не применяет — оператор смотрит и решает (применяется через save_override)."""
    cat_meta = get_category(category)
    if not cat_meta:
        return {"error": "unknown_category", "category": category}

    # Текущие фразы — override > seed_search_phrases
    override = await get_active_phrases(db, category)
    current = override if override is not None else (cat_meta.get("seed_search_phrases") or [])

    # Перфоманс по этим фразам
    async with db.get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT phrase, times_used, posts_seen, candidates_yielded,
                   drafts_made, last_used_at
            FROM fredi_vk_phrase_perf
            WHERE category = $1
            ORDER BY (CASE WHEN posts_seen > 0
                            THEN candidates_yielded::float / posts_seen
                            ELSE 0 END) DESC
            """,
            category,
        )
    perf_by_phrase = {r["phrase"]: dict(r) for r in rows}
    perf_rows = [
        {
            "phrase": p,
            "posts_seen": (perf_by_phrase.get(p) or {}).get("posts_seen", 0),
            "candidates_yielded": (perf_by_phrase.get(p) or {}).get("candidates_yielded", 0),
            "drafts_made": (perf_by_phrase.get(p) or {}).get("drafts_made", 0),
            "times_used": (perf_by_phrase.get(p) or {}).get("times_used", 0),
        }
        for p in current
    ]

    # DeepSeek
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return {
            "category": category,
            "current_phrases": current,
            "perf": perf_rows,
            "error": "deepseek_unavailable",
            "message": "DEEPSEEK_API_KEY не задан в env",
        }

    user_msg = _build_user_message(cat_meta, perf_rows)
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            r = await client.post(
                DEEPSEEK_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        body = r.json()
        content = body["choices"][0]["message"]["content"]
        try:
            import asyncio as _aio
            from services.api_usage import log_llm_usage, extract_deepseek_tokens
            tk = extract_deepseek_tokens(body)
            _aio.create_task(log_llm_usage(
                provider="deepseek", model="deepseek-chat",
                tokens_in=tk["tokens_in"], tokens_out=tk["tokens_out"],
                feature="phrase_optimizer.suggest",
            ))
        except Exception:
            pass
        result = json.loads(content)
    except Exception as e:
        logger.warning(f"phrase optimizer DeepSeek call failed: {e}")
        return {
            "category": category,
            "current_phrases": current,
            "perf": perf_rows,
            "error": "deepseek_error",
            "message": str(e),
        }

    keep = [str(p).strip() for p in (result.get("keep") or []) if str(p).strip()]
    drop = [str(p).strip() for p in (result.get("drop") or []) if str(p).strip()]
    suggested = [str(p).strip() for p in (result.get("suggested") or []) if str(p).strip()]
    reasoning = result.get("reasoning") or ""

    # Финальный новый список = keep + suggested. drop отдаём для UI-диффа.
    proposed = list(dict.fromkeys(keep + suggested))[:12]  # дедуп, потолок 12

    return {
        "category": category,
        "current_phrases": current,
        "perf": perf_rows,
        "keep": keep,
        "drop": drop,
        "suggested": suggested,
        "proposed": proposed,
        "reasoning": reasoning,
    }
