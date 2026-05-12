#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_mirror_pitch.py
Генерация pitch'а по результатам анализа VK-профиля. Два режима:

  B2B (Mirror-pitch) — адресат это ПРАКТИК (психолог/коуч/бьюти-мастер).
  B2C (Глубокий анализ) — адресат это потенциальный клиент Фреди.

B2C-pitch ДИАГНОСТИЧЕСКИЙ: прямо называет боль или базовую потребность
адресата (внимание/одобрение/признание/отражение/идентичность через
ведение страницы) → предлагает конкретную функцию Фреди под неё.
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
    "клиента из VK + аудит твоей VK-страницы + персонализированные обращения.\n"
    "  • Для тебя самого/самой — Фреди как личный AI-психолог: работа с "
    "выгоранием, тревогой, разбор сложных дней с клиентами.\n\n"
    "ЗАВЕРШАЙ ссылкой " + FREDI_LANDING + " (ОДНА строка, без HTML).\n\n"
    "ЖЁСТКО:\n"
    "  - НЕ пиши «AI проанализировал твою аудиторию» — мы анализировали ЕГО.\n"
    "  - НЕ описывай где функция в интерфейсе.\n"
    "  - НЕ предлагай несуществующего («AI-консьерж салона», «бот-секретарь»).\n"
    "  - Тон коллега-коллеге, на «ты», без продажных штампов.\n"
    "  - Без markdown, без списков, связный текст.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


