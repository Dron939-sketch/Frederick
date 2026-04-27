#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_brand_audit.py
Аудит VK-страницы юзера в контексте его архетипа бренда.

Не путать с vk_b2c_analyzer/vk_mirror_pitch — те делают «outreach»-питчи
(найти боль → крючок). Здесь — self-reflection: насколько мой VK
сегодня бьётся с моим внутренним архетипом + куда вести.

Pipeline:
  1. analyze_profile(url) — re-use 3-pass from vk_b2c_analyzer (профиль + боль).
     hooks НЕ используем (они для аутрича).
  2. Brand-alignment LLM-вызов:
       - internal_archetype (с теста: SAGE/HERO/...)
       - target_archetype (если юзер выбрал трансформацию)
       - vk_archetype (что показал analyze_profile)
       - vk_summary, defenses, patterns, недавние посты
     → JSON: alignment_score, what_works, what_hurts,
              recommendations, sample_post, summary.

Задержка: 30-60 сек (3 LLM-вызова в analyze_profile + 1 здесь).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

from vk_b2c_analyzer import analyze_profile

logger = logging.getLogger(__name__)


DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT_S = 60.0


_ARCHETYPE_RU = {
    "INNOCENT": "Невинный", "SAGE": "Мудрец", "EXPLORER": "Искатель",
    "HERO": "Герой", "OUTLAW": "Бунтарь", "MAGICIAN": "Маг",
    "LOVER": "Любовник", "JESTER": "Шут", "EVERYMAN": "Свой парень",
    "CREATOR": "Творец", "RULER": "Правитель", "CAREGIVER": "Заботливый",
}


_AUDIT_SYSTEM = (
    "Ты — бренд-стратег с экспертизой по архетипам Марк-Пирсон. На вход — "
    "три архетипа человека и анализ его VK-страницы. Твоя задача — оценить, "
    "насколько публичный канал бьётся с целевым архетипом, и дать "
    "конкретные рекомендации.\n\n"
    "Архетипы (12 по Марк-Пирсон):\n"
    "  INNOCENT (Невинный), SAGE (Мудрец), EXPLORER (Искатель),\n"
    "  HERO (Герой), OUTLAW (Бунтарь), MAGICIAN (Маг),\n"
    "  LOVER (Любовник), JESTER (Шут), EVERYMAN (Свой парень),\n"
    "  CREATOR (Творец), RULER (Правитель), CAREGIVER (Заботливый).\n\n"
    "ВХОДЯТ:\n"
    "  • internal_archetype — что показал психо-тест (внутренний архетип).\n"
    "  • target_archetype — куда юзер хочет вести бренд (если задано).\n"
    "    Если не задано — равен internal_archetype.\n"
    "  • vk_archetype — что выдал AI-анализ страницы (внешний архетип).\n"
    "  • профиль человека из VK + защиты + паттерны + цитаты постов.\n\n"
    "ЗАДАЧИ:\n"
    "  1. alignment_score 0-100: насколько VK читается как target_archetype.\n"
    "     ≥75 = бьётся, 50-74 = частично, <50 = большой разрыв.\n"
    "  2. what_works: 2-3 наблюдения «вот это работает на target_archetype». "
    "     С цитатами или ссылкой на конкретные посты/элементы.\n"
    "  3. what_hurts: 2-3 наблюдения «вот это противоречит target_archetype».\n"
    "  4. recommendations: 3-5 КОНКРЕТНЫХ рекомендаций. Не «будьте искренни», "
    "     а «опубликуй 1 длинный пост-разбор кейса в неделю — это движок SAGE».\n"
    "  5. sample_post: один готовый пост 200-400 символов в тоне target_archetype, "
    "     на тему которая близка человеку (по его профилю).\n"
    "  6. summary: 1-2 предложения общего вывода.\n\n"
    "Тон: уважительный, на «ты», без штампов «увеличит вовлечённость» / "
    "«х10 органики». Конкретно и по сути.\n\n"
    "Возвращай JSON:\n"
    "{\n"
    "  \"alignment_score\": 35,\n"
    "  \"alignment_label\": \"большой разрыв|частично|бьётся\",\n"
    "  \"vk_archetype\": \"JESTER\",\n"
    "  \"target_archetype\": \"SAGE\",\n"
    "  \"what_works\": [\n"
    "    {\"observation\": \"...\", \"quote\": \"...\"},\n"
    "    ...\n"
    "  ],\n"
    "  \"what_hurts\": [\n"
    "    {\"observation\": \"...\", \"quote\": \"...\"},\n"
    "    ...\n"
    "  ],\n"
    "  \"recommendations\": [\n"
    "    \"конкретная рекомендация 1\",\n"
    "    ...\n"
    "  ],\n"
    "  \"sample_post\": \"готовый пост 200-400 символов\",\n"
    "  \"summary\": \"общий вывод 1-2 предложения\"\n"
    "}\n"
    "Без markdown."
)


def _norm_archetype(code: Optional[str]) -> str:
    if not code:
        return ""
    c = str(code).strip().upper()
    return c if c in _ARCHETYPE_RU else ""


