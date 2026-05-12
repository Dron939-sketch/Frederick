#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_mirror_pitch.py
Генерация pitch'а по результатам анализа VK-профиля. Два режима:

  B2B (Mirror-pitch) — адресат это ПРАКТИК (психолог/коуч/бьюти-мастер).
  B2C (Глубокий анализ) — адресат это потенциальный клиент Фреди.
    ЦА: женщина 30–40, малый бизнес / самозанятая (бьюти-мастер,
    онлайн-курсы, психолог, эксперт, наставник, маркетолог, SMM,
    фотограф). Эксперт в своём, ценит время, чует продажу с первого
    слова.

B2C-pitch — ЛИЧНОЕ ПРЕДЛОЖЕНИЕ + СЕМЯ-АРТЕФАКТ + RECENCY:
  • Артефакт обещаем как ЛИЧНЫЙ ЖЕСТ ФРЕДИ для НЕЁ — «я напишу тебе
    сказку», «я разложу для тебя Таро», «я подготовлю тебе психотест».
    НЕ «у меня есть функция X».
  • Голос и текст ССЫЛАЮТСЯ НА ОДНО И ТО ЖЕ название инструмента
    (детерминированно по pain_type + cognitive_style); при заходе на
    сайт — рефлекс узнавания.
  • pain_recency определяет тон: current → «сейчас», historical →
    «когда-то ты прошла через...» (НЕ «недавно», когда было год назад).
  • НЕ упоминаем регистрацию и сколько минут — просто «бесплатно».
  • Манеры: мужчина-психолог говорит женщине 30+ на равных, без
    флирта, без комплиментов внешности, без давления.
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
# КАРТЫ АРТЕФАКТОВ: cognitive_style → pain_type → кнопка.
# ------------------------------------------------------------
# personal_offer_text/voice — ГЛАВНОЕ. Это ЛИЧНОЕ обещание Фреди,
# уже сформулированное как «Я напишу тебе...», «Я разложу для тебя
# ...», «Я подготовлю тебе...». Промпт обязан использовать его
# буквально — это и есть «семя» для рефлекса узнавания на лендинге.
# ============================================================

