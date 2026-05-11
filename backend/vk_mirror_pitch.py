#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_mirror_pitch.py
Генерация pitch'а по результатам анализа VK-профиля. Два режима:

  B2B (Mirror-pitch) — адресат это ПРАКТИК (психолог/коуч/бьюти-мастер).
    Продаём ему инструменты Фреди для его клиентов + маркетинг через
    психологию + Фреди для него самого. 3 плоскости.

  B2C (Глубокий анализ конкретного человека) — адресат это потенциальный
    клиент Фреди. Продаём ему ЛИЧНО услугу Фреди под его конкретную боль:
    тревога → 7 техник, отношения → транзактный анализ Берна,
    сон → толкование+самогипноз, выгорание → дневник эмоций и т.д.

Режим определяется автоматически: если category_meta пустой/без name_ru
→ B2C; если есть категория (психолог/йог/...) → B2B. Можно
override-нуть через b2c_mode=True/False.

Структура сообщения одинаковая для обоих:
  1. Привет, [Имя]
  2. 🧠 ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ
  3. 🔥 АКТИВНАЯ БОЛЬ (с цитатой)
  4. LLM-tail (B2B или B2C)
  + параллельно voice_script

5 LLM-вызовов: 3 в b2c_analyzer + 1 tail + 1 voice. ~$0.055.
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


def _is_b2c_context(category_meta: Optional[Dict[str, Any]]) -> bool:
    """Auto-detect B2C режима: пустой / без name_ru → это анализ конкретного
    человека (не практика). Используется когда b2c_mode явно не передан."""
    if not category_meta:
        return True
    if not isinstance(category_meta, dict):
        return True
    if not category_meta.get("name_ru") and not category_meta.get("code"):
        return True
    return False


# === B2B (Mirror-pitch для практиков) ===
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


