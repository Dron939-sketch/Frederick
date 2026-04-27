#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_problem_reranker.py
Финальный LLM-фильтр для поиска по проблемной категории.

Зачем:
  Эвристики (brightness + provider/narrative penalty) дошли до потолка.
  Они отлично режут явный мусор (психологов с регалиями, художественные
  рассказы, блог-форматы), но не отличают «настоящего страдальца» от
  «пишет в блоге про чужое страдание» когда текст граничный.

  Решение: после эвристик берём топ-30 кандидатов и ОДНИМ запросом к DeepSeek
  спрашиваем «оцени каждый текст 0..100 — реально ли автор страдает от
  <категории> прямо сейчас». DeepSeek возвращает массив с per-кандидат
  оценками + короткими причинами. Сортируем по этой оценке, режем до
  max_candidates.

  Это полная замена эвристик: после rerank brightness уходит на второй план,
  главным становится `rerank_score`. Эвристики остаются как pre-filter
  чтобы не гонять LLM на 200 кандидатов — только на отобранные.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List

import httpx

logger = logging.getLogger(__name__)

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT_S = 60.0


SYSTEM_PROMPT = (
    "Ты — финальный отборщик кандидатов для сервиса «Фреди» (бесплатный "
    "ИИ-психолог). Тебе дают набор VK-постов и СТРОГО ОДНУ конкретную проблемную "
    "категорию (выгорание на работе / тревога-паника / одиночество и поиск пары / и т.д.).\n\n"
    "Задача: для КАЖДОГО кандидата оцени 0..100 — насколько вероятно, что автор поста "
    "ПРЯМО СЕЙЧАС САМ страдает ИМЕННО от ЭТОЙ КОНКРЕТНОЙ категории. Не «страдает в принципе», "
    "не «выглядит грустно», а попадает РОВНО в эту боль.\n\n"
    "ОБЯЗАТЕЛЬНОЕ ПРАВИЛО: Каждая категория имеет «not_this» — что НЕ считается этой категорией. "
    "Если боль человека описана словами из not_this — оценка ≤25, даже если эмоция очень сильная. "
    "Депрессия и выгорание на работе — это РАЗНЫЕ категории. Расставание и одиночество — РАЗНЫЕ. "
    "«Хочу в гроб» и «ненавижу свою работу» — это разные боли.\n\n"
    "ВЫСОКАЯ ОЦЕНКА (70-100):\n"
    "  • Текст от первого лица С КОНКРЕТНЫМИ ПРИЗНАКАМИ ЭТОЙ категории.\n"
    "  • Для «выгорания на работе» — упоминание работы/коллег/уволиться/офис/босс/понедельник.\n"
    "  • Для «тревоги» — паника, бессонница, сердце, дрожь.\n"
    "  • Для «расставания» — упоминание бывшего, разрыва, не отпускает.\n"
    "  • Эмоция «здесь и сейчас», не обобщения.\n\n"
    "НИЗКАЯ ОЦЕНКА (0-30):\n"
    "  • Психолог/коуч/таролог про чужих клиентов.\n"
    "  • Художественный рассказ (диалоги, имена-персонажи).\n"
    "  • Блог-формат («5 правил», список советов).\n"
    "  • Реклама, продажа книги/курса.\n"
    "  • Цитаты знаменитостей, общие рассуждения.\n"
    "  • БОЛЬ ИЗ ДРУГОЙ КАТЕГОРИИ (см. not_this во входе).\n\n"
    "СРЕДНЯЯ (30-70):\n"
    "  • Текст про себя, но без упоминания конкретной категории.\n"
    "  • Эмоция есть, но размытая.\n\n"
    "Возвращай СТРОГО JSON по схеме:\n"
    "{\n"
    "  \"results\": [\n"
    "    {\"id\": 0, \"score\": 85, \"reason\": \"коротко почему\"},\n"
    "    ...\n"
    "  ]\n"
    "}\n"
    "id — это номер кандидата из входа (0-индекс). reason — короткое объяснение.\n"
    "Никакого markdown."
)