_ARTIFACTS_RATIONAL: Dict[str, Dict[str, str]] = {
    # ===== ОСТРАЯ БОЛЬ =====
    "acute_anxiety": {
        "name": "Гипноз",
        "icon_word": "воронка-спираль",
        "icon_emoji": "🌀",
        "section": "блок «Практики»",
        "personal_offer_text": "Записал тебе сессию: дыхание 4-7-8, заземление 5-4-3-2-1, окно толерантности — тревога мягко снижается",
        "personal_offer_voice": "Я проведу тебя через дыхание четыре-семь-восемь и заземление — тревога снизится за один сеанс",
        "time_minutes": 10,
    },
    "acute_sleep": {
        "name": "Толкование снов",
        "icon_word": "полумесяц",
        "icon_emoji": "🌙",
        "section": "блок «Практики»",
        "personal_offer_text": "Разобрал твои сны по Фрейду и Юнгу плюс приготовил самогипноз для засыпания",
        "personal_offer_voice": "Я разберу твои сны и проведу самогипноз для засыпания",
        "time_minutes": 7,
    },
    "acute_relationships": {
        "name": "Роли и игры",
        "icon_word": "театральная маска",
        "icon_emoji": "🎭",
        "section": "блок «Инструменты»",
        "personal_offer_text": "Подготовил разбор твоих эго-состояний по Берну — увидишь игры, которые повторяются",
        "personal_offer_voice": "Я разберу с тобой твои эго-состояния по Берну — увидишь игры, которые повторяются",
        "time_minutes": 10,
    },
    "acute_burnout": {
        "name": "Дневник",
        "icon_word": "раскрытый блокнот",
        "icon_emoji": "📓",
        "section": "блок «Инструменты»",
        "personal_offer_text": "Завёл для тебя дневник эмоций с AI-рефлексией — буду реагировать на каждую запись",
        "personal_offer_voice": "Я заведу тебе дневник эмоций и разберём автомысли по Беку",
        "time_minutes": 5,
    },
    "acute_identity": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "personal_offer_text": "Собрал тебе психологический тест 4×6 — точный портрет личности, 16 типов",
        "personal_offer_voice": "Я подготовлю тебе психотест на пятнадцать минут — точный портрет личности",
        "time_minutes": 15,
    },
    "acute_meaning": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "personal_offer_text": "Разложил твою структуру личности и доминанту мотивации по 4×6",
        "personal_offer_voice": "Я разложу твою структуру личности и доминанту мотивации",
        "time_minutes": 15,
    },
    "acute_habits": {
        "name": "Якоря",
        "icon_word": "якорь",
        "icon_emoji": "⚓",
        "section": "блок «Практики»",
        "personal_offer_text": "Подготовил тебе якорь нужного состояния — НЛП-техника",
        "personal_offer_voice": "Я закреплю тебе якорь нужного состояния — НЛП-техника",
        "time_minutes": 10,
    },
    "acute_grief": {
        "name": "Дневник",
        "icon_word": "раскрытый блокнот",
        "icon_emoji": "📓",
        "section": "блок «Инструменты»",
        "personal_offer_text": "Завёл для тебя дневник эмоций — мягко разложим сложные чувства",
        "personal_offer_voice": "Я заведу тебе дневник эмоций — мягко разберём сложные чувства",
        "time_minutes": 5,
    },

    # ===== БАЗОВЫЕ ПОТРЕБНОСТИ =====
    "baseline_attention": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "personal_offer_text": "Собрал тебе психотест 4×6 — увидишь себя глазами психолога, не через лайки",
        "personal_offer_voice": "Я подготовлю тебе психотест — увидишь себя глазами психолога, а не через лайки",
        "time_minutes": 15,
    },
    "baseline_recognition": {
        "name": "Зеркало",
        "icon_word": "зеркало",
        "icon_emoji": "🪞",
        "section": "верх бокового меню",
        "personal_offer_text": "Подготовил для тебя зеркало — сравнил тебя с твоими друзьями, увидишь, как тебя считывают",
        "personal_offer_voice": "Я сравню тебя с твоими друзьями — увидишь, как тебя считывают со стороны",
        "time_minutes": 5,
    },
    "baseline_approval": {
        "name": "Дневник",
        "icon_word": "раскрытый блокнот",
        "icon_emoji": "📓",
        "section": "блок «Инструменты»",
        "personal_offer_text": "Завёл для тебя дневник эмоций — место, где не нужны лайки",
        "personal_offer_voice": "Я заведу тебе дневник эмоций — место, где не нужны лайки, только честность",
        "time_minutes": 5,
    },
    "baseline_reflection": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "personal_offer_text": "Разложил твою личность по 4×6 — глубже, чем VK-лента",
        "personal_offer_voice": "Я разложу твою личность по 4 на 6 — глубже, чем VK-лента",
        "time_minutes": 15,
    },
    "baseline_identity": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "personal_offer_text": "Собрал тебе психотест 4 на 6 — кто ты на самом деле, без позиционирования",
        "personal_offer_voice": "Я подготовлю тебе психотест 4 на 6 — точная картина, кто ты на самом деле",
        "time_minutes": 15,
    },
}


