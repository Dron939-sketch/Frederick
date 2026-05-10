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

# v2-маркер концовки: появляется, когда tail сгенерирован по новому промпту
# (с подбором модулей под профиль). Используется в vk_routes для инвалидации
# старого кеша.
TAIL_VERSION_MARKER = "[fredi_pitch_v2]"


_ARCHETYPE_RU = {
    "INNOCENT": "Невинный", "SAGE": "Мудрец", "EXPLORER": "Искатель",
    "HERO": "Герой", "OUTLAW": "Бунтарь", "MAGICIAN": "Маг",
    "LOVER": "Любовник", "JESTER": "Шут", "EVERYMAN": "Свой парень",
    "CREATOR": "Творец", "RULER": "Правитель", "CAREGIVER": "Заботливый",
}


# Каталог модулей Фреди для подбора под зону интересов рыбака.
# LLM выбирает 2-3 наиболее релевантных по профилю/боли/категории.
_FREDI_CATALOG = [
    {
        "code": "mirrors", "name": "🪞 Анализ VK (Зеркало)",
        "what": "Психологический разбор любого VK-профиля за минуту: архетип, защиты, активная боль, цитаты, заход в разговор.",
        "tags": ["универсал", "B2B-инструмент", "психология", "маркетинг", "сегментация"],
    },
    {
        "code": "interests", "name": "🎯 Интересы",
        "what": "Карта мотивов и стержневых интересов человека на основе его профиля.",
        "tags": ["профориентация", "коучинг", "поиск себя", "мотивация"],
    },
    {
        "code": "brand", "name": "✨ Личный бренд",
        "what": "Архетип + AI-план развития бренда и стиля коммуникации.",
        "tags": ["инфобиз", "продвижение", "эксперт-блог", "архетипы", "брендинг"],
    },
    {
        "code": "emotions", "name": "🌊 Работа с чувствами",
        "what": "Три способа разобрать эмоцию: голосом, через профиль или вручную.",
        "tags": ["психотерапия", "эмоции", "регуляция", "выгорание"],
    },
    {
        "code": "anchors", "name": "⚓ Библиотека состояний",
        "what": "AI-якоря ресурсных состояний (НЛП): уверенность, концентрация, спокойствие.",
        "tags": ["НЛП", "перформанс", "спорт", "ресурс", "уверенность"],
    },
    {
        "code": "practices", "name": "🧘 Нейро-практики",
        "what": "Интерактивные телесные практики: дыхание, заземление, медитации.",
        "tags": ["тело", "медитация", "йога", "дыхание", "стресс", "релакс"],
    },
    {
        "code": "dreams", "name": "🌙 Интерпретация снов",
        "what": "AI-разбор снов через юнгианский подход: символы, бессознательное, послание.",
        "tags": ["юнгианство", "эзотерика", "бессознательное", "сны"],
    },
    {
        "code": "esoterica", "name": "🔮 Эзотерика",
        "what": "Таро, гороскоп, натальная карта.",
        "tags": ["астрология", "таро", "эзотерика", "гадание"],
    },
    {
        "code": "hormones", "name": "♀️ Гормональный баланс",
        "what": "Диагностика цикла + питание + рекомендации.",
        "tags": ["нутрициология", "женское здоровье", "гинекология", "цикл", "тело"],
    },
    {
        "code": "hypnosis", "name": "💫 Гипноз",
        "what": "Гипнотические сессии и работа с внушениями.",
        "tags": ["гипнотерапия", "изменения", "бессознательное", "трансформация"],
    },
    {
        "code": "relationships", "name": "❤️ Отношения",
        "what": "Анализ отношений + разбор кризиса + рекомендации.",
        "tags": ["парная терапия", "семейная терапия", "конфликты", "развод", "пары"],
    },
    {
        "code": "tales", "name": "🎭 Сказки-катарсис",
        "what": "AI-нарратив по пирамиде Дилтса: проработка через метафору.",
        "tags": ["нарратив", "психодрама", "метафоры", "арт-терапия"],
    },
    {
        "code": "coach", "name": "🏆 Коучинг (Цели/Привычки/Стратегия)",
        "what": "Три режима для достижения: цели, привычки, стратегия.",
        "tags": ["life-коучинг", "бизнес-коучинг", "цели", "дисциплина", "продуктивность"],
    },
    {
        "code": "doubles", "name": "🧬 Двойники (типология)",
        "what": "Психометрический мэтчмейкер по личности.",
        "tags": ["MBTI", "соционика", "типология", "HR", "тесты"],
    },
    {
        "code": "marathons", "name": "🚀 Марафоны навыков (37 шт по 21 дню)",
        "what": "Уверенность, границы, эмоции, фокус, лидерство, переговоры, делегирование, креативность и др.",
        "tags": ["soft skills", "развитие", "навыки", "коучинг", "обучение", "домашка клиентам"],
    },
]