def _build_user_message(category_meta: Dict[str, Any], candidates: List[Dict[str, Any]]) -> str:
    name = category_meta.get("name_ru") or category_meta.get("code")
    audience = category_meta.get("audience_brief") or ""
    pain = category_meta.get("pain_hint") or ""
    not_this = category_meta.get("not_this") or []

    blocks: List[str] = [
        f"=== КАТЕГОРИЯ: {name} ===",
        f"Аудитория: {audience}",
        f"Боль: {pain}",
    ]
    if not_this:
        blocks.append(
            "ЭТО НЕ НАША КАТЕГОРИЯ (даже если эмоция сильная — оценка ≤25):"
        )
        for nt in not_this:
            blocks.append(f"  • {nt}")
    blocks.append("")
    blocks.append(f"=== {len(candidates)} КАНДИДАТОВ ===")
    for i, c in enumerate(candidates):
        about = (c.get("about") or "").strip()[:150]
        status = (c.get("status") or "").strip()[:100]
        post = ((c.get("triggering_post") or {}).get("text") or "")[:400]
        comment = ((c.get("triggering_comment") or {}).get("text") or "")[:300]
        anchor = c.get("anchor") or {}
        src = c.get("source") or ""
        blocks.append(f"\n--- id={i} ({c.get('full_name', '?')}) source={src} ---")
        if about:
            blocks.append(f"about: «{about}»")
        if status:
            blocks.append(f"status: «{status}»")
        if comment:
            blocks.append(f"comment: «{comment}»")
        # Если кандидат — лайкер/репостер маркетингового поста, дадим LLM
        # текст самого якорного поста и тип действия. Рерэнкер должен
        # понимать: «человек ничего не пишет, но он лайкнул пост про
        # выгорание у которого 500 лайков» — это сигнал «узнал себя».
        if anchor.get("post_excerpt"):
            action_label = (
                "лайкнул" if anchor.get("action") == "like" else "репостнул"
            )
            blocks.append(
                f"{action_label} пост (engagement={anchor.get('engagement', 0)}): "
                f"«{anchor.get('post_excerpt', '')[:300]}»"
            )
        if post:
            blocks.append(f"post: «{post}»")
        if not (about or status or post or comment):
            blocks.append("(нет текстовых данных)")
    blocks.append("\nВерни JSON по схеме.")
    return "\n".join(blocks)


async def rerank_candidates(
    category_meta: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    *,
    max_input: int = 30,
) -> Dict[str, Any]:
    """Принимает топ-N кандидатов после эвристик. Возвращает
    {scores: {vk_id: score}, reasons: {vk_id: reason}, raw: deepseek_payload}.
    Если DeepSeek упал — возвращает пустые dict-ы.
    """
    if not candidates:
        return {"scores": {}, "reasons": {}, "raw": None}
    cands = candidates[:max_input]

    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        logger.warning("rerank skipped: DEEPSEEK_API_KEY missing")
        return {"scores": {}, "reasons": {}, "raw": None, "error": "no_api_key"}

    user_msg = _build_user_message(category_meta, cands)
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.2,
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
        result = json.loads(content)
    except Exception as e:
        logger.warning(f"rerank deepseek call failed: {e}")
        return {"scores": {}, "reasons": {}, "raw": None, "error": str(e)}

    scores: Dict[int, int] = {}
    reasons: Dict[int, str] = {}
    for item in (result.get("results") or []):
        try:
            idx = int(item.get("id"))
            sc = int(item.get("score") or 0)
            rs = str(item.get("reason") or "").strip()
        except (ValueError, TypeError):
            continue
        if 0 <= idx < len(cands):
            vk_id = cands[idx].get("vk_id")
            if vk_id is not None:
                scores[int(vk_id)] = max(0, min(100, sc))
                reasons[int(vk_id)] = rs[:200]

    return {
        "scores": scores,
        "reasons": reasons,
        "rated": len(scores),
        "input": len(cands),
    }