_ARTIFACTS_IRRATIONAL: Dict[str, Dict[str, str]] = {
    # ===== ОСТРАЯ БОЛЬ =====
    "acute_anxiety": {
        "name": "Гипноз",
        "icon_word": "воронка-спираль",
        "icon_emoji": "🌀",
        "section": "блок «Практики»",
        "personal_offer_text": "Записал тебе образ безопасного места — голос ведёт, тревога уходит",
        "personal_offer_voice": "Я проведу тебя через образ безопасного места — голос ведёт, тревога уходит",
        "time_minutes": 10,
    },
    "acute_sleep": {
        "name": "Толкование снов",
        "icon_word": "полумесяц",
        "icon_emoji": "🌙",
        "section": "блок «Практики»",
        "personal_offer_text": "Разобрал твой сон через символы и архетипы — что говорит твоё бессознательное",
        "personal_offer_voice": "Я разберу твой сон через символы и архетипы — что говорит твоё бессознательное",
        "time_minutes": 7,
    },
    "acute_relationships": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "personal_offer_text": "Разложил для тебя Таро на отношения — энергии партнёра и точки совместимости",
        "personal_offer_voice": "Я разложу для тебя Таро на отношения — энергии партнёра и точки совместимости",
        "time_minutes": 5,
    },
    "acute_burnout": {
        "name": "Гипноз",
        "icon_word": "воронка-спираль",
        "icon_emoji": "🌀",
        "section": "блок «Практики»",
        "personal_offer_text": "Записал тебе сессию: ресурсное место и образ потока — тело отпустит напряжение",
        "personal_offer_voice": "Я проведу тебя через ресурсное место и образ потока — тело отпустит напряжение",
        "time_minutes": 10,
    },
    "acute_identity": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "personal_offer_text": "Составил твою натальную карту — кто ты по дате рождения, сильные стороны и теневые роли",
        "personal_offer_voice": "Я составлю твою натальную карту — кто ты по дате рождения, сильные стороны и теневые роли",
        "time_minutes": 5,
    },
    "acute_meaning": {
        "name": "Сказки-катарсис",
        "icon_word": "глаз-амулет",
        "icon_emoji": "🧿",
        "section": "блок «Инструменты»",
        "personal_offer_text": "Написал тебе сказку под твой запрос — встреча с собой через образ",
        "personal_offer_voice": "Я напишу тебе сказку под твой запрос — встреча с собой через образ",
        "time_minutes": 5,
    },
    "acute_habits": {
        "name": "Якоря",
        "icon_word": "якорь",
        "icon_emoji": "⚓",
        "section": "блок «Практики»",
        "personal_offer_text": "Подготовил тебе образ-якорь — удержит в нужном состоянии в момент, когда нужно",
        "personal_offer_voice": "Я закреплю тебе образ-якорь — он удержит в нужном состоянии",
        "time_minutes": 10,
    },
    "acute_grief": {
        "name": "Сказки-катарсис",
        "icon_word": "глаз-амулет",
        "icon_emoji": "🧿",
        "section": "блок «Инструменты»",
        "personal_offer_text": "Написал тебе сказку для катарсиса через метафору — когда нет сил говорить прямо",
        "personal_offer_voice": "Я напишу тебе сказку для катарсиса через метафору",
        "time_minutes": 5,
    },

    # ===== БАЗОВЫЕ ПОТРЕБНОСТИ =====
    "baseline_attention": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "personal_offer_text": "Разложил карты на твой день — три картинки скажут о тебе больше, чем лента",
        "personal_offer_voice": "Я разложу карты на твой день — три картинки скажут о тебе больше, чем лента",
        "time_minutes": 5,
    },
    "baseline_recognition": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "personal_offer_text": "Составил твой астрологический портрет — кто ты по знаку и стихии, и как тебя видит мир",
        "personal_offer_voice": "Я составлю твой астрологический портрет — кто ты по знаку и стихии, и как тебя видит мир",
        "time_minutes": 5,
    },
    "baseline_approval": {
        "name": "Толкование снов",
        "icon_word": "полумесяц",
        "icon_emoji": "🌙",
        "section": "блок «Практики»",
        "personal_offer_text": "Разобрал твой последний сон — что говорит бессознательное, чего не дают лайки",
        "personal_offer_voice": "Я разберу твой последний сон — что говорит бессознательное, чего не дают лайки",
        "time_minutes": 7,
    },
    "baseline_reflection": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "personal_offer_text": "Разложил для тебя Таро + натальную карту — зеркало глубже, чем лента",
        "personal_offer_voice": "Я разложу для тебя Таро и натальную карту — зеркало глубже, чем лента",
        "time_minutes": 5,
    },
    "baseline_identity": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "personal_offer_text": "Составил твою натальную карту — точный портрет через дату рождения",
        "personal_offer_voice": "Я составлю твою натальную карту — точный портрет тебя через дату рождения",
        "time_minutes": 5,
    },
}


_DEFAULT_ARTIFACT = _ARTIFACTS_RATIONAL["baseline_attention"]


def _select_artifact(
    pain_type: Optional[str],
    cognitive_style: Optional[str] = "rational",
) -> Dict[str, str]:
    """Детерминированно выбирает артефакт по pain_type + cognitive_style."""
    style = (cognitive_style or "rational").strip().lower()
    bank = _ARTIFACTS_IRRATIONAL if style == "irrational" else _ARTIFACTS_RATIONAL
    if not pain_type:
        return bank.get("baseline_attention", _DEFAULT_ARTIFACT)
    return bank.get(pain_type.strip(), bank.get("baseline_attention", _DEFAULT_ARTIFACT))


def _is_b2c_context(category_meta: Optional[Dict[str, Any]]) -> bool:
    if not category_meta:
        return True
    if not isinstance(category_meta, dict):
        return True
    if not category_meta.get("name_ru") and not category_meta.get("code"):
        return True
    return False


def _gender_label(gender: str) -> str:
    g = (gender or "f").strip().lower()
    if g == "m":
        return "мужской"
    if g == "n":
        return "не указан (дефолт — женский)"
    return "женский"