def _format_catalog_for_prompt() -> str:
    """Свернуть каталог в компактный текст для system-промпта."""
    lines = []
    for m in _FREDI_CATALOG:
        tags = ", ".join(m["tags"])
        lines.append(f"- [{m['code']}] {m['name']} — {m['what']} | теги: {tags}")
    return "\n".join(lines)


_TAIL_SYSTEM = (
    "Ты — копирайтер B2B-сообщений для Фреди (AI-психолог). На вход — психологический профиль "
    "и активная боль рыбака (психолог/коуч/нутрициолог/таролог/йогатерапевт и т.п.), его имя, "
    "категория, и каталог из 15 модулей Фреди.\n\n"
    "ВАЖНО про контекст: ВЫШЕ в письме (это уже написано до тебя) — психологический анализ "
    "ИМЕННО ЭТОГО ЧЕЛОВЕКА: его собственный профиль, его собственная боль, его цитаты. "
    "НЕ его клиентов. НЕ его аудитории. Его самого. Не путай это в концовке.\n\n"
    "ЗАДАЧА: написать концовку B2B-сообщения (4-7 предложений) в 2 абзаца:\n\n"
    "АБЗАЦ 1 (главный — VK-анализ):\n"
    "  - объясни, что мы только что прогнали через AI-психолога ЕГО САМОГО, и показали ему его портрет (выше в письме).\n"
    "  - расскажи, что та же машина в дашборде Фреди (модуль 🪞 Анализ VK) работает по той же схеме, но уже над ЕГО ПОТЕНЦИАЛЬНЫМИ КЛИЕНТАМИ: вставляет ссылку на их VK — получает такой же разбор.\n"
    "  - дай 1 КОНКРЕТНУЮ пользу под его категорию/нишу (психологу — перед сессией; коучу — для построения программы; йогатерапевту — понять текущее состояние ученицы за минуту; и т.п.).\n"
    "  - укажи путь: " + DASHBOARD_PATH + "\n\n"
    "АБЗАЦ 2 (подбор модулей под зону интересов):\n"
    "  - проанализируй ПРОФИЛЬ И БОЛЬ рыбака — определи 1-2 ключевые зоны (тело? женское здоровье? тарологическая практика? коучинг? эзотерика? отношения?).\n"
    "  - выбери 2-3 наиболее релевантных модуля из каталога (НЕ повторяй mirrors — он уже в абзаце 1) и встрой их в одну живую фразу.\n"
    "  - для каждого выбранного модуля — короткая привязка к его теме (для йогатерапевта: «🧘 Нейро-практики — давать ученицам как домашку»; для нутрициолога: «♀️ Гормоны — для разговора о цикле»).\n"
    "  - в конце — ссылка на демо: " + FREDI_LANDING + "\n\n"
    "В САМЫЙ КОНЕЦ ответа добавь маркер версии: " + TAIL_VERSION_MARKER + "\n\n"
    "ЖЁСТКО:\n"
    "  - НЕ пиши «AI проанализировал твою аудиторию» / «выявил, что откликается у твоих подписчиков» — мы анализировали ЕГО, а не их.\n"
    "  - НЕ предлагай больше 3 модулей в абзаце 2 (включая VK-анализ — это потолок: 🪞 + 2-3 других = максимум 4).\n"
    "  - НЕ выдумывай модули, которых нет в каталоге.\n"
    "  - Тон — коллега-коллеге, на «ты». Без продажных штампов («увеличит продажи», «х10 клиентов», «уникальная технология»).\n"
    "  - Без markdown-списков. Эмодзи только перед названиями модулей (как в каталоге).\n\n"
    "КАТАЛОГ МОДУЛЕЙ ФРЕДИ:\n" + _format_catalog_for_prompt() + "\n\n"
    "Возвращай JSON: {\"text\": \"...\", \"picked_modules\": [\"code1\", \"code2\", \"code3\"]}"
)