def _format_for_audit(analysis: Dict[str, Any]) -> str:
    """Подготовить компактный текст-сводку для LLM."""
    profile = analysis.get("profile") or {}
    pain = analysis.get("pain") or {}
    vk_data = analysis.get("vk_data") or {}
    user = vk_data.get("user_basic") or {}
    wall = vk_data.get("wall") or {}

    parts: List[str] = []
    name = " ".join(filter(None, [user.get("first_name"), user.get("last_name")])).strip()
    parts.append(f"Имя: {name or '—'}")
    if user.get("status"):
        parts.append(f"Статус-шапка: «{user['status'][:200]}»")
    if user.get("about"):
        parts.append(f"О себе: «{user['about'][:400]}»")

    parts.append("")
    parts.append(f"VK-архетип (по AI): {profile.get('archetype') or '—'}")
    parts.append(f"Открытость: {profile.get('openness') or '—'}")
    if profile.get("profile"):
        parts.append(f"Портрет: {profile['profile']}")
    if profile.get("defenses"):
        parts.append(f"Защиты: {', '.join(profile['defenses'])}")
    if profile.get("patterns"):
        parts.append(f"Паттерны: {', '.join(profile['patterns'])}")

    if pain.get("pain_active"):
        parts.append("")
        parts.append(f"Активная боль ({pain.get('pain_intensity') or '—'}): {pain['pain_active']}")
        for q in (pain.get("evidence_quotes") or [])[:2]:
            parts.append(f"  цитата: «{q}»")
        if pain.get("desired_outcome"):
            parts.append(f"Хочет: {pain['desired_outcome']}")

    items = (wall or {}).get("items") or []
    if items:
        parts.append("")
        parts.append(f"Последние {min(len(items), 15)} постов:")
        for p in items[:15]:
            t = (p.get("text") or "").strip()
            if t:
                parts.append(f"- {t[:240]}")

    return "\n".join(parts)


async def _llm_audit(
    internal_arch: str,
    target_arch: str,
    analysis: Dict[str, Any],
) -> Dict[str, Any]:
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return {"error": "no_api_key"}

    user_msg = (
        f"internal_archetype: {internal_arch} ({_ARCHETYPE_RU.get(internal_arch, '?')})\n"
        f"target_archetype: {target_arch} ({_ARCHETYPE_RU.get(target_arch, '?')})\n"
        f"vk_archetype: {(analysis.get('profile') or {}).get('archetype') or '—'}\n"
        f"\n=== Данные из VK ===\n"
        f"{_format_for_audit(analysis)}"
    )
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": _AUDIT_SYSTEM},
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
        return json.loads(content)
    except Exception as e:
        logger.warning(f"vk_brand_audit LLM failed: {e}")
        return {"error": str(e)}


async def run_audit(
    url_or_screen: str,
    internal_archetype: str,
    target_archetype: Optional[str] = None,
) -> Dict[str, Any]:
    """Полный audit: парсинг VK + brand-alignment LLM-вызов.

    Returns {audit, analysis_preview, vk_url, error?}.
    """
    internal = _norm_archetype(internal_archetype)
    if not internal:
        return {"error": "internal_archetype_required"}
    target = _norm_archetype(target_archetype) or internal

    # 1. Парсим VK + 3-pass.
    try:
        analysis = await analyze_profile(url_or_screen)
    except Exception as e:
        logger.warning(f"brand_audit analyze_profile failed: {e}")
        return {"error": "analysis_failed", "message": str(e)}
    if analysis.get("error"):
        return {"error": analysis["error"], "details": analysis}

    # 2. Brand-alignment.
    audit = await _llm_audit(internal, target, analysis)
    if audit.get("error"):
        return {"error": "audit_llm_failed", "message": audit["error"]}

    # Гарантируем заполнение архетипов в выдаче (LLM мог их не записать).
    audit.setdefault("internal_archetype", internal)
    audit.setdefault("target_archetype", target)
    audit.setdefault("vk_archetype", (analysis.get("profile") or {}).get("archetype") or "")

    # Метки RU для удобства фронта.
    audit["internal_archetype_ru"] = _ARCHETYPE_RU.get(audit["internal_archetype"], "")
    audit["target_archetype_ru"] = _ARCHETYPE_RU.get(audit["target_archetype"], "")
    audit["vk_archetype_ru"] = _ARCHETYPE_RU.get(
        _norm_archetype(audit.get("vk_archetype")), ""
    )

    return {
        "audit": audit,
        "vk_url": analysis.get("vk_url") or "",
        "vk_data_summary": {
            "name": " ".join(filter(None, [
                ((analysis.get("vk_data") or {}).get("user_basic") or {}).get("first_name") or "",
                ((analysis.get("vk_data") or {}).get("user_basic") or {}).get("last_name") or "",
            ])).strip(),
            "wall_count": (analysis.get("vk_data") or {}).get("wall_count") or 0,
            "groups_count": (analysis.get("vk_data") or {}).get("groups_count") or 0,
        },
    }