def _recency_hint(pain_recency: str, pain_event_age: str) -> str:
    """Текстовая инструкция для LLM по тону на основе pain_recency."""
    r = (pain_recency or "").strip().lower()
    age = (pain_event_age or "").strip()
    if r == "current":
        return ("ТОН: пиши про СЕЙЧАС. «Я заметил, что ты сейчас...», "
                "«Видно, что прямо сейчас тебе...». Свежая боль.")
    if r == "recent":
        if age:
            return (f"ТОН: событие было {age}. Пиши как «недавно». "
                    f"«Я заметил, что недавно ты...».")
        return ("ТОН: пиши как «недавно». «Я заметил, что недавно ты...».")
    if r == "historical":
        if age:
            return (f"⚠️ ТОН: событие было {age} — это уже ИСТОРИЯ, НЕ "
                    f"«недавно»! Пиши: «Я заметил, что {age} ты прошла "
                    f"через...», «Когда-то ты писала о...», «У тебя "
                    f"был период, когда...».")
        return ("⚠️ ТОН: событие СТАРЕЕ 3 МЕСЯЦЕВ — НЕ пиши «недавно»! "
                "Пиши: «Когда-то ты прошла через...», «Был у тебя "
                "период...», «Помнишь, ты писала, что...».")
    return ("ТОН: нет конкретного события — пиши о ПАТТЕРНЕ. "
            "«Видно по твоим публикациям...», «Замечаю, что ты часто...», "
            "«Чувствуется, что тебе важно...».")


# ============================================================
# МАНЕРЫ ФРЕДИ — мужчина-психолог обращается к женщине 30+,
# работающей на себя или с малой командой.
# ============================================================
_FREDI_MANNERS = (
    "АУДИТОРИЯ:\n"
    "  Адресат — женщина 30–40, работает на себя или с малой командой "
    "(бьюти-мастер, онлайн-курсы, психолог, эксперт, наставник, "
    "маркетолог, SMM, фотограф, тренер, мастер). Эксперт в своём, "
    "привыкла принимать решения, ценит время больше денег, чует "
    "продажу с первого слова. Видела сотни рассылок и манипуляций.\n\n"
    "  ➜ НЕ объясняй элементарного — она умнее, чем большинство.\n"
    "  ➜ НЕ извиняйся, не упрашивай, не «надеюсь, ты не против».\n"
    "  ➜ Пиши на равных, как опытному коллеге, а не «помогаю разобраться».\n"
    "  ➜ Уважай её время — короткие предложения, минимум воды.\n"
    "  ➜ Не давай тайм-фреймов, не объясняй процесс регистрации.\n\n"
    "МАНЕРЫ ФРЕДИ (мужчина-психолог говорит женщине):\n"
    "  • СПОКОЙНАЯ УВЕРЕННОСТЬ — Фреди не суетится, не извиняется. "
    "Он знает, что делает.\n"
    "  • ВЕДЕНИЕ — утверждение, не вопрос. «Я подобрал тебе...», «Я "
    "приготовил для тебя...», «Я разложу для тебя...» — он предлагает "
    "конкретный путь, она решает идти.\n"
    "  • ВНИМАТЕЛЬНЫЙ ВЗГЛЯД — «Я заметил, что...», «Меня зацепило, "
    "как...», «Вижу, что у тебя...». Она должна почувствовать, что её "
    "ВИДЯТ конкретно, а не как все.\n"
    "  • ГЛУБИНА (не комплименты внешности) — признаёт сложность её "
    "внутреннего мира, паттерн, состояние. НИКОГДА не хвалит "
    "внешность («красивая», «прекрасная»).\n"
    "  • БЕЗОПАСНОСТЬ — здесь нет осуждения, нет «надо», нет давления. "
    "«Если зайдёт — будешь возвращаться. Если нет — ничего не теряешь.»\n"
    "  • ЭКСКЛЮЗИВНОСТЬ — «именно для тебя», «специально подобрал», "
    "«приготовил с учётом того, что увидел у тебя».\n"
    "  • ЖЕНСКИЕ ОКОНЧАНИЯ ГЛАГОЛОВ — если используешь прошедшее время "
    "для адресата — ЖЕНСКАЯ форма («когда ты прочитала», «ты прошла»). "
    "Будущее («увидишь», «найдёшь», «попробуешь») — нейтрально. Фреди "
    "о себе — мужской род («я прошёл», «я заметил», «я подобрал»).\n\n"
    "ЗАПРЕЩЕНО:\n"
    "  • Заискивание: «мне очень бы хотелось», «пожалуйста, попробуй».\n"
    "  • Флирт и сладость: «милая», «солнышко», «дорогая», 💕❤️💋.\n"
    "  • Комплименты внешности: «красивая», «прекрасная», «глаза».\n"
    "  • Снисходительность: «ну, ты же понимаешь», «как ты любишь».\n"
    "  • Восклицания «!!!!», «оооочень», «ВАЖНО!». Тон спокойный.\n"
    "  • Упоминания регистрации, email, пин-кода, сколько минут "
    "длится. Она сама разберётся на сайте — не отнимай у неё время.\n"
    "  • Маркетинговые штампы: «трансформация», «прорыв», «х10», "
    "«решение всех проблем», «гарантирую».\n"
)


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


