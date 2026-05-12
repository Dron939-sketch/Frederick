#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_mirror_pitch.py
Генерация pitch'а по результатам анализа VK-профиля. Два режима:

  B2B (Mirror-pitch) — адресат это ПРАКТИК (психолог/коуч/бьюти-мастер).
  B2C (Глубокий анализ) — адресат это потенциальный клиент Фреди.

B2C-pitch ДИАГНОСТИЧЕСКИЙ + СЕМЯ-АРТЕФАКТ:
  • голос и текст ССЫЛАЮТСЯ НА ОДНО И ТО ЖЕ название инструмента
    Фреди (детерминированно выбрано по pain_type);
  • когда адресат заходит на сайт, он видит в боковом меню ровно ту
    кнопку, о которой Фреди говорил → срабатывает рефлекс узнавания.
  • названия артефактов СОВПАДАЮТ с надписями кнопок на сайте Фреди
    (см. fredi/index.html: «Зеркало», «Психологический тест»,
    «Дневник», «Гипноз», «Толкование снов», «Роли и игры», «Якоря»,
    «Сказки-катарсис», «Практики»).
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


# ============================================================
# КАРТА АРТЕФАКТОВ: pain_type → одна конкретная кнопка на сайте.
# ------------------------------------------------------------
# Это «семя» — название артефакта произносится в голосе, повторяется
# в тексте, а при заходе на сайт человек видит ИДЕНТИЧНУЮ кнопку в
# боковом меню. Срабатывает рефлекс узнавания: «о, это то, о чём
# говорил Фреди».
#
# name      — ТОЧНО как написано на кнопке в fredi/index.html
# icon_word — описание иконки словами (для голоса, без эмодзи)
# icon_emoji — эмодзи (для текста, синхронно с боковым меню)
# section   — где искать («верх меню» / «Инструменты» / «Практики»)
# promise_text — обещание для письма (длинная форма)
# promise_voice — обещание для TTS (короткая, разговорная форма)
# ============================================================
_ARTIFACTS_MAP: Dict[str, Dict[str, str]] = {
    # ===== ОСТРАЯ БОЛЬ =====
    "acute_anxiety": {
        "name": "Гипноз",
        "icon_word": "воронка-спираль",
        "icon_emoji": "🌀",
        "section": "блок «Практики»",
        "promise_text": "разгрузка тревоги, дыхание 4-7-8, заземление 5-4-3-2-1 и техника засыпания за 10 минут",
        "promise_voice": "разгрузка тревоги, дыхание четыре-семь-восемь, техника на засыпание",
    },
    "acute_sleep": {
        "name": "Толкование снов",
        "icon_word": "полумесяц",
        "icon_emoji": "🌙",
        "section": "блок «Практики»",
        "promise_text": "разбор твоих снов по Фрейду+Юнгу плюс самогипноз для засыпания",
        "promise_voice": "разбор снов по Фрейду и Юнгу, плюс самогипноз для засыпания",
    },
    "acute_relationships": {
        "name": "Роли и игры",
        "icon_word": "театральная маска",
        "icon_emoji": "🎭",
        "section": "блок «Инструменты»",
        "promise_text": "транзактный анализ Берна — увидишь свои эго-состояния и игры, которые повторяются в отношениях",
        "promise_voice": "транзактный анализ Берна — увидишь свои эго-состояния и игры, которые повторяются",
    },
    "acute_burnout": {
        "name": "Дневник",
        "icon_word": "раскрытый блокнот",
        "icon_emoji": "📓",
        "section": "блок «Инструменты»",
        "promise_text": "дневник эмоций с AI-рефлексией — место, где не нужны лайки, только честность с собой",
        "promise_voice": "дневник эмоций с AI-рефлексией",
    },
    "acute_identity": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "promise_text": "точный портрет личности 4×6 за 15 минут — 16 типов, без позиционирования",
        "promise_voice": "психологический тест на 15 минут — точный портрет личности 4 на 6",
    },
    "acute_meaning": {
        "name": "Сказки-катарсис",
        "icon_word": "глаз-амулет",
        "icon_emoji": "🧿",
        "section": "блок «Инструменты»",
        "promise_text": "сказки-катарсис — встреча с собой через метафору, без терминов и диагнозов",
        "promise_voice": "сказки-катарсис — встреча с собой через метафору",
    },
    "acute_habits": {
        "name": "Якоря",
        "icon_word": "якорь",
        "icon_emoji": "⚓",
        "section": "блок «Практики»",
        "promise_text": "якорение состояния — техника закрепления нужного настроя за 10 минут",
        "promise_voice": "якорение состояния — техника закрепления нужного настроя",
    },
    "acute_grief": {
        "name": "Гипноз",
        "icon_word": "воронка-спираль",
        "icon_emoji": "🌀",
        "section": "блок «Практики»",
        "promise_text": "мягкая работа со сложными чувствами и техника заземления",
        "promise_voice": "мягкая работа со сложными чувствами и техника заземления",
    },

    # ===== БАЗОВЫЕ ПОТРЕБНОСТИ =====
    # Когда явной острой боли не видно, но человек активно ведёт
    # публичную страницу — у него работают универсальные мотивы.
    "baseline_attention": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "promise_text": "увидишь себя глазами психолога, а не через лайки — портрет личности за 15 минут",
        "promise_voice": "психотест на 15 минут — увидишь себя глазами психолога, а не через лайки",
    },
    "baseline_recognition": {
        "name": "Зеркало",
        "icon_word": "зеркало",
        "icon_emoji": "🪞",
        "section": "верх бокового меню",
        "promise_text": "сравнение твоего профиля с друзьями — увидишь, как тебя считывают со стороны",
        "promise_voice": "функция зеркала — сравнишь свой профиль с друзьями, увидишь, как тебя считывают",
    },
    "baseline_approval": {
        "name": "Дневник",
        "icon_word": "раскрытый блокнот",
        "icon_emoji": "📓",
        "section": "блок «Инструменты»",
        "promise_text": "место, где не нужны лайки — только честность с собой, плюс AI-рефлексия твоих записей",
        "promise_voice": "дневник эмоций с AI-рефлексией — место, где не нужны лайки, только честность",
    },
    "baseline_reflection": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "promise_text": "психотест 4×6 за 15 минут — глубже, чем VK-лента",
        "promise_voice": "психологический тест на 15 минут — глубже, чем VK-лента",
    },
    "baseline_identity": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "promise_text": "точный портрет личности 4×6 — кто ты на самом деле, без позиционирования",
        "promise_voice": "психотест 4 на 6 — точная картина, кто ты на самом деле, без позиционирования",
    },
}

