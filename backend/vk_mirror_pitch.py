#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_mirror_pitch.py
Персонализированный B2B-питч для рыбака: «вот ТВОЙ профиль через AI →
этим же инструментом ты анализируешь СВОИХ клиентов».

Структура сообщения:
  1. Привет, [ФИО]
  2. 🧠 ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ
  3. 🔥 АКТИВНАЯ БОЛЬ (с цитатой)
  4. — LLM-tail: «психология с трёх сторон» (клиенты + маркетинг + сам)
  5. Параллельно: voice_script для отправки голосом

Тяжёлый: 5 LLM-вызовов (3 в b2c_analyzer + 1 tail + 1 voice). ~$0.055/рыбак.
Кеш по vk_id в fredi_vk_mirror_pitches.
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

FREDI_LANDING = "https://meysternlp.ru/fredi/"


_ARCHETYPE_RU = {
    "INNOCENT": "Невинный", "SAGE": "Мудрец", "EXPLORER": "Искатель",
    "HERO": "Герой", "OUTLAW": "Бунтарь", "MAGICIAN": "Маг",
    "LOVER": "Любовник", "JESTER": "Шут", "EVERYMAN": "Свой парень",
    "CREATOR": "Творец", "RULER": "Правитель", "CAREGIVER": "Заботливый",
}