# === B2C TEXT — концовка письма ===
_B2C_TAIL_SYSTEM = (
    "Ты — копирайтер ТЕКСТОВОЙ концовки письма от Фреди — AI-психолога. "
    "Адресат: ЖЕНЩИНА 30–40, малый бизнес или самозанятая.\n\n"
    "ВАЖНО — голос и текст работают в ПАРЕ:\n"
    "  • Голос (отдельное аудио) обещает один конкретный инструмент "
    "Фреди как ЛИЧНЫЙ ЖЕСТ Фреди для НЕЁ.\n"
    "  • Твой текст — повторяет это же ЛИЧНОЕ предложение + даёт "
    "ССЫЛКУ + указывает кнопку в меню.\n"
    "  • Когда она заходит на сайт и видит в боковом меню ровно эту "
    "кнопку — срабатывает рефлекс узнавания. ЭТО ЦЕЛЬ.\n\n"
    + _FREDI_MANNERS + "\n"
    "В user-сообщении передан ARTIFACT — название кнопки на сайте + "
    "PERSONAL_OFFER_TEXT (готовая фраза в ПРОШЕДШЕМ времени: "
    "«Сделал для тебя...», «Записал тебе...», «Разложил для тебя...»). "
    "Используй буквально — это активирует Cialdini-reciprocity "
    "(подарок уже готов, не «я подготовлю», а «уже сделал»).\n\n"
    "СТРУКТУРА КОНЦОВКИ (5-7 коротких строк, ≈50-80 слов):\n\n"
    "  1) HOOK — наблюдение от ФАКТА (без «Я заметил»):\n"
    "     Если в user-сообщении передана QUOTE_SHORT (короткая "
    "цитата из её поста) — используй её ОДИН раз в формате:\n"
    "       «Зашёл к тебе на страницу — твой пост зацепил, "
    "       особенно «{QUOTE_SHORT}»»\n"
    "     Если QUOTE_SHORT пустой — используй pain_recency:\n"
    "       current  → «Зашёл к тебе на страницу — у тебя сейчас [тема]»\n"
    "       recent   → «Зашёл к тебе на страницу — недавно ты писала про [тема]»\n"
    "       historical → «Зашёл к тебе на страницу — у тебя был период про [тема]»\n"
    "       baseline → «Зашёл к тебе на страницу — у тебя в постах [паттерн]»\n\n"
    "  2) RECIPROCITY-BRIDGE: пустая строка, потом PERSONAL_OFFER_TEXT "
    "     БУКВАЛЬНО (с прошедшим глаголом и эффектом «уже готово»). "
     "     НЕ перефразируй — это уже подарок.\n\n"
    "  3) НАВИГАЦИЯ: «Слева в меню, в {SECTION} — кнопка {EMOJI} «{ARTIFACT}»». "
    "     ЭМОДЗИ И НАЗВАНИЕ из user-сообщения буквально. URL не пиши "
    "     отдельной строкой — он уже неявно через @meysternlp.ru/fredi/, "
    "     лучше быть мягче.\n\n"
    "  4) LOW-FRICTION: «~{TIME_MINUTES} минут на старте». БЕЗ упоминаний "
    "     регистрации, email, пин-кода. БЕЗ «бесплатно» (это шаблонно). "
    "     Только тайминг.\n\n"
    "  5) ПОДПИСЬ: новой строкой «— Фреди».\n\n"
    "ЖЁСТКО:\n"
    "  - Используй PERSONAL_OFFER_TEXT, ARTIFACT, EMOJI, SECTION буквально.\n"
    "  - QUOTE_SHORT использовать в КАВЫЧКАХ-ЁЛОЧКАХ ровно как передан.\n"
    "  - НИКОГДА не пиши «Я заметил», «Я подготовлю» — это уже сделано.\n"
    "  - НИКОГДА «без регистрации», «бесплатно — попробуй», «10 минут "
    "в день», «email», «пин-код» — она сама разберётся.\n"
    "  - НИКОГДА «только для тебя», «уникальное», «успей», "
    "«трансформация», «прорыв», «решу», «помогу», «справишься».\n"
    "  - Не цитируй ВТОРУЮ вещь из её профиля (creepy line).\n"
    "  - Не диагностируй («у тебя депрессия/тревожность/выгорание»).\n"
    "  - Не предлагай ВТОРОЙ инструмент. Один артефакт-семя.\n"
    "  - Без markdown, без списков. Максимум 1 эмодзи (для кнопки).\n"
    "  - Длина ≈50-80 слов (5-7 строк). Это DM, не email.\n"
    "  - Тон: спокойный наблюдатель, не продавец, не терапевт.\n"
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


# === B2C VOICE — 60 сек, ЛИЧНОЕ обещание ===
_B2C_VOICE_SYSTEM = (
    "Ты — копирайтер ГОЛОСОВОГО сообщения от Фреди — AI-психолога. "
    "TTS читает за 50–60 секунд (700–900 символов). Адресат — ЖЕНЩИНА "
    "30–40, малый бизнес или самозанятая.\n\n"
    "ВАЖНО — голос и текст работают в ПАРЕ:\n"
    "  • Голос (твой) — мужчина-психолог делает ЛИЧНОЕ обещание для "
    "НЕЁ: «я напишу тебе», «я разложу для тебя», «я подготовлю тебе».\n"
    "  • Текст (отдельно) — ссылка и повтор того же обещания.\n"
    "  • Когда она заходит на сайт и видит в меню кнопку с тем же "
    "названием — она УЗНАЁТ её. Рефлекс узнавания. ЭТО ЦЕЛЬ.\n\n"
    + _FREDI_MANNERS + "\n"
    "В user-сообщении передан ARTIFACT (название кнопки) + "
    "PERSONAL_OFFER_VOICE (готовая фраза «Я напишу тебе сказку», «Я "
    "разложу для тебя Таро», «Я подготовлю тебе психотест»). "
    "Произнеси PERSONAL_OFFER_VOICE СЛОВО В СЛОВО.\n\n"
    "СТРУКТУРА (60 сек):\n"
    "  1. ПРЕДСТАВЛЕНИЕ (5–8 сек): «Здравствуй, [имя]. Меня зовут "
    "Фреди, я виртуальный психолог. Я прошёл по твоей странице.»\n"
    "  2. ВНИМАТЕЛЬНЫЙ ВЗГЛЯД (10–15 сек): 2-3 коротких предложения. "
    "«Меня зацепило, как ты...» / «Я заметил, что ты...». УЧИТЫВАЙ "
    "pain_recency: current → «сейчас», recent → «недавно», "
    "historical → «когда-то ты прошла через...» (НЕ «недавно»!), "
    "baseline → «вижу, что ты часто...».\n"
    "  3. ЛИЧНОЕ ОБЕЩАНИЕ (15–20 сек): произнеси PERSONAL_OFFER_VOICE "
    "из user-сообщения СЛОВО В СЛОВО. Это уже готовая фраза от "
    "первого лица — мужчина-психолог делает ЛИЧНЫЙ ЖЕСТ для НЕЁ.\n"
    "  4. УКАЗАТЕЛЬ (5–8 сек): «Когда зайдёшь на сайт — слева в меню, "
    "в SECTION, увидишь раздел ARTIFACT, иконка как ICON_WORD». БЕЗ URL.\n"
    "  5. КОРОТКИЙ ВЫХОД (5–8 сек): «Бесплатно. Если зайдёт — будешь "
    "возвращаться. Если нет — ничего не теряешь». БЕЗ упоминаний "
    "регистрации, тайминга, email, пин-кода.\n\n"
    "ЖЁСТКО:\n"
    "  - PERSONAL_OFFER_VOICE — СЛОВО В СЛОВО. Это ядро сообщения.\n"
    "  - ICON_WORD описать словами (НЕ читать эмодзи).\n"
    "  - БЕЗ URL, БЕЗ доменов, БЕЗ эмодзи.\n"
    "  - НИКОГДА не упоминай регистрацию, email, пин-код, «10 минут».\n"
    "  - НЕ предлагай ВТОРОЙ инструмент. Один артефакт.\n"
    "  - БЕЗ диагнозов и пафоса.\n"
    "  - БЕЗ маркетинга («парсинг», «ЦА», «бренд-аудит»).\n"
    "  - Низкий, спокойный темп — это ведущий голос, не диктор рекламы.\n"
    "Возвращай JSON: {\"text\": \"...\"}"
)


async def _llm_tail(category_meta: Dict[str, Any], name: str,
                    b2c_mode: Optional[bool] = None,
                    pain_summary: Optional[Dict[str, Any]] = None,
                    profile_summary: Optional[Dict[str, Any]] = None,
                    gender: str = "f") -> str:
    if b2c_mode is None:
        b2c_mode = _is_b2c_context(category_meta)

    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    pain_type = ""
    pain_recency = ""
    pain_event_age = ""
    cognitive_style = "rational"
    if b2c_mode:
        if pain_summary:
            pain_type = (pain_summary.get("pain_type") or "").strip()
            pain_recency = (pain_summary.get("pain_recency") or "").strip()
            pain_event_age = (pain_summary.get("pain_event_age") or "").strip()
        if profile_summary:
            cognitive_style = (profile_summary.get("cognitive_style")
                               or "rational").strip().lower()

    if not api_key:
        return _fallback_tail(category_meta, b2c_mode=b2c_mode,
                              pain_type=pain_type,
                              cognitive_style=cognitive_style,
                              gender=gender)

    if b2c_mode:
        system = _B2C_TAIL_SYSTEM
        artifact = _select_artifact(pain_type, cognitive_style)
        pa = ""
        if pain_summary:
            pa = (pain_summary.get("pain_active") or "")[:200]
        recency_hint = _recency_hint(pain_recency, pain_event_age)
        # research-tuned: вытащить ОДНУ короткую цитату (если есть)
        # для hook'а — повышает доверие до 10× по Hunter; >1 цитаты =
        # creepy line (Twilio: 42% находят hyper-personalisation
        # неприятной).
        quotes_list = (pain_summary or {}).get("evidence_quotes") or []
        quote_short = _pick_short_quote(quotes_list)
        time_min = artifact.get("time_minutes", 5)
        user_msg = (
            f"Имя адресата: {name or 'друг'}\n"
            f"Пол: {_gender_label(gender)} | Стиль: {cognitive_style}\n\n"
            f"=== СЕМЯ-АРТЕФАКТ (использовать БУКВАЛЬНО) ===\n"
            f"ARTIFACT (в кавычках): «{artifact['name']}»\n"
            f"EMOJI: {artifact['icon_emoji']}\n"
            f"SECTION: {artifact['section']}\n"
            f"PERSONAL_OFFER_TEXT (вставить БУКВАЛЬНО, прошедшее время — "
            f"уже сделанный подарок): {artifact['personal_offer_text']}\n"
            f"TIME_MINUTES: {time_min}\n"
            f"=== /СЕМЯ ===\n\n"
            f"=== АНАЛИЗ ===\n"
            f"pain_type: {pain_type or '—'}\n"
            f"pain_recency: {pain_recency or '—'}\n"
            f"pain_event_age: {pain_event_age or '—'}\n"
            f"pain_active: {pa or '—'}\n"
            f"QUOTE_SHORT (если непусто — ИСПОЛЬЗУЙ в hook'е): "
            f"{quote_short or '— (нет подходящей короткой цитаты)'}\n"
            f"=== /АНАЛИЗ ===\n\n"
            f"{recency_hint}"
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
            return _fallback_tail(category_meta, b2c_mode=b2c_mode,
                                  pain_type=pain_type,
                                  cognitive_style=cognitive_style,
                                  gender=gender)
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch tail LLM failed (b2c={b2c_mode}): {e}")
        return _fallback_tail(category_meta, b2c_mode=b2c_mode,
                              pain_type=pain_type,
                              cognitive_style=cognitive_style,
                              gender=gender)


async def _llm_voice_script(
    profile: Dict[str, Any],
    pain: Dict[str, Any],
    category_meta: Dict[str, Any],
    first_name: str,
    b2c_mode: Optional[bool] = None,
    gender: str = "f",
) -> str:
    if b2c_mode is None:
        b2c_mode = _is_b2c_context(category_meta)

    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    pain_type = ""
    pain_recency = ""
    pain_event_age = ""
    cognitive_style = "rational"
    if b2c_mode:
        pain_type = (pain.get("pain_type") or "").strip()
        pain_recency = (pain.get("pain_recency") or "").strip()
        pain_event_age = (pain.get("pain_event_age") or "").strip()
        cognitive_style = (profile.get("cognitive_style")
                           or "rational").strip().lower()

    if not api_key:
        return _fallback_voice(category_meta, first_name,
                               b2c_mode=b2c_mode, pain_type=pain_type,
                               cognitive_style=cognitive_style,
                               gender=gender)

    if b2c_mode:
        system = _B2C_VOICE_SYSTEM
        artifact = _select_artifact(pain_type, cognitive_style)
        recency_hint = _recency_hint(pain_recency, pain_event_age)
        user_msg = (
            f"Имя адресата: {first_name or 'друг'}\n"
            f"Пол: {_gender_label(gender)} | Стиль: {cognitive_style}\n\n"
            f"=== СЕМЯ-АРТЕФАКТ ===\n"
            f"ARTIFACT: {artifact['name']}\n"
            f"ICON_WORD: {artifact['icon_word']}\n"
            f"SECTION: {artifact['section']}\n"
            f"PERSONAL_OFFER_VOICE (произнести СЛОВО В СЛОВО): "
            f"{artifact['personal_offer_voice']}\n"
            f"=== /СЕМЯ ===\n\n"
            f"=== АНАЛИЗ ===\n"
            f"pain_type: {pain_type or '—'}\n"
            f"pain_recency: {pain_recency or '—'}\n"
            f"pain_event_age: {pain_event_age or '—'}\n"
            f"Профиль: {(profile.get('profile') or '')[:250]}\n"
            f"Боль: {(pain.get('pain_active') or '')[:200]}\n"
            f"Хочет: {(pain.get('desired_outcome') or '')[:150]}\n"
            f"=== /АНАЛИЗ ===\n\n"
            f"{recency_hint}\n\n"
            f"СТРОГО: первой содержательной фразой назови "
            f"наблюдение через внимательный взгляд («я заметил», «меня "
            f"зацепило»). Дальше — ЛИЧНОЕ ОБЕЩАНИЕ: PERSONAL_OFFER_VOICE "
            f"СЛОВО В СЛОВО. Потом куда нажать в меню. В конце — "
            f"коротко «бесплатно, попробуешь». Без упоминания "
            f"регистрации и времени."
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
                                   b2c_mode=b2c_mode, pain_type=pain_type,
                                   cognitive_style=cognitive_style,
                                   gender=gender)
        if len(text) > 1100:
            text = text[:1050].rsplit(".", 1)[0].strip() + "."
        return text
    except Exception as e:
        logger.warning(f"mirror-pitch voice LLM failed (b2c={b2c_mode}): {e}")
        return _fallback_voice(category_meta, first_name,
                               b2c_mode=b2c_mode, pain_type=pain_type,
                               cognitive_style=cognitive_style,
                               gender=gender)


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
                    b2c_mode: bool = False, pain_type: str = "",
                    cognitive_style: str = "rational",
                    gender: str = "f") -> str:
    name = (first_name or ("друг" if b2c_mode else "коллега")).strip()
    if b2c_mode:
        artifact = _select_artifact(pain_type, cognitive_style)
        return (
            f"Здравствуй, {name}. Меня зовут Фреди, я виртуальный психолог. "
            f"Я прошёл по твоей странице — и зацепило, как ты её ведёшь. "
            f"{artifact['personal_offer_voice']}. Когда зайдёшь на сайт — "
            f"слева в меню, в {artifact['section']}, увидишь раздел "
            f"{artifact['name']}, иконка как {artifact['icon_word']}. "
            f"Бесплатно. Если зайдёт — будешь возвращаться. Если нет — "
            f"ничего не теряешь."
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
                   b2c_mode: bool = False, pain_type: str = "",
                   cognitive_style: str = "rational",
                   gender: str = "f") -> str:
    if b2c_mode:
        artifact = _select_artifact(pain_type, cognitive_style)
        time_min = artifact.get("time_minutes", 5)
        return (
            f"Зашёл к тебе на страницу — есть пара вещей, что зацепили.\n\n"
            f"{artifact['personal_offer_text']}.\n\n"
            f"Слева в меню, в {artifact['section']} — кнопка "
            f"{artifact['icon_emoji']} «{artifact['name']}». "
            f"~{time_min} минут на старте.\n\n"
            f"— Фреди"
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
    cog = (profile.get("cognitive_style") or "").strip().lower()
    meta_parts: List[str] = []
    if arch_ru:
        meta_parts.append(f"архетип — {arch_ru}")
    if openness:
        meta_parts.append(f"открытость — {openness}")
    if cog:
        meta_parts.append(f"стиль — {cog}")
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
        recency = pain.get("pain_recency") or ""
        age = pain.get("pain_event_age") or ""
        meta_pain = []
        if intensity:
            meta_pain.append(intensity)
        if recency:
            meta_pain.append(recency)
        if age:
            meta_pain.append(age)
        prefix = f"({' · '.join(meta_pain)}) " if meta_pain else ""
        blocks.append(f"{prefix}{pain['pain_active']}")
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

    gender = analysis.get("gender") or "f"

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
        _llm_tail(category_meta, first_name or "коллега", b2c_mode=False,
                  gender=gender),
        _llm_voice_script(
            analysis.get("profile") or {},
            analysis.get("pain") or {},
            category_meta,
            first_name,
            b2c_mode=False,
            gender=gender,
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
        "gender": gender,
        "analysis": {
            "profile": analysis.get("profile"),
            "pain": analysis.get("pain"),
            "hooks": analysis.get("hooks"),
        },
    }