# Дефолт когда pain_type пустой или незнакомый.
_DEFAULT_ARTIFACT = _ARTIFACTS_MAP["baseline_attention"]


def _select_artifact(pain_type: Optional[str]) -> Dict[str, str]:
    """Детерминированно выбирает артефакт по pain_type.

    Один и тот же pain_type → один и тот же артефакт. Это гарантирует,
    что голос и текст не разойдутся (даже если LLM генерирует их
    параллельно), и человек увидит на сайте именно ту кнопку, которую
    ему обещал Фреди.
    """
    if not pain_type:
        return _DEFAULT_ARTIFACT
    return _ARTIFACTS_MAP.get(pain_type.strip(), _DEFAULT_ARTIFACT)


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


# === B2C TEXT — концовка письма, ссылка + засев артефакта ===
# Текст работает в паре с голосом: голос обещает артефакт, текст
# даёт ссылку и повторяет ровно это же название. Расхождение =
# нарушение рефлекса узнавания.
_B2C_TAIL_SYSTEM = (
    "Ты — копирайтер ТЕКСТОВОЙ концовки письма от Фреди (AI-психолога) "
    "к обычному человеку, чью страницу VK ты прочитал.\n\n"
    "ВАЖНО — голос и текст работают в ПАРЕ:\n"
    "  • Голос (отдельное аудио) обещает один конкретный инструмент "
    "Фреди по его НАЗВАНИЮ.\n"
    "  • Твой текст — ССЫЛКА + ПОВТОР этого же названия в кавычках + "
    "указание ГДЕ кнопка в меню сайта.\n"
    "  • Когда человек заходит на сайт и видит в боковом меню ровно "
    "эту кнопку — срабатывает рефлекс узнавания. ЭТО ЦЕЛЬ.\n\n"
    "КОНТЕКСТ: ВЫШЕ уже написан психологический профиль + боль/"
    "потребность. В user-сообщении передан ARTIFACT — ТОЧНОЕ название "
    "кнопки на сайте Фреди + эмодзи + что обещаем. Используй буквально.\n\n"
    "СТРУКТУРА КОНЦОВКИ (3-5 коротких строк, связный текст):\n"
    "  1) ОДНА ФРАЗА-НАБЛЮДЕНИЕ: «Я вижу, что ты ...» / «Замечаю, "
    "что ...» / «Похоже, что ...» — НАЗОВИ боль/потребность прямо, "
    "чтобы человек узнал себя. Опирайся на анализ выше.\n"
    "  2) ПЕРЕХОД К АРТЕФАКТУ: «У меня для тебя есть «ARTIFACT»» / "
    "«Я подобрал тебе «ARTIFACT»» — НАЗВАНИЕ В КАВЫЧКАХ ТОЧНО как в "
    "user-сообщении. Это семя.\n"
    "  3) ОДНО ОБЕЩАНИЕ: что найдёшь там, что произойдёт за 10 минут "
    "(используй PROMISE_TEXT из user-сообщения, перефразируй мягко).\n"
    "  4) УКАЗАТЕЛЬ-СЕМЯ: «Открой " + FREDI_LANDING + " — слева в "
    "боковом меню {SECTION} увидишь кнопку {EMOJI} «ARTIFACT»». "
    "ВСТАВЬ ЭМОДЗИ И НАЗВАНИЕ ИЗ user-сообщения БУКВАЛЬНО.\n"
    "  5) МЯГКОЕ ЗАВЕРШЕНИЕ: «Бесплатно, без регистрации, 10 минут — "
    "если откликнется, попробуй».\n\n"
    "ЖЁСТКО:\n"
    "  - ARTIFACT и EMOJI из user-сообщения — БУКВАЛЬНО, без "
    "перефраза. Расхождение убивает рефлекс узнавания.\n"
    "  - НЕ предлагай ВТОРОЙ инструмент даже если хочется. Один "
    "артефакт-семя.\n"
    "  - НЕ ставь диагнозов («у тебя депрессия», «ты тревожный»).\n"
    "  - НЕ маркетинг («трансформация», «прорыв», «х10», «решение»).\n"
    "  - НЕ перечисляй другие функции Фреди.\n"
    "  - Тон: спокойный наблюдатель, не продавец.\n"
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


# === B2C VOICE — 60 сек, обещает АРТЕФАКТ ===
# Голос — эмоциональный контакт, мирроринг, ОБЕЩАНИЕ конкретного
# артефакта по имени. Без URL (TTS не читает ссылки красиво).
# Текст в паре даст ссылку и повторит название. Один артефакт-семя.
_B2C_VOICE_SYSTEM = (
    "Ты — копирайтер ГОЛОСОВОГО сообщения от Фреди (AI-психолога), "
    "которое TTS прочитает за 50–60 секунд (700–900 символов).\n\n"
    "ВАЖНО — голос и текст работают в ПАРЕ:\n"
    "  • Голос (твой) — эмоциональный контакт + ОБЕЩАНИЕ одного "
    "конкретного инструмента Фреди по его НАЗВАНИЮ.\n"
    "  • Текст (отдельно) — ссылка и повтор этого же названия.\n"
    "  • Когда человек заходит на сайт и видит в меню кнопку с тем "
    "же названием — он УЗНАЁТ её. Это рефлекс узнавания. ЭТО ЦЕЛЬ.\n\n"
    "В user-сообщении тебе передан ARTIFACT — ТОЧНОЕ название "
    "инструмента + описание иконки + что обещаем. Используй буквально.\n\n"
    "СТРУКТУРА:\n"
    "  1. ПРЕДСТАВЛЕНИЕ (5–8 сек): «Здравствуй, [имя]. Меня зовут "
    "Фреди, я виртуальный психолог. Я прошёл по твоей странице.»\n"
    "  2. НАЗВАТЬ БОЛЬ/ПОТРЕБНОСТЬ (10–15 сек): 2-3 коротких "
    "предложения по-человечески. «Видно, что...» / «У тебя в постах "
    "много про...» / «Замечаю, что...» / «Похоже, тебе сейчас...». "
    "БЕЗ диагнозов, БЕЗ терминов. Опирайся на pain_active и pain_type "
    "из user-сообщения.\n"
    "  3. ОБЕЩАНИЕ АРТЕФАКТА (15–20 сек): «У меня для тебя есть "
    "ARTIFACT. Это PROMISE_VOICE.» — ARTIFACT произнести СЛОВО В "
    "СЛОВО, как в user-сообщении. Это семя, которое должно засесть.\n"
    "  4. УКАЗАТЕЛЬ-СЕМЯ (5–8 сек): «Когда зайдёшь на сайт — слева в "
    "меню, в SECTION, увидишь раздел ARTIFACT, иконка как ICON_WORD». "
    "БЕЗ URL — только название и описание иконки.\n"
    "  5. МЯГКИЙ ВЫХОД (5–8 сек): «Десять минут, бесплатно, без "
    "регистрации. Если зайдёт — будешь возвращаться. Если нет — "
    "ничего не теряешь».\n\n"
    "ЖЁСТКО:\n"
    "  - ARTIFACT в голосе ПРОИЗНЕСТИ СЛОВО В СЛОВО из user-"
    "сообщения. Это самое важное — иначе семя не сработает.\n"
    "  - ICON_WORD описать словами (НЕ читать эмодзи).\n"
    "  - БЕЗ URL, БЕЗ доменов, БЕЗ эмодзи — TTS их не прочитает.\n"
    "  - НЕ предлагай ВТОРОЙ инструмент. Один артефакт за раз.\n"
    "  - БЕЗ диагнозов и пафоса («трансформация», «прорыв», «х10»).\n"
    "  - БЕЗ маркетинга («парсинг», «ЦА», «бренд-аудит»).\n"
    "  - Короткие предложения для естественного TTS.\n"
    "  - Тон: спокойный психолог, не продавец.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


async def _llm_tail(category_meta: Dict[str, Any], name: str,
                    b2c_mode: Optional[bool] = None,
                    pain_summary: Optional[Dict[str, Any]] = None) -> str:
    if b2c_mode is None:
        b2c_mode = _is_b2c_context(category_meta)

    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    pain_type = ""
    if b2c_mode and pain_summary:
        pain_type = (pain_summary.get("pain_type") or "").strip()

    if not api_key:
        return _fallback_tail(category_meta, b2c_mode=b2c_mode, pain_type=pain_type)

    if b2c_mode:
        system = _B2C_TAIL_SYSTEM
        artifact = _select_artifact(pain_type)
        pa = ""
        if pain_summary:
            pa = (pain_summary.get("pain_active") or "")[:200]
        user_msg = (
            f"Имя адресата: {name or 'друг'}\n"
            f"(Это обычный человек, не практик. Назови боль/потребность "
            f"первой фразой — он должен узнать себя.)\n\n"
            f"=== СЕМЯ-АРТЕФАКТ (использовать БУКВАЛЬНО) ===\n"
            f"ARTIFACT (в кавычках): «{artifact['name']}»\n"
            f"EMOJI кнопки в меню: {artifact['icon_emoji']}\n"
            f"SECTION (где искать в меню): {artifact['section']}\n"
            f"PROMISE_TEXT (что обещаем): {artifact['promise_text']}\n"
            f"=== /СЕМЯ ===\n\n"
            f"pain_type из анализа: {pain_type or '—'}\n"
            f"pain_active: {pa or '—'}\n"
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
            return _fallback_tail(category_meta, b2c_mode=b2c_mode, pain_type=pain_type)
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch tail LLM failed (b2c={b2c_mode}): {e}")
        return _fallback_tail(category_meta, b2c_mode=b2c_mode, pain_type=pain_type)


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
    pain_type = (pain.get("pain_type") or "").strip() if b2c_mode else ""

    if not api_key:
        return _fallback_voice(category_meta, first_name,
                               b2c_mode=b2c_mode, pain_type=pain_type)

    if b2c_mode:
        system = _B2C_VOICE_SYSTEM
        artifact = _select_artifact(pain_type)
        user_msg = (
            f"Имя адресата: {first_name or 'друг'}\n"
            f"(Обычный человек, не практик.)\n\n"
            f"=== СЕМЯ-АРТЕФАКТ (произнести СЛОВО В СЛОВО) ===\n"
            f"ARTIFACT: {artifact['name']}\n"
            f"ICON_WORD (как звучит описание иконки): {artifact['icon_word']}\n"
            f"SECTION (где в меню): {artifact['section']}\n"
            f"PROMISE_VOICE (что обещаем — можно немного перефразировать): "
            f"{artifact['promise_voice']}\n"
            f"=== /СЕМЯ ===\n\n"
            f"Из анализа страницы:\n"
            f"  pain_type: {pain_type or '—'}\n"
            f"  Профиль: {(profile.get('profile') or '')[:250]}\n"
            f"  Боль/потребность: {(pain.get('pain_active') or '')[:200]}\n"
            f"  Хочет: {(pain.get('desired_outcome') or '')[:150]}\n\n"
            f"СТРОГО: первой содержательной фразой (после представления) "
            f"НАЗОВИ боль/тему — он должен узнать себя. Дальше — ОДНО "
            f"обещание: ARTIFACT по имени + PROMISE_VOICE. В конце "
            f"укажи где кнопка («слева в меню, в SECTION, иконка как "
            f"ICON_WORD»)."
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
            return _fallback_voice(category_meta, first_name,
                                   b2c_mode=b2c_mode, pain_type=pain_type)
        if len(text) > 1100:
            text = text[:1050].rsplit(".", 1)[0].strip() + "."
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch voice LLM failed (b2c={b2c_mode}): {e}")
        return _fallback_voice(category_meta, first_name,
                               b2c_mode=b2c_mode, pain_type=pain_type)


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
                    b2c_mode: bool = False, pain_type: str = "") -> str:
    name = (first_name or ("друг" if b2c_mode else "коллега")).strip()
    if b2c_mode:
        artifact = _select_artifact(pain_type)
        return (
            f"Здравствуй, {name}. Меня зовут Фреди, я виртуальный психолог. "
            f"Я прошёл по твоей странице — и заметил пару тем, с которыми "
            f"могу помочь. У меня для тебя есть {artifact['name']}: это "
            f"{artifact['promise_voice']}. Когда зайдёшь на сайт — слева в "
            f"меню, в {artifact['section']}, увидишь раздел "
            f"{artifact['name']}, иконка как {artifact['icon_word']}. "
            f"Десять минут, бесплатно, без регистрации. Если зайдёт — "
            f"будешь возвращаться. Если нет — ничего не теряешь."
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
                   b2c_mode: bool = False, pain_type: str = "") -> str:
    if b2c_mode:
        artifact = _select_artifact(pain_type)
        return (
            f"Если что-то из анализа выше откликнулось — у меня для "
            f"тебя есть «{artifact['name']}»: {artifact['promise_text']}. "
            f"Открой {FREDI_LANDING} — слева в боковом меню, в "
            f"{artifact['section']}, найдёшь кнопку {artifact['icon_emoji']} "
            f"«{artifact['name']}». Бесплатно, без регистрации, 10 минут."
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