# Концепция Фреди для рыбаков: «психология вокруг твоего бизнеса с трёх
# сторон» — клиенты, маркетинг, ты сам. Это НЕ AI-консьерж/секретарь/
# CRM — у нас этого нет. Только то что реально есть в продукте Фреди.
_TAIL_SYSTEM = (
    "Ты — копирайтер. На вход — категория практика (психолог/коуч/йог/"
    "парикмахер/таролог/...) + его имя.\n\n"
    "КОНТЕКСТ: ВЫШЕ в письме уже написан психологический анализ ЕГО САМОГО "
    "(его профиль, его боль, его цитаты — не клиентов, не аудитории).\n\n"
    "Напиши КОНЦОВКУ B2B-сообщения (2-4 предложения) с одной идеей:\n"
    "  «Фреди — это психология вокруг твоей работы с трёх сторон.»\n"
    "Три плоскости (выбери ТЕ что подходят категории, не перечисляй все):\n"
    "  • Для твоих клиентов — Фреди как AI-психолог 24/7 (тест личности, "
    "дневник эмоций, КПТ, тревога, самогипноз). Можешь рекомендовать или "
    "встроить в свою практику.\n"
    "  • Маркетинг через психологию — психо-портрет каждого потенциального "
    "клиента из VK (как сейчас разобрал тебя) + аудит твоей VK-страницы "
    "(что цепляет ЦА, что отталкивает) + персонализированные обращения "
    "от твоего имени, текст и голос.\n"
    "  • Для тебя самого/самой — Фреди как личный AI-психолог: работа с "
    "выгоранием, тревогой, разбор сложных дней с клиентами.\n\n"
    "Для помогающих профессий (психолог/коуч/терапевт) — упор на первые "
    "две плоскости. Для бьюти-мастеров (парикмахер/маникюр/...) — на "
    "вторую и третью (третья там особенно важна — мастер сидит с клиенткой "
    "час, слушает её, эмоционально вкладывается, потом выгорает).\n\n"
    "ЗАВЕРШАЙ ссылкой на демо: " + FREDI_LANDING + " (ОДНА строка с URL, "
    "без HTML, без 'нажми сюда'). \n\n"
    "ЖЁСТКО:\n"
    "  - НЕ пиши «AI проанализировал твою аудиторию» — мы анализировали ЕГО.\n"
    "  - НЕ описывай где функция в интерфейсе («дашборд → зеркало → анализ»). "
    "Юзер сам найдёт по ссылке.\n"
    "  - НЕ предлагай несуществующего: «AI-консьерж салона», «AI-помощник "
    "мастера», «бот-секретарь» — у нас этого нет.\n"
    "  - Тон коллега-коллеге, на «ты», без продажных штампов.\n"
    "  - Без markdown, без списков, связный текст.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


# Голосовой скрипт — НЕ повторяет текст письма. Личный entry point.
_VOICE_SYSTEM = (
    "Ты — копирайтер голосового сообщения от Фреди, AI-психолога.\n"
    "Скрипт прочитает Text-to-Speech. Длительность 50–60 секунд "
    "(700–900 символов, ~130 слов).\n\n"
    "КОНТЕКСТ: параллельно адресат получит ТЕКСТОВОЕ письмо с разбором "
    "его страницы и ссылкой на демо. Голосовое — это эмоциональный entry "
    "point: личное приветствие и крючок «послушай — потом прочитаешь "
    "подробности». Не дублируй детальный профиль/цитаты/список защит.\n\n"
    "СТРУКТУРА:\n"
    "  1. Представление: «Здравствуй, [имя]. Меня зовут Фреди, я — "
    "виртуальный психолог. Я только что прошёл по твоей странице.»\n"
    "  2. Мини-резюме 2-3 коротких предложения (а не одно длинное!): "
    "суть профиля и одна заметная боль/тема в простых словах. Без "
    "терминов «архетип», «защиты», «паттерны».\n"
    "  3. Что я могу — ОДНО предложение под нишу: для психолога/коуча — "
    "«работать с твоими клиентами 24/7 между вашими сессиями»; для "
    "бьюти-мастера — «находить клиенток в твоём городе и готовить личное "
    "обращение к каждой»; для всех — «я твой личный психолог тоже, "
    "если устал/устала или нужно разобрать сложного клиента».\n"
    "  4. Завершение: «послушай, почитай разбор рядом — и решай, нужен я "
    "в твоей жизни и работе или нет».\n\n"
    "ЖЁСТКО:\n"
    "  - БЕЗ эмодзи. Никаких 🧠🔥✉️.\n"
    "  - БЕЗ URL и упоминаний доменов. Не говори «meysternlp», «дашборд», "
    "«fredi/». О ссылке упомяни абстрактно: «в письме рядом».\n"
    "  - БЕЗ markdown (никаких *, _, #, []).\n"
    "  - БЕЗ списков и нумерации.\n"
    "  - БЕЗ продажных штампов: «увеличит конверсию», «х10», «прорыв».\n"
    "  - Тон: тёплый, спокойный, коллегиальный, на «ты».\n"
    "  - Короткие предложения для естественной речи TTS.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


async def _llm_tail(category_meta: Dict[str, Any], name: str) -> str:
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return _fallback_tail(category_meta)

    user_msg = (
        f"Категория практика: {category_meta.get('name_ru') or category_meta.get('code') or '—'}\n"
        f"Имя: {name}\n"
        f"Продукт под нишу: {category_meta.get('product_hint') or ''}\n"
        f"Что AI делает для его клиентов: {category_meta.get('example_pitch') or ''}"
    )
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": _TAIL_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.5,
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
                feature="mirror_pitch.tail",
            ))
        except Exception as _e:
            logger.warning(f"api_usage skip: {_e}")
        data = json.loads(content)
        text = (data.get("text") or "").strip()
        if not text:
            return _fallback_tail(category_meta)
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch tail LLM failed: {e}")
        return _fallback_tail(category_meta)