# === B2C (Глубокий анализ конкретного человека) ===
# Адресат — обычный человек, не практик. Продаём ему ЛИЧНО Фреди под
# конкретную боль: тревога → 7 техник, отношения → Берн, сон → гипноз
# и т.д. НЕ маркетинговые инструменты, НЕ «помощник для клиентов».
_B2C_TAIL_SYSTEM = (
    "Ты — копирайтер. Адресат — обычный человек (НЕ практик), у которого "
    "ты заметил эмоциональную тему или активную боль из его VK-постов. "
    "Цель: ЛИЧНО предложить ему услугу Фреди под его боль.\n\n"
    "КОНТЕКСТ: ВЫШЕ уже написан его психологический профиль + активная "
    "боль (из реальных постов). Знаешь, что с ним происходит.\n\n"
    "Напиши КОНЦОВКУ обращения (2-4 предложения):\n"
    "  1. Мягко признай его боль (без пафоса, без «трансформация»).\n"
    "  2. Назови ОДНУ конкретную функцию Фреди под эту боль:\n"
    "     • тревога/паника/беспокойство → «работа с тревогой: 7 техник — "
    "дыхание 4-7-8, заземление 5-4-3-2-1, STOP, окно толерантности»\n"
    "     • выгорание/усталость/нет сил → «дневник эмоций с AI-рефлексией — "
    "через месяц увидишь паттерны»\n"
    "     • отношения/конфликты/семья → «транзактный анализ Берна — увидишь "
    "свои эго-состояния и игры»\n"
    "     • сон/бессонница/кошмары → «толкование снов по Фрейду+Юнгу плюс "
    "самогипноз для засыпания»\n"
    "     • самооценка/неуверенность/«кто я» → «психологический тест за "
    "15 минут — точный портрет личности 4×6»\n"
    "     • поиск себя/цели/застой → «коуч-режим Фреди — помогает разложить "
    "запрос на шаги»\n"
    "     • привычки/дисциплина → «тренер-режим: 21-дневный план развития "
    "навыка с напоминаниями»\n"
    "     • образ в социуме/как меня видят → «зеркала — сравниваешь свой "
    "профиль с друзьями, видишь слепые пятна»\n"
    "     • грусть/внутренние конфликты → «КПТ-практики: 3 колонки Бека, "
    "разбор автомыслей, ловля 12 искажений»\n"
    "  3. Завершение со ссылкой " + FREDI_LANDING + " — без давления "
    "(«если откликнется — попробуй, базовые функции бесплатно, без "
    "регистрации»).\n\n"
    "ЖЁСТКО:\n"
    "  - НЕ предлагай маркетинговые инструменты («поиск ЦА», «парсинг VK», "
    "«аудит личного бренда») — это для практиков, НЕ для него.\n"
    "  - НЕ говори «продаём», «купи», «прорыв», «трансформация», «х10».\n"
    "  - НЕ навязывай — он не клиент, ты заметил и рекомендуешь как друг.\n"
    "  - Тон: тёплый, без коучингового пафоса.\n"
    "  - Базовые функции БЕСПЛАТНЫ — упомяни это.\n"
    "  - Без markdown, без списков, связный текст.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


# === B2B voice_script ===
_VOICE_SYSTEM = (
    "Ты — копирайтер голосового сообщения от Фреди, AI-психолога.\n"
    "Скрипт прочитает Text-to-Speech. Длительность 50–60 секунд "
    "(700–900 символов, ~130 слов).\n\n"
    "КОНТЕКСТ: параллельно адресат-практик получит ТЕКСТОВОЕ письмо с "
    "разбором его страницы. Голосовое — это эмоциональный entry point.\n\n"
    "СТРУКТУРА:\n"
    "  1. Представление: «Здравствуй, [имя]. Меня зовут Фреди, я — "
    "виртуальный психолог. Я только что прошёл по твоей странице.»\n"
    "  2. Мини-резюме 2-3 коротких предложения: суть профиля и одна "
    "заметная тема. Без терминов «архетип», «защиты», «паттерны».\n"
    "  3. Что я могу — ОДНО предложение под нишу: для психолога/коуча — "
    "«работать с твоими клиентами 24/7 между сессиями»; для бьюти-мастера "
    "— «находить клиенток в твоём городе»; для всех — «я твой личный "
    "психолог тоже, если устал».\n"
    "  4. Завершение: «послушай, почитай разбор рядом — решай сам».\n\n"
    "ЖЁСТКО: БЕЗ эмодзи, БЕЗ URL/доменов, БЕЗ markdown, без продажных "
    "штампов. Тёплый коллегиальный тон. Короткие предложения.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


# === B2C voice_script ===
_B2C_VOICE_SYSTEM = (
    "Ты — копирайтер голосового сообщения от Фреди, AI-психолога.\n"
    "Скрипт прочитает Text-to-Speech. Длительность 50–60 секунд "
    "(700–900 символов).\n\n"
    "КОНТЕКСТ: адресат — обычный человек, у которого ты заметил "
    "эмоциональную тему/боль из его VK-постов. Не практик. Ты обращаешься "
    "лично: «вот что я увидел, вот чем могу помочь».\n\n"
    "СТРУКТУРА:\n"
    "  1. Представление: «Здравствуй, [имя]. Меня зовут Фреди, я — "
    "виртуальный психолог. Я прошёл по твоей странице.»\n"
    "  2. Что заметил — 2-3 коротких предложения о его теме по-человечески, "
    "без терминов «архетип», «защиты». Например: «Видно, что тебе сейчас "
    "трудно с тревогой» / «У тебя много об отношениях, и не всё гладко» / "
    "«Заметил, что давно не получалось расслабиться».\n"
    "  3. ОДНА функция Фреди под боль — назови конкретно:\n"
    "     • тревога → «у меня есть 7 техник снижения тревоги, включая "
    "дыхание четыре-семь-восемь и заземление пять-четыре-три-два-один»\n"
    "     • выгорание → «есть дневник эмоций с AI-рефлексией»\n"
    "     • отношения → «есть разбор по транзактному анализу Берна»\n"
    "     • сон → «есть толкование снов и самогипноз для засыпания»\n"
    "     • неуверенность → «есть психологический тест на 15 минут — даст "
    "тебе точный портрет личности»\n"
    "     • привычки → «есть тренер-режим: 21-дневный план развития навыка»\n"
    "  4. Завершение мягко: «попробуй, базовое всё бесплатно, без "
    "регистрации. Если зайдёт — будешь возвращаться. Если нет — ничего "
    "не теряешь».\n\n"
    "ЖЁСТКО:\n"
    "  - БЕЗ эмодзи, БЕЗ URL, БЕЗ markdown, без списков.\n"
    "  - БЕЗ маркетинговых инструментов («парсинг», «ЦА», «бренд-аудит»).\n"
    "  - БЕЗ продажных штампов «трансформация», «прорыв».\n"
    "  - Тон: спокойный, как друг который заметил и рекомендует.\n"
    "  - Короткие предложения для TTS.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


async def _llm_tail(category_meta: Dict[str, Any], name: str,
                    b2c_mode: Optional[bool] = None) -> str:
    # Auto-detect: пустой category_meta → B2C
    if b2c_mode is None:
        b2c_mode = _is_b2c_context(category_meta)

    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return _fallback_tail(category_meta, b2c_mode=b2c_mode)

    if b2c_mode:
        system = _B2C_TAIL_SYSTEM
        user_msg = (
            f"Имя адресата: {name or 'друг'}\n"
            f"(Это обычный человек, не практик. Выбери ОДНУ конкретную "
            f"функцию Фреди под его боль, описанную выше в письме.)"
        )
        feature_tag = "mirror_pitch.tail_b2c"
    else:
        system = _TAIL_SYSTEM
        user_msg = (
            f"Категория практика: {category_meta.get('name_ru') or category_meta.get('code') or '—'}\n"
            f"Имя: {name}\n"
            f"Продукт под нишу: {category_meta.get('product_hint') or ''}\n"
            f"Что AI делает для его клиентов: {category_meta.get('example_pitch') or ''}"
        )
        feature_tag = "mirror_pitch.tail"

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system},
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
                feature=feature_tag,
            ))
        except Exception as _e:
            logger.warning(f"api_usage skip: {_e}")
        data = json.loads(content)
        text = (data.get("text") or "").strip()
        if not text:
            return _fallback_tail(category_meta, b2c_mode=b2c_mode)
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch tail LLM failed (b2c={b2c_mode}): {e}")
        return _fallback_tail(category_meta, b2c_mode=b2c_mode)