# === B2C — диагностический pitch ===
# Адресат — обычный человек, не практик. Цель: УКАЗАТЬ ему на его боль/
# потребность ЧЕРЕЗ его профиль → предложить конкретный модуль Фреди.
# Принцип: «зеркало» — он узнаёт себя в твоём тексте, потом видит выход.
_B2C_TAIL_SYSTEM = (
    "Ты — внимательный психолог-наблюдатель. Адресат — обычный человек "
    "(НЕ практик), у которого ты прочитал страницу VK. Цель письма: "
    "указать ему на проблему/потребность, которую он сам может не "
    "осознавать чётко, и показать что Фреди может с этим помочь.\n\n"
    "КОНТЕКСТ: ВЫШЕ уже написан его психологический профиль + активная "
    "боль (или baseline-потребность через факт ведения публичной "
    "страницы). pain_type из анализа подскажет уровень.\n\n"
    "Напиши КОНЦОВКУ (2-4 предложения) С ДВУМЯ ОБЯЗАТЕЛЬНЫМИ ХОДАМИ:\n\n"
    "ХОД 1 — НАЗОВИ ЕГО БОЛЬ/ПОТРЕБНОСТЬ ПРЯМО:\n"
    "  «Я вижу, что ты [конкретное наблюдение из анализа выше]» / "
    "«Похоже, что [состояние]» / «Замечаю, что ты [действие/тема]». "
    "Без диагнозов и пафоса — просто наблюдение, чтобы он узнал себя.\n\n"
    "ХОД 2 — ПРЕДЛОЖИ ОДНУ функцию Фреди под эту боль:\n\n"
    "Если acute pain (тревога/сон/отношения/выгорание/...):\n"
    "  • тревога/паника → «работа с тревогой: 7 техник — дыхание 4-7-8, "
    "заземление 5-4-3-2-1, STOP, окно толерантности»\n"
    "  • выгорание/усталость → «дневник эмоций с AI-рефлексией»\n"
    "  • отношения/конфликты → «транзактный анализ Берна — увидишь свои "
    "эго-состояния и игры»\n"
    "  • сон/бессонница → «толкование снов по Фрейду+Юнгу плюс самогипноз "
    "для засыпания»\n"
    "  • неуверенность/«кто я» → «психологический тест за 15 минут — "
    "точный портрет личности 4×6»\n"
    "  • поиск себя/цели/застой → «коуч-режим Фреди»\n"
    "  • привычки/дисциплина → «тренер-режим: 21-дневный план развития»\n"
    "  • образ в социуме → «зеркала — сравниваешь свой профиль с друзьями»\n"
    "  • грусть/внутренние конфликты → «КПТ-практики: 3 колонки Бека, "
    "разбор автомыслей»\n\n"
    "Если baseline (явной боли нет, но человек активно ведёт страницу — "
    "у него работают универсальные мотивы):\n"
    "  • baseline_attention (хочет внимания) → «психотест 4×6 — увидеть "
    "что говорит о тебе твоя страница глазами психолога»\n"
    "  • baseline_recognition (признание себя в группе) → «зеркала — "
    "сравнение твоего профиля с друзьями: видишь как тебя считывают»\n"
    "  • baseline_approval (нужны лайки/одобрение) → «дневник эмоций — "
    "место где не нужны лайки, только честность с собой»\n"
    "  • baseline_reflection (поиск отражения, «правильно ли я живу») → "
    "«коуч-режим Фреди или толкование снов — глубже чем VK-лента»\n"
    "  • baseline_identity (поддержание себя через демонстрацию) → "
    "«психотест 4×6 — точная картина кто ты без позиционирования»\n\n"
    "ЗАВЕРШЕНИЕ — мягкая ссылка без давления:\n"
    "  «Если откликнется — попробуй, базовое всё бесплатно, без "
    "регистрации: " + FREDI_LANDING + "».\n\n"
    "ЖЁСТКО:\n"
    "  - НЕ предлагай маркетинговые инструменты («поиск ЦА», «парсинг VK», "
    "«аудит бренда») — это для практиков.\n"
    "  - НЕ ставь диагнозов («у тебя депрессия», «ты тревожный»).\n"
    "  - НЕ говори «купи», «прорыв», «трансформация», «х10».\n"
    "  - НЕ навязывай — ты заметил и рекомендуешь как друг.\n"
    "  - Тон: тёплый, без коучингового пафоса, без саркаст-эмодзи.\n"
    "  - Без markdown, без списков, связный текст.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


# === B2B voice_script ===
_VOICE_SYSTEM = (
    "Ты — копирайтер голосового сообщения от Фреди, AI-психолога. "
    "Длительность 50–60 сек (700–900 символов).\n\n"
    "КОНТЕКСТ: параллельно адресат-практик получит ТЕКСТОВОЕ письмо.\n\n"
    "СТРУКТУРА:\n"
    "  1. «Здравствуй, [имя]. Меня зовут Фреди, я — виртуальный психолог. "
    "Я прошёл по твоей странице.»\n"
    "  2. Мини-резюме 2-3 коротких предложения о теме (без терминов "
    "«архетип», «защиты»).\n"
    "  3. Что я могу — ОДНО предложение под нишу.\n"
    "  4. «Послушай, почитай разбор рядом — решай сам».\n\n"
    "ЖЁСТКО: БЕЗ эмодзи, БЕЗ URL/доменов, БЕЗ markdown, без штампов. "
    "Короткие предложения для TTS.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


# === B2C voice_script — диагностический ===
_B2C_VOICE_SYSTEM = (
    "Ты — копирайтер голосового сообщения от Фреди, AI-психолога. "
    "TTS читает 50–60 сек (700–900 символов).\n\n"
    "Адресат — обычный человек, у которого ты прочитал страницу VK. "
    "Цель: УКАЗАТЬ на боль/потребность мягко и предложить функцию "
    "Фреди под неё.\n\n"
    "СТРУКТУРА:\n"
    "  1. Представление: «Здравствуй, [имя]. Меня зовут Фреди, я — "
    "виртуальный психолог. Я прошёл по твоей странице.»\n"
    "  2. ПРЯМО НАЗВАТЬ что увидел — 2-3 коротких предложения. "
    "По-человечески, без терминов. Примеры:\n"
    "     • «Видно, что тебе сейчас непросто с тревогой»\n"
    "     • «У тебя в постах много про отношения, и не всё гладко»\n"
    "     • «Ты часто пишешь про усталость и нет сил»\n"
    "     • Если baseline_attention: «Ты часто публикуешься. У многих "
    "за этим — простая человеческая потребность: быть увиденным»\n"
    "     • Если baseline_approval: «Вижу, что обратная связь от других "
    "тебе важна. Лайки, комментарии — это нормально»\n"
    "     • Если baseline_reflection: «У тебя много рефлексии в постах — "
    "ищешь свой ответ на «как правильно жить»\n"
    "  3. ОДНА функция Фреди под боль — назови конкретно:\n"
    "     • тревога → «есть 7 техник снижения тревоги — дыхание "
    "четыре-семь-восемь, заземление пять-четыре-три-два-один»\n"
    "     • выгорание → «есть дневник эмоций с AI-рефлексией»\n"
    "     • отношения → «есть транзактный анализ Берна — увидишь свои "
    "эго-состояния»\n"
    "     • сон → «есть толкование снов и самогипноз для засыпания»\n"
    "     • неуверенность/идентичность → «есть психологический тест на "
    "15 минут — точный портрет личности»\n"
    "     • baseline_attention/approval → «есть психотест на 15 минут — "
    "посмотришь себя глазами психолога, не через лайки»\n"
    "     • baseline_recognition → «есть функция зеркала — сравнишь свой "
    "профиль с друзьями, увидишь как тебя считывают»\n"
    "     • baseline_reflection → «есть коуч-режим — глубже разложит "
    "запрос на шаги, чем переписывание постов»\n"
    "  4. Завершение мягко: «попробуй, базовое всё бесплатно, без "
    "регистрации. Если зайдёт — будешь возвращаться. Если нет — "
    "ничего не теряешь».\n\n"
    "ЖЁСТКО:\n"
    "  - БЕЗ эмодзи, БЕЗ URL, БЕЗ markdown.\n"
    "  - БЕЗ диагнозов («у тебя депрессия», «ты тревожный») и пафоса.\n"
    "  - БЕЗ маркетинга («парсинг», «ЦА», «бренд-аудит»).\n"
    "  - БЕЗ штампов «трансформация», «прорыв».\n"
    "  - Тон: спокойный наблюдатель, не продавец.\n"
    "  - Короткие предложения для естественного TTS.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


async def _llm_tail(category_meta: Dict[str, Any], name: str,
                    b2c_mode: Optional[bool] = None,
                    pain_summary: Optional[Dict[str, Any]] = None) -> str:
    if b2c_mode is None:
        b2c_mode = _is_b2c_context(category_meta)

    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return _fallback_tail(category_meta, b2c_mode=b2c_mode)

    if b2c_mode:
        system = _B2C_TAIL_SYSTEM
        pain_hint = ""
        if pain_summary:
            pt = pain_summary.get("pain_type") or ""
            pa = (pain_summary.get("pain_active") or "")[:200]
            if pt:
                pain_hint = f"\npain_type из анализа: {pt}\npain_active: {pa}"
        user_msg = (
            f"Имя адресата: {name or 'друг'}\n"
            f"(Это обычный человек, не практик. ПРЯМО назови его боль "
            f"первой фразой — он должен узнать себя.){pain_hint}"
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
    if b2c_mode is None:
        b2c_mode = _is_b2c_context(category_meta)

    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return _fallback_voice(category_meta, first_name, b2c_mode=b2c_mode)

    if b2c_mode:
        system = _B2C_VOICE_SYSTEM
        pt = pain.get("pain_type") or ""
        user_msg = (
            f"Имя адресата: {first_name or 'друг'}\n"
            f"(Обычный человек, не практик.)\n\n"
            f"Из анализа:\n"
            f"  pain_type: {pt}\n"
            f"  Профиль: {(profile.get('profile') or '')[:250]}\n"
            f"  Боль/потребность: {(pain.get('pain_active') or '')[:200]}\n"
            f"  Хочет: {(pain.get('desired_outcome') or '')[:150]}\n\n"
            f"СТРОГО: первой фразой после представления НАЗОВИ боль/тему — "
            f"он должен узнать себя. Не описание профиля, а ПРЯМОЕ "
            f"наблюдение. Выбери ОДНУ функцию Фреди под pain_type."
        )
        feature_tag = "mirror_pitch.voice_b2c"
    else:
        system = _VOICE_SYSTEM
        user_msg = (
            f"Имя адресата: {first_name or 'коллега'}\n"
            f"Его категория: {category_meta.get('name_ru') or category_meta.get('code') or '—'}\n"
            f"Что AI может для этой категории: {category_meta.get('product_hint') or ''}\n"
            f"\n"
            f"Кратко суть профиля:\n"
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
            "Если в анализе выше что-то откликнулось — это то, на что "
            "стоит обратить внимание. Фреди как раз про такие точки: "
            "психологический тест за 15 минут, дневник эмоций, работа "
            "с тревогой по 7 техникам, КПТ-практики, толкование снов и "
            f"самогипноз. Базовое бесплатно, без регистрации: {FREDI_LANDING}"
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
    # Mirror-pitch ВСЕГДА B2B
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
