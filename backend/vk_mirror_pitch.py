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
  4. ✉️ ЛУЧШИЙ КРЮЧОК (1 вариант, не 3)
  5. — LLM-tail: что это было + почему категории-X нужно + ссылка

Тяжёлый: 4 LLM-вызова (3 в b2c_analyzer + 1 на tail). ~$0.05 за рыбака.
Поэтому в vk_routes есть кеш по vk_id (fredi_vk_mirror_pitches).
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
DASHBOARD_PATH = "Дашборд → 🪞 Зеркало → 🔍 Анализ VK"


_ARCHETYPE_RU = {
    "INNOCENT": "Невинный", "SAGE": "Мудрец", "EXPLORER": "Искатель",
    "HERO": "Герой", "OUTLAW": "Бунтарь", "MAGICIAN": "Маг",
    "LOVER": "Любовник", "JESTER": "Шут", "EVERYMAN": "Свой парень",
    "CREATOR": "Творец", "RULER": "Правитель", "CAREGIVER": "Заботливый",
}


_TAIL_SYSTEM = (
    "Ты — копирайтер. На вход — категория практика (психолог/коуч/нутрициолог/...) "
    "+ его имя + продукт-подсказка под его нишу.\n\n"
    "ВАЖНО про контекст: ВЫШЕ в письме (это уже написано до тебя) идёт "
    "психологический анализ ИМЕННО ЭТОГО ЧЕЛОВЕКА — его собственный профиль, "
    "его собственная боль, его собственные цитаты. НЕ его клиентов, "
    "НЕ его аудитории — его самого. Не путай это в концовке.\n\n"
    "Напиши КОНЦОВКУ B2B-сообщения (3-5 предложений), которая объясняет:\n"
    "  1. что мы только что прогнали через AI-психолога ЕГО САМОГО — его страницу, "
    "его посты — и показали ему его портрет (выше в этом же письме).\n"
    "  2. что та же машина в дашборде Фреди работает по той же схеме, "
    "но уже над ЕГО ПОТЕНЦИАЛЬНЫМИ КЛИЕНТАМИ: вставляешь ссылку на их VK — "
    "получаешь такой же разбор, как сейчас получил он.\n"
    "  3. почему его профессии (КАТЕГОРИИ) это полезно: 1 конкретная польза, "
    "не общие слова. Психологу — перед сессией; коучу — для построения программы; "
    "нутрициологу — разговор с сопротивляющимся клиентом; и т.д.\n"
    "  4. где функция: " + DASHBOARD_PATH + "\n"
    "  5. ссылка на демо: " + FREDI_LANDING + "\n\n"
    "ЖЁСТКО: НЕ пиши «AI проанализировал твою аудиторию» / «выявил, "
    "что откликается у твоих подписчиков» — мы анализировали ЕГО, а не их.\n\n"
    "Тон: коллега-коллеге, на «ты», без продажных штампов («увеличит продажи», «х10 клиентов»).\n"
    "Без markdown, без списков. Связный текст 3-5 предложений.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


# Голосовой скрипт — НЕ повторяет текст письма. Это параллельное аудио
# впечатление: личное приветствие от Фреди + мини-резюме + конкретная
# польза для категории + WOW-крючок. Без эмодзи, без URL, без markdown —
# его читает TTS, и любая «звёздочка»/«стрелка» прозвучит дико.
_VOICE_SYSTEM = (
    "Ты — копирайтер голосового сообщения от Фреди, AI-психолога.\n"
    "Скрипт прочитает Text-to-Speech. Длительность 50–60 секунд "
    "(700–900 символов, ~130 слов).\n\n"
    "КОНТЕКСТ: параллельно с этим аудио адресат получит ТЕКСТОВОЕ письмо "
    "с подробным психологическим разбором его страницы + ссылкой на демо. "
    "Голосовое — это эмоциональный entry point: личное приветствие "
    "и крючок «послушай — потом прочитаешь подробности». Не дублируй "
    "детальный профиль / цитаты / список защит из письма.\n\n"
    "СТРУКТУРА ГОЛОСА (примерно):\n"
    "  1. Представление: «Здравствуй, [имя]. Меня зовут Фреди, я — "
    "виртуальный психолог. Я только что проанализировал твою страницу.»\n"
    "  2. Мини-резюме 1-2 предложения: суть его профиля и активная боль "
    "в простых словах. Без терминов «архетип», «защиты», «паттерны».\n"
    "  3. Конкретная польза для категории: «В твоей работе [категория] "
    "я могу [одна конкретная функция]» — одно предложение, по делу.\n"
    "  4. Завершение: личный, не продажный финал. Что-то вроде «послушай это, "
    "почитай разбор в письме — и решай, нужен я в твоей практике или нет».\n\n"
    "ЖЁСТКО:\n"
    "  - БЕЗ эмодзи. Совсем. Никаких 🧠🔥✉️.\n"
    "  - БЕЗ URL и упоминаний доменов. Не говори «meysternlp.ru», "
    "«дашборд», «fredi/». О ссылке упомяни абстрактно: «в письме рядом», "
    "«посмотри в подробном разборе».\n"
    "  - БЕЗ markdown (никаких *, _, #, []).\n"
    "  - БЕЗ списков и нумерации — связная речь.\n"
    "  - БЕЗ продажных штампов: «увеличит конверсию», «х10», «прорыв».\n"
    "  - Тон: тёплый, спокойный, коллегиальный, на «ты». \n"
    "  - Пунктуация естественна для речи: запятые, точки, многоточия "
    "там где была бы пауза. Точка с запятой и тире — допустимы.\n"
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
    """Голосовой скрипт 50–60 сек, дополняет письмо (не дублирует).

    Возвращает чистый текст без эмодзи и URL. Гарантирует длину ≤900 знаков
    (для качественного TTS — Fish Audio начинает дрейфовать на длинных
    отрезках). Если LLM недоступен или вернул пусто — fallback-скрипт.
    """
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
        # Дополнительная страховка длины — TTS дешевле, юзер ждёт <60 сек.
        if len(text) > 1100:
            text = text[:1050].rsplit(".", 1)[0].strip() + "."
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch voice LLM failed: {e}")
        return _fallback_voice(category_meta, first_name)


# Эмодзи и обычные «декоративные» символы, которые TTS обычно проговаривает
# буквально («звёздочка», «решётка»). Удаляем перед отправкой в синтез.
import re as _re

_EMOJI_RE = _re.compile(
    "["
    "\U0001F300-\U0001FAFF"  # Misc Symbols and Pictographs + Emoticons + Transport + others
    "\U00002600-\U000027BF"  # Misc Symbols + Dingbats
    "\U0001F900-\U0001F9FF"  # Supplemental Symbols & Pictographs
    "\U00002700-\U000027BF"
    "]+",
    flags=_re.UNICODE,
)
_URL_RE = _re.compile(r"https?://\S+|www\.\S+|\b[a-zA-Z0-9.-]+\.(?:ru|com|io|org|net|me)\b/?\S*", _re.IGNORECASE)


def _sanitize_voice(text: str) -> str:
    """Убирает эмодзи, URL, markdown — чтобы TTS не прочитал их вслух."""
    if not text:
        return ""
    text = _EMOJI_RE.sub("", text)
    text = _URL_RE.sub("", text)
    # Markdown маркеры и хеш-символы
    text = _re.sub(r"[*_#`>]+", "", text)
    # Лишние пробелы и переводы строк
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
        "Это только что прогнал тебя через нашего AI-психолога. Ровно эта же машина "
        "анализирует твоих клиентов: вставляешь ссылку на VK — получаешь профиль, "
        "активную боль и заход в разговор. Полезно перед сессиями и для построения "
        f"кампании, чтобы понимать ЦА глубже без часов на ресёрч. Демо: {FREDI_LANDING}. "
        f"Функция: {DASHBOARD_PATH}."
    )


def _join_list(items: Optional[List[Any]], sep: str = ", ") -> str:
    if not items:
        return ""
    return sep.join(str(x) for x in items if x)


_TERMINAL_PUNCT = {".", "!", "?", "…", '"', "»", ")", "]", ":", ";", ","}


def _clean_quote(raw: str) -> str:
    """Подчистить цитату: если обрыв посреди слова, дописать «…».

    DeepSeek иногда отдаёт цитату с обрезкой на середине слова
    (например «...что зна»). На уровне UX это выглядит как баг.
    """
    s = (raw or "").strip().strip("«»\"' \t\n")
    if not s:
        return ""
    last = s[-1]
    # Если уже есть терминальная пунктуация — оставляем.
    if last in _TERMINAL_PUNCT:
        return s
    # Если последнее «слово» отделено пробелом — обрыв на полслове маловероятен.
    # Но если перед обрывом нет пробела последние 4+ символа — скорее всего
    # обрыв посреди слова. Дописываем «…».
    tail = s[-12:]
    if " " not in tail:
        return s + "…"
    # Иначе — мягкое многоточие.
    return s + "…"


def _compose_body(
    profile: Dict[str, Any],
    pain: Dict[str, Any],
    hooks: Dict[str, Any],
    full_name: str,
    first_name: str = "",
) -> str:
    """Детерминированно собрать тело сообщения из вывода b2c_analyzer.

    Для приветствия используем ТОЛЬКО first_name — фамилия часто содержит
    личный бренд («Петров Астролог»), и «Привет, Дмитрий Петров Астролог!»
    звучит криво.

    Намеренно не включаем hooks: hook от b2c_analyzer — заход на страдальца
    («Я — бесплатный AI-психолог, могу помочь разобраться»), что в B2B
    создаёт диссонанс с product-pitch в tail-е (мы продаём инструмент,
    а не терапию). Hooks остаются в response.analysis для информации
    оператора, но в текст не уходят.
    """
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
    """Сгенерировать персонализированное сообщение для рыбака.

    fisherman: {vk_url|screen_name|vk_screen_name|vk_id, full_name?}.
    Возвращает {message, vk_url, vk_chat_url, vk_id, full_name, analysis} или {error}.
    """
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
        # На случай если ФИ пришли только в full_name fisherman-объекта.
        first_name = full_name.split()[0]

    body = _compose_body(
        analysis.get("profile") or {},
        analysis.get("pain") or {},
        analysis.get("hooks") or {},
        full_name,
        first_name=first_name,
    )
    # Tail (концовка письма) и voice_script (голосовой скрипт) — независимые
    # LLM-вызовы. Запускаем параллельно, экономим ~5-15 секунд по сравнению
    # с последовательным await.
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