async def _llm_voice_script(
    profile: Dict[str, Any],
    pain: Dict[str, Any],
    category_meta: Dict[str, Any],
    first_name: str,
    b2c_mode: Optional[bool] = None,
) -> str:
    # Auto-detect: пустой category_meta → B2C
    if b2c_mode is None:
        b2c_mode = _is_b2c_context(category_meta)

    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return _fallback_voice(category_meta, first_name, b2c_mode=b2c_mode)

    if b2c_mode:
        system = _B2C_VOICE_SYSTEM
        user_msg = (
            f"Имя адресата: {first_name or 'друг'}\n"
            f"(Это обычный человек, не практик.)\n\n"
            f"Кратко суть профиля (1 фраза, не дословно):\n"
            f"  Профиль: {(profile.get('profile') or '')[:300]}\n"
            f"  Активная боль: {(pain.get('pain_active') or '')[:200]}\n\n"
            f"Выбери ОДНУ функцию Фреди под эту боль, назови её конкретно "
            f"(не общими словами). Скрипт должен звучать лично и тепло."
        )
        feature_tag = "mirror_pitch.voice_b2c"
    else:
        system = _VOICE_SYSTEM
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
        feature_tag = "mirror_pitch.voice"

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system},
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
                feature=feature_tag,
            ))
        except Exception as _e:
            logger.warning(f"api_usage skip: {_e}")
        data = json.loads(content)
        text = (data.get("text") or "").strip()
        text = _sanitize_voice(text)
        if not text:
            return _fallback_voice(category_meta, first_name, b2c_mode=b2c_mode)
        if len(text) > 1100:
            text = text[:1050].rsplit(".", 1)[0].strip() + "."
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch voice LLM failed (b2c={b2c_mode}): {e}")
        return _fallback_voice(category_meta, first_name, b2c_mode=b2c_mode)


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


def _fallback_voice(category_meta: Dict[str, Any], first_name: str,
                    b2c_mode: bool = False) -> str:
    name = (first_name or ("друг" if b2c_mode else "коллега")).strip()
    if b2c_mode:
        return (
            f"Здравствуй, {name}. Меня зовут Фреди, я — виртуальный психолог. "
            f"Я прошёл по твоей странице — и заметил пару тем, с которыми "
            f"могу помочь. У меня есть психологический тест на 15 минут, "
            f"дневник эмоций, работа с тревогой и КПТ-практики. Базовое "
            f"всё бесплатно, без регистрации. Послушай это, попробуй на "
            f"сайте — если зайдёт, будешь возвращаться."
        )
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


def _fallback_tail(category_meta: Dict[str, Any],
                   b2c_mode: bool = False) -> str:
    if b2c_mode:
        return (
            "Это Фреди прогнал тебя через AI-психолога. Если что-то из "
            "написанного выше откликнулось — попробуй: у меня есть "
            "психологический тест за 15 минут, дневник эмоций, работа "
            "с тревогой по 7 техникам, КПТ-практики, толкование снов и "
            f"самогипноз. Базовое всё бесплатно, без регистрации: {FREDI_LANDING}"
        )
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
    # Mirror-pitch ВСЕГДА B2B (рыбак-практик с категорией) — явно передаём False
    # чтобы исключить случайный auto-detect если category_meta вдруг пустой.
    tail, voice_script = await _asyncio.gather(
        _llm_tail(category_meta, first_name or "коллега", b2c_mode=False),
        _llm_voice_script(
            analysis.get("profile") or {},
            analysis.get("pain") or {},
            category_meta,
            first_name,
            b2c_mode=False,
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
