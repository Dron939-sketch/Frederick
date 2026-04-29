#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_pitcher.py
Генератор B2B-питчей рыбакам: «вот наш AI-инструмент, можем сделать твой».

Тон: НЕ продажа, а демонстрация партнёрства. Фреди — наш референс-кейс
(работающий AI-психолог), мы предлагаем сделать аналог под нишу рыбака
(нутрициолог / коуч / таролог / семейный терапевт / ...).

3 варианта по «тяжести»:
  • SHORT — одно предложение + ссылка на демо (для cold-outreach).
  • DETAIL — описание боли клиентов рыбака + что AI решает (~5 предложений).
  • CASE  — со ссылкой на Фреди как пример: «вот так это работает на психологе».
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT_S = 60.0

FREDI_DEMO = "https://meysternlp.ru/fredi/"


_PITCH_SYSTEM = (
    "Ты — B2B-копирайтер. Пишешь рыбаку (психологу, коучу, нутрициологу, "
    "тарологу и т.д.) предложение партнёрства — НЕ услугу, а инструмент. "
    "Наша компания делает AI-помощников для практиков: они работают в стиле "
    "практика, под его брендом, держат клиентов между сессиями, сами находят "
    "новых клиентов через VK.\n\n"
    "У нас есть готовый пример — Фреди (виртуальный психолог): "
    + FREDI_DEMO + "\n\n"
    "ПРИНЦИПЫ:\n"
    "  • Уважительный тон коллеги, не выскочки.\n"
    "  • НЕ снисхождение, НЕ навязчивость, НЕ обещания «х10 клиентов».\n"
    "  • Конкретно: что AI делает в его нише, что получает практик.\n"
    "  • White-label по умолчанию: «работает под твоим именем».\n"
    "  • Деликатно про автоматический поиск клиентов: «по той же технологии "
    "    нашли тебя» — это и доказательство и пример.\n\n"
    "ФОРМАТ:\n"
    "  • На «ты» (если рыбак очень публичный/официальный — «вы»).\n"
    "  • SHORT: 1 предложение + ссылка. Для холодного outreach.\n"
    "  • DETAIL: 4-6 предложений. Что болит у его клиентов между сессиями + что AI решает.\n"
    "  • CASE: 5-7 предложений. С прямой ссылкой на Фреди как пример работы AI.\n"
    "  • Каждый вариант обязательно содержит " + FREDI_DEMO + " ровно один раз.\n\n"
    "Возвращай JSON:\n"
    "{\n"
    "  \"variants\": [\n"
    "    {\"tone\": \"short|detail|case\", \"text\": \"...\", \"reasoning\": \"...\"},\n"
    "    ...\n"
    "  ],\n"
    "  \"product_label\": \"короткое название продукта под эту нишу (AI-таролог, AI-нутрициолог и т.д.)\",\n"
    "  \"recommended_tone\": \"short|detail|case\",\n"
    "  \"strategy_summary\": \"одно предложение для оператора\"\n"
    "}\n"
    "Без markdown."
)


def _build_user_prompt(category_meta: Dict[str, Any], fisherman: Dict[str, Any]) -> str:
    cname = category_meta.get("name_ru") or category_meta.get("code")
    desc = category_meta.get("description") or ""
    product = category_meta.get("product_hint") or ""
    pitch_hint = category_meta.get("example_pitch") or ""

    name = fisherman.get("full_name") or "(?)"
    about = (fisherman.get("about") or "").strip()[:400]
    status = (fisherman.get("status") or "").strip()[:200]
    occupation = (fisherman.get("occupation") or "")
    site = fisherman.get("site") or ""
    audience = fisherman.get("audience_size", 0)
    followers = fisherman.get("followers", 0)
    city = fisherman.get("city") or ""

    blocks: List[str] = [
        f"=== КАТЕГОРИЯ РЫБАКА: {cname} ===",
        f"Описание ниши: {desc}",
        f"Продукт под эту нишу: {product}",
        f"Что AI делает для практика: {pitch_hint}",
        "",
        f"=== ЭТОТ КОНКРЕТНЫЙ РЫБАК ===",
        f"Имя: {name}",
    ]
    if city:
        blocks.append(f"Город: {city}")
    if occupation:
        blocks.append(f"Должность/практика: {occupation}")
    if status:
        blocks.append(f"Статус: «{status}»")
    if about:
        blocks.append(f"О себе: «{about}»")
    if site:
        blocks.append(f"Сайт/услуги: {site}")
    blocks.append(
        f"Аудитория VK: {followers} подписчиков, {audience} всего (followers+friends)"
    )
    blocks.append("")
    blocks.append(
        "Сгенерируй 3 варианта B2B-питча (SHORT, DETAIL, CASE) под этого рыбака. "
        "Подстрой формулировки под ЕГО нишу и стиль bio."
    )
    return "\n".join(blocks)


async def generate_pitch(
    category_meta: Dict[str, Any],
    fisherman: Dict[str, Any],
) -> Dict[str, Any]:
    """Возвращает {variants, product_label, recommended_tone, strategy_summary}."""
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return {"error": "no_api_key"}

    user_msg = _build_user_prompt(category_meta, fisherman)
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": _PITCH_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.6,
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
                provider="deepseek", model=DEEPSEEK_MODEL,
                tokens_in=tk["tokens_in"], tokens_out=tk["tokens_out"],
                feature="b2b_pitch.generate",
            ))
        except Exception as _e:
            logger.warning(f"api_usage skip: {_e}")
        return json.loads(content)
    except Exception as e:
        logger.warning(f"vk_pitcher.generate_pitch failed: {e}")
        return {"error": str(e)}