async def _llm_tail(
    category_meta: Dict[str, Any],
    name: str,
    profile: Optional[Dict[str, Any]] = None,
    pain: Optional[Dict[str, Any]] = None,
) -> str:
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return _fallback_tail(category_meta)

    profile_text = (profile or {}).get("profile") or ""
    archetype_code = ((profile or {}).get("archetype") or "").upper()
    archetype_ru = _ARCHETYPE_RU.get(archetype_code, archetype_code)
    patterns = _join_list((profile or {}).get("patterns"))
    pain_active = (pain or {}).get("pain_active") or ""
    desired = (pain or {}).get("desired_outcome") or ""

    user_msg = (
        f"Категория практика: {category_meta.get('name_ru') or category_meta.get('code') or '—'}\n"
        f"Имя: {name}\n"
        f"Продукт под нишу: {category_meta.get('product_hint') or ''}\n"
        f"Пример пользы для клиентов категории: {category_meta.get('example_pitch') or ''}\n\n"
        f"=== ПРОФИЛЬ РЫБАКА (для подбора модулей) ===\n"
        f"Описание: {profile_text}\n"
        f"Архетип: {archetype_ru or '—'}\n"
        f"Паттерны: {patterns or '—'}\n"
        f"Активная боль: {pain_active or '—'}\n"
        f"Хочет: {desired or '—'}"
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
        # Если LLM забыл маркер версии — дописываем сами, чтобы кеш-логика
        # в vk_routes считала это новым форматом и не регенерила бесконечно.
        if TAIL_VERSION_MARKER not in text:
            text = f"{text}\n\n{TAIL_VERSION_MARKER}"
        picked = data.get("picked_modules") or []
        if picked:
            logger.info(f"mirror-pitch picked modules: {picked}")
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch tail LLM failed: {e}")
        return _fallback_tail(category_meta)


def _fallback_tail(category_meta: Dict[str, Any]) -> str:
    return (
        "Это только что прогнал тебя через нашего AI-психолога. Ровно эта же машина "
        "анализирует твоих клиентов: вставляешь ссылку на VK — получаешь профиль, "
        "активную боль и заход в разговор. Полезно перед сессиями и для построения "
        f"кампании, чтобы понимать ЦА глубже без часов на ресёрч. Функция: {DASHBOARD_PATH}.\n\n"
        f"Внутри Фреди ещё много модулей под практиков — 🎯 Интересы, 🌊 Чувства, ⚓ Библиотека "
        f"состояний, 🚀 Марафоны навыков на 21 день. Демо: {FREDI_LANDING}\n\n"
        f"{TAIL_VERSION_MARKER}"
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
    tail = await _llm_tail(
        category_meta,
        first_name or "коллега",
        profile=analysis.get("profile") or {},
        pain=analysis.get("pain") or {},
    )

    message = body + "\n\n—\n\n" + tail

    vk_id = ub.get("id") or fisherman.get("vk_id")
    return {
        "message": message,
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