async def _llm_voice_script(
    profile: Dict[str, Any],
    pain: Dict[str, Any],
    category_meta: Dict[str, Any],
    first_name: str,
) -> str:
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return _fallback_voice(category_meta, first_name)

    user_msg = (
        f"Имя адресата: {first_name or 'коллега'}\n"
        f"Его категория: {category_meta.get('name_ru') or category_meta.get('code') or '—'}\n"
        f"Что AI может для этой категории: {category_meta.get('product_hint') or ''}\n"
        f"\n"
        f"Краткая суть его профиля (1 фраза, не цитируй дословно):\n"
        f"  Архетип: {profile.get('archetype') or '—'}\n"
        f"  Профиль: {(profile.get('profile') or '')[:300]}\n"
        f"  Активная боль: {(pain.get('pain_active') or '')[:200]}\n"
    )
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": _VOICE_SYSTEM},
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
                feature="mirror_pitch.voice",
            ))
        except Exception as _e:
            logger.warning(f"api_usage skip: {_e}")
        data = json.loads(content)
        text = (data.get("text") or "").strip()
        text = _sanitize_voice(text)
        if not text:
            return _fallback_voice(category_meta, first_name)
        if len(text) > 1100:
            text = text[:1050].rsplit(".", 1)[0].strip() + "."
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch voice LLM failed: {e}")
        return _fallback_voice(category_meta, first_name)


import re as _re

_EMOJI_RE = _re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F900-\U0001F9FF"
    "\U00002700-\U000027BF"
    "]+",
    flags=_re.UNICODE,
)
_URL_RE = _re.compile(r"https?://\S+|www\.\S+|\b[a-zA-Z0-9.-]+\.(?:ru|com|io|org|net|me)\b/?\S*", _re.IGNORECASE)


def _sanitize_voice(text: str) -> str:
    if not text:
        return ""
    text = _EMOJI_RE.sub("", text)
    text = _URL_RE.sub("", text)
    text = _re.sub(r"[*_#`>]+", "", text)
    text = _re.sub(r"[ \t]+", " ", text)
    text = _re.sub(r"\s*\n\s*", " ", text)
    text = _re.sub(r" +([.,;:!?])", r"\1", text)
    return text.strip()


def _fallback_voice(category_meta: Dict[str, Any], first_name: str) -> str:
    name = (first_name or "коллега").strip()
    cat = (category_meta.get("name_ru") or "").strip()
    cat_phrase = f" В работе {cat} " if cat else " В твоей практике "
    hint = (category_meta.get("product_hint") or "").strip()
    util = (
        hint or
        "я помогаю клиентам держать фокус между сессиями и быть честнее в дневнике"
    )
    return (
        f"Здравствуй, {name}. Меня зовут Фреди, я — виртуальный психолог. "
        f"Я только что прошёл по твоей странице — и собрал короткое впечатление о тебе. "
        f"Подробный разбор ты найдёшь в письме рядом с этим аудио. "
        f"{cat_phrase}{util}. "
        f"Послушай это, прочитай разбор — и реши сам, мой ли я инструмент в твоей работе."
    )


def _fallback_tail(category_meta: Dict[str, Any]) -> str:
    return (
        "Это Фреди прогнал тебя через AI-психолога. Ровно так же он работает над "
        "твоими потенциальными клиентами в VK — психо-портрет каждого ещё до "
        "первого контакта плюс аудит твоей страницы. И тебе самой/самому: "
        "когда устал от клиентов или хочешь разобрать сложный кейс — "
        f"он рядом 24/7. Зайди, попробуй: {FREDI_LANDING}"
    )


def _join_list(items: Optional[List[Any]], sep: str = ", ") -> str:
    if not items:
        return ""
    return sep.join(str(x) for x in items if x)


_TERMINAL_PUNCT = {".", "!", "?", "…", '"', "»", ")", "]", ":", ";", ","}


def _clean_quote(raw: str) -> str:
    s = (raw or "").strip().strip("«»\"' \t\n")
    if not s:
        return ""
    last = s[-1]
    if last in _TERMINAL_PUNCT:
        return s
    tail = s[-12:]
    if " " not in tail:
        return s + "…"
    return s + "…"


def _compose_body(
    profile: Dict[str, Any],
    pain: Dict[str, Any],
    hooks: Dict[str, Any],
    full_name: str,
    first_name: str = "",
) -> str:
    greet = (first_name or full_name or "").strip()
    blocks: List[str] = [f"Привет, {greet}!" if greet else "Привет!"]

    blocks.append("")
    blocks.append("🧠 ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ")
    if profile.get("profile"):
        blocks.append(profile["profile"])

    arch_code = (profile.get("archetype") or "").upper()
    arch_ru = _ARCHETYPE_RU.get(arch_code, arch_code) if arch_code else ""
    openness = profile.get("openness") or ""
    meta_parts: List[str] = []
    if arch_ru:
        meta_parts.append(f"архетип — {arch_ru}")
    if openness:
        meta_parts.append(f"открытость — {openness}")
    if meta_parts:
        blocks.append(" · ".join(meta_parts))

    if profile.get("defenses"):
        blocks.append("Защиты: " + _join_list(profile["defenses"]))
    if profile.get("patterns"):
        blocks.append("Паттерны: " + _join_list(profile["patterns"]))

    if pain.get("pain_active"):
        blocks.append("")
        blocks.append("🔥 АКТИВНАЯ БОЛЬ")
        intensity = pain.get("pain_intensity") or ""
        if intensity:
            blocks.append(f"({intensity}) {pain['pain_active']}")
        else:
            blocks.append(pain["pain_active"])
        quotes = pain.get("evidence_quotes") or []
        if quotes:
            q = _clean_quote(str(quotes[0]))
            if q:
                blocks.append(f"«{q}»")
        if pain.get("desired_outcome"):
            blocks.append(f"Хочет: {pain['desired_outcome']}")

    return "\n".join(blocks)


async def generate_mirror_pitch(
    category_meta: Dict[str, Any],
    fisherman: Dict[str, Any],
) -> Dict[str, Any]:
    url_or_sn = (
        fisherman.get("vk_url")
        or fisherman.get("screen_name")
        or fisherman.get("vk_screen_name")
        or (str(fisherman.get("vk_id")) if fisherman.get("vk_id") else "")
    )
    if not url_or_sn:
        return {"error": "no_target", "message": "не указан url/screen_name/vk_id рыбака"}

    try:
        analysis = await analyze_profile(url_or_sn)
    except Exception as e:
        logger.warning(f"mirror-pitch analyze_profile failed: {e}")
        return {"error": "analysis_failed", "message": str(e)}

    if analysis.get("error"):
        return {"error": analysis["error"], "details": analysis}

    ub = (analysis.get("vk_data") or {}).get("user_basic") or {}
    first_name = (ub.get("first_name") or "").strip()
    last_name = (ub.get("last_name") or "").strip()
    full_name = " ".join(filter(None, [first_name, last_name])).strip()
    if not full_name:
        full_name = fisherman.get("full_name") or ""
    if not first_name and full_name:
        first_name = full_name.split()[0]

    body = _compose_body(
        analysis.get("profile") or {},
        analysis.get("pain") or {},
        analysis.get("hooks") or {},
        full_name,
        first_name=first_name,
    )
    import asyncio as _asyncio
    tail, voice_script = await _asyncio.gather(
        _llm_tail(category_meta, first_name or "коллега"),
        _llm_voice_script(
            analysis.get("profile") or {},
            analysis.get("pain") or {},
            category_meta,
            first_name,
        ),
    )

    message = body + "\n\n—\n\n" + tail

    vk_id = ub.get("id") or fisherman.get("vk_id")
    return {
        "message": message,
        "voice_script": voice_script,
        "vk_url": analysis.get("vk_url") or fisherman.get("vk_url") or "",
        "vk_chat_url": f"https://vk.com/im?sel={vk_id}" if vk_id else "",
        "vk_id": vk_id,
        "full_name": full_name,
        "analysis": {
            "profile": analysis.get("profile"),
            "pain": analysis.get("pain"),
            "hooks": analysis.get("hooks"),
        },
    }
