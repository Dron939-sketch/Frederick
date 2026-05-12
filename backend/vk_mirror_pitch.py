#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_mirror_pitch.py
Генерация pitch'а по результатам анализа VK-профиля. Два режима:

  B2B (Mirror-pitch) — адресат это ПРАКТИК (психолог/коуч/бьюти-мастер).
  B2C (Глубокий анализ) — адресат это потенциальный клиент Фреди.
    В рассылке адресат — ЖЕНЩИНА (mass-outreach). Фреди говорит как
    мужчина-психолог: спокойная уверенность, ведение, внимательный
    взгляд, глубина (не комплименты), эксклюзивность подбора.

B2C-pitch ДИАГНОСТИЧЕСКИЙ + СЕМЯ-АРТЕФАКТ + COGNITIVE_STYLE:
  • голос и текст ССЫЛАЮТСЯ НА ОДНО И ТО ЖЕ название инструмента
    Фреди (детерминированно выбрано по pain_type + cognitive_style);
  • когда адресат заходит на сайт, она видит в боковом меню ровно ту
    кнопку, о которой Фреди говорил → срабатывает рефлекс узнавания.
  • РАЦИОНАЛЬНОЙ предлагаем тест/Дневник/Роли и игры (Берн)/Зеркало.
  • ИРРАЦИОНАЛЬНОЙ предлагаем Эзотерику (карты/гороскоп)/Толкование
    снов/Сказки-катарсис/Гипноз через образы.
  • названия артефактов СОВПАДАЮТ с надписями кнопок на сайте Фреди
    (см. fredi/index.html: «Зеркало», «Психологический тест»,
    «Дневник», «Гипноз», «Толкование снов», «Роли и игры», «Якоря»,
    «Сказки-катарсис», «Практики», «Эзотерика»).
  • ЧЕСТНО про регистрацию: Фреди требует короткую регистрацию на
    входе (email + 4-значный пин-код). Не обещаем «без регистрации» —
    расхождение убивает доверие на лендинге.
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
# КАРТЫ АРТЕФАКТОВ: по cognitive_style → pain_type → кнопка.
# ------------------------------------------------------------
# Это «семя» — название артефакта произносится в голосе, повторяется
# в тексте, а при заходе на сайт человек видит ИДЕНТИЧНУЮ кнопку в
# боковом меню. Срабатывает рефлекс узнавания: «о, это то, о чём
# говорил Фреди».
#
# RATIONAL — для аналитической аудитории: тест/Дневник/Берн/Зеркало.
# IRRATIONAL — для эзотерической/интуитивной: Эзотерика/Толкование
#   снов/Сказки-катарсис/Гипноз через образы.
# ============================================================

_ARTIFACTS_RATIONAL: Dict[str, Dict[str, str]] = {
    # ===== ОСТРАЯ БОЛЬ =====
    "acute_anxiety": {
        "name": "Гипноз",
        "icon_word": "воронка-спираль",
        "icon_emoji": "🌀",
        "section": "блок «Практики»",
        "promise_text": "снятие тревоги — техники дыхания 4-7-8, заземление 5-4-3-2-1, КПТ-окно толерантности",
        "promise_voice": "снятие тревоги: дыхание четыре-семь-восемь, заземление, окно толерантности",
    },
    "acute_sleep": {
        "name": "Толкование снов",
        "icon_word": "полумесяц",
        "icon_emoji": "🌙",
        "section": "блок «Практики»",
        "promise_text": "разбор снов по Фрейду и Юнгу плюс самогипноз для засыпания",
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
        "promise_text": "дневник эмоций с AI-рефлексией — фиксация состояния, разбор автомыслей, три колонки Бека",
        "promise_voice": "дневник эмоций с AI-рефлексией — разбор автомыслей по Беку",
    },
    "acute_identity": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "promise_text": "психологический тест 4×6 за 15 минут — точный портрет личности, 16 типов",
        "promise_voice": "психологический тест на пятнадцать минут — точный портрет личности 4 на 6",
    },
    "acute_meaning": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "promise_text": "психотест 4×6 — структура личности и доминанта мотивации",
        "promise_voice": "психотест 4 на 6 — структура личности и доминанта мотивации",
    },
    "acute_habits": {
        "name": "Якоря",
        "icon_word": "якорь",
        "icon_emoji": "⚓",
        "section": "блок «Практики»",
        "promise_text": "якорение состояния по НЛП — закрепление нужного настроя за 10 минут",
        "promise_voice": "якорение состояния по НЛП — закрепление нужного настроя",
    },
    "acute_grief": {
        "name": "Дневник",
        "icon_word": "раскрытый блокнот",
        "icon_emoji": "📓",
        "section": "блок «Инструменты»",
        "promise_text": "дневник эмоций с AI-рефлексией — мягкая фиксация и разбор сложных чувств",
        "promise_voice": "дневник эмоций с AI-рефлексией — мягкая фиксация сложных чувств",
    },

    # ===== БАЗОВЫЕ ПОТРЕБНОСТИ =====
    "baseline_attention": {
        "name": "Психологический тест",
        "icon_word": "графики и диаграммы",
        "icon_emoji": "📊",
        "section": "верх бокового меню",
        "promise_text": "увидишь себя глазами психолога, а не через лайки — портрет личности за 15 минут",
        "promise_voice": "психотест на пятнадцать минут — увидишь себя глазами психолога, а не через лайки",
    },
    "baseline_recognition": {
        "name": "Зеркало",
        "icon_word": "зеркало",
        "icon_emoji": "🪞",
        "section": "верх бокового меню",
        "promise_text": "сравнение твоего профиля с друзьями — увидишь, как тебя считывают со стороны",
        "promise_voice": "функция зеркала — сравнишь свой профиль с друзьями и увидишь, как тебя считывают",
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
        "promise_voice": "психологический тест на пятнадцать минут — глубже, чем VK-лента",
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


_ARTIFACTS_IRRATIONAL: Dict[str, Dict[str, str]] = {
    # ===== ОСТРАЯ БОЛЬ =====
    "acute_anxiety": {
        "name": "Гипноз",
        "icon_word": "воронка-спираль",
        "icon_emoji": "🌀",
        "section": "блок «Практики»",
        "promise_text": "мягкое погружение в образ безопасного места — голос Фреди ведёт, тревога уходит",
        "promise_voice": "мягкое погружение в образ безопасного места — голос ведёт, тревога уходит",
    },
    "acute_sleep": {
        "name": "Толкование снов",
        "icon_word": "полумесяц",
        "icon_emoji": "🌙",
        "section": "блок «Практики»",
        "promise_text": "разбор твоих снов — что говорит бессознательное через символы и архетипы",
        "promise_voice": "разбор твоих снов — что говорит бессознательное через символы и архетипы",
    },
    "acute_relationships": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "promise_text": "карта твоих отношений через Таро и астрологию — энергии партнёра, точки совместимости",
        "promise_voice": "карта отношений через Таро и астрологию — энергии партнёра и точки совместимости",
    },
    "acute_burnout": {
        "name": "Гипноз",
        "icon_word": "воронка-спираль",
        "icon_emoji": "🌀",
        "section": "блок «Практики»",
        "promise_text": "восстановление через образы — ресурсное место, источник, поток. Тело отпускает напряжение",
        "promise_voice": "восстановление через образы — ресурсное место, источник, поток",
    },
    "acute_identity": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "promise_text": "натальная карта — кто ты по дате рождения, твои сильные стороны и теневые роли",
        "promise_voice": "натальная карта — кто ты по дате рождения, твои сильные стороны и теневые роли",
    },
    "acute_meaning": {
        "name": "Сказки-катарсис",
        "icon_word": "глаз-амулет",
        "icon_emoji": "🧿",
        "section": "блок «Инструменты»",
        "promise_text": "сказка, написанная под тебя — встреча с собой через образ, без терминов и диагнозов",
        "promise_voice": "сказка, написанная под тебя — встреча с собой через образ",
    },
    "acute_habits": {
        "name": "Якоря",
        "icon_word": "якорь",
        "icon_emoji": "⚓",
        "section": "блок «Практики»",
        "promise_text": "якорь — образ, который держит тебя в нужном состоянии в момент, когда оно нужно",
        "promise_voice": "якорь — образ, который держит тебя в нужном состоянии",
    },
    "acute_grief": {
        "name": "Сказки-катарсис",
        "icon_word": "глаз-амулет",
        "icon_emoji": "🧿",
        "section": "блок «Инструменты»",
        "promise_text": "сказка для тебя — катарсис через метафору, когда нет сил говорить прямо",
        "promise_voice": "сказка для тебя — катарсис через метафору, когда нет сил говорить прямо",
    },

    # ===== БАЗОВЫЕ ПОТРЕБНОСТИ =====
    "baseline_attention": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "promise_text": "разложу карты на твой день — три картинки, которые расскажут о тебе больше, чем лента",
        "promise_voice": "разложу карты на твой день — три картинки, которые скажут о тебе больше, чем лента",
    },
    "baseline_recognition": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "promise_text": "твой астрологический тип — кто ты по знаку и стихии, и как тебя видит мир",
        "promise_voice": "твой астрологический тип — кто ты по знаку и стихии, и как тебя видит мир",
    },
    "baseline_approval": {
        "name": "Толкование снов",
        "icon_word": "полумесяц",
        "icon_emoji": "🌙",
        "section": "блок «Практики»",
        "promise_text": "что говорит твоё бессознательное — твой сон расскажет то, чего не дают лайки",
        "promise_voice": "что говорит твоё бессознательное — твой сон расскажет то, чего не дают лайки",
    },
    "baseline_reflection": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "promise_text": "расклад на твой текущий вопрос — Таро + натальная карта дадут зеркало глубже, чем лента",
        "promise_voice": "расклад на твой вопрос — Таро и натальная карта дадут зеркало глубже, чем лента",
    },
    "baseline_identity": {
        "name": "Эзотерика",
        "icon_word": "магический шар",
        "icon_emoji": "🔮",
        "section": "низ бокового меню",
        "promise_text": "натальная карта — точный портрет тебя через дату рождения, без позиционирования",
        "promise_voice": "натальная карта — точный портрет тебя через дату рождения, без позиционирования",
    },
}


_DEFAULT_ARTIFACT = _ARTIFACTS_RATIONAL["baseline_attention"]


def _select_artifact(
    pain_type: Optional[str],
    cognitive_style: Optional[str] = "rational",
) -> Dict[str, str]:
    """Детерминированно выбирает артефакт по pain_type + cognitive_style.

    cognitive_style = 'irrational' → таро/толкование снов/сказки/гипноз.
    cognitive_style = 'rational' (или любое другое) → тест/Дневник/
                                                       Берн/Зеркало.

    Один и тот же (pain_type, cognitive_style) → один и тот же артефакт.
    Это гарантирует, что голос и текст не разойдутся, и адресат увидит
    на сайте именно ту кнопку, которую обещал Фреди.
    """
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


# ============================================================
# Гендер-окончания (адресат — женщина по умолчанию)
# ============================================================
def _g(gender: str, female: str, male: str, neutral: Optional[str] = None) -> str:
    """Выбирает форму глагола по полу адресата.

    gender: 'f' | 'm' | 'n'. Дефолт у Фреди женский (ЦА), поэтому
    если 'n' и neutral не задано — отдаём female.
    """
    g = (gender or "f").strip().lower()
    if g == "m":
        return male
    if g == "n":
        return neutral if neutral is not None else female
    return female


def _gender_label(gender: str) -> str:
    g = (gender or "f").strip().lower()
    if g == "m":
        return "мужской"
    if g == "n":
        return "не указан (дефолт — женский)"
    return "женский"


# ============================================================
# МАНЕРЫ ФРЕДИ — обращение к женщине от лица мужчины-психолога.
# Используется в B2C-промптах и системных голосовых инструкциях.
# ============================================================
_FREDI_MANNERS = (
    "МАНЕРЫ ФРЕДИ (важно — адресат ЖЕНЩИНА, Фреди — мужчина-психолог):\n"
    "  • СПОКОЙНАЯ УВЕРЕННОСТЬ — Фреди не суетится, не извиняется, "
    "не спрашивает разрешения дважды. Он знает, что делает.\n"
    "  • ВЕДЕНИЕ — «Я подобрал тебе...», «У меня для тебя есть...», "
    "«Я приготовил для тебя...» — утверждение, не вопрос. Не «может, "
    "посмотришь?». Он предлагает конкретный путь — она решает идти.\n"
    "  • ВНИМАТЕЛЬНЫЙ ВЗГЛЯД — «Я заметил, что ты...», «Зацепило, "
    "как...», «Вижу, что у тебя...» — она должна почувствовать что "
    "её ВИДЯТ, а не как все.\n"
    "  • ГЛУБИНА (не комплименты внешности) — признаёт сложность её "
    "внутреннего мира, паттерн, состояние. НИКОГДА не хвалит "
    "внешность («красивая», «прекрасная») — это поверхностно и "
    "обесценивает анализ.\n"
    "  • БЕЗОПАСНОСТЬ — здесь нет осуждения, нет «надо», нет "
    "давления. «Если зайдёт — будешь возвращаться. Если нет — "
    "ничего не теряешь.»\n"
    "  • МЯГКАЯ ЭКСКЛЮЗИВНОСТЬ — «именно для тебя», «специально "
    "подобрал», «приготовил с учётом того, что увидел у тебя».\n"
    "  • ЖЕНСКИЕ ОКОНЧАНИЯ ГЛАГОЛОВ — если используешь прошедшее "
    "время для адресата («когда ты прочитала», «если бы ты "
    "заметила») — ЖЕНСКАЯ форма. БУДУЩЕЕ время («увидишь», "
    "«найдёшь», «попробуешь») — нейтрально, не нужно склонять. "
    "Фреди о себе говорит в мужском роде («я прошёл», «я заметил»).\n\n"
    "ЗАПРЕЩЕНО:\n"
    "  • ЗАИСКИВАТЬ: «мне очень бы хотелось», «пожалуйста, попробуй», "
    "«надеюсь, ты не против».\n"
    "  • ФЛИРТ И СЛАЩАВОСТЬ: «милая», «солнышко», «дорогая», "
    "«золотая», эмодзи 💕❤️💋, «обнимаю», «целую».\n"
    "  • КОМПЛИМЕНТЫ ВНЕШНОСТИ: «красивая», «прекрасная», «глаза», "
    "«улыбка».\n"
    "  • СНИСХОДИТЕЛЬНОСТЬ: «ну, ты же понимаешь», «как ты любишь», "
    "«типичная женская история».\n"
    "  • ЭМОДЗИ И УСИЛИТЕЛИ: «оооочень», восклицания «!!!!», "
    "«ВАЖНО!». Тон спокойный, не возбуждённый.\n"
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


# === B2C TEXT — концовка письма для женщины-адресата ===
_B2C_TAIL_SYSTEM = (
    "Ты — копирайтер ТЕКСТОВОЙ концовки письма от Фреди — AI-психолога. "
    "Адресат: ЖЕНЩИНА, чью страницу VK ты прочитал.\n\n"
    "ВАЖНО — голос и текст работают в ПАРЕ:\n"
    "  • Голос (отдельное аудио) обещает один конкретный инструмент "
    "Фреди по его НАЗВАНИЮ.\n"
    "  • Твой текст — ССЫЛКА + ПОВТОР этого же названия в кавычках + "
    "указание ГДЕ кнопка в меню сайта.\n"
    "  • Когда она заходит на сайт и видит в боковом меню ровно эту "
    "кнопку — срабатывает рефлекс узнавания. ЭТО ЦЕЛЬ.\n\n"
    + _FREDI_MANNERS + "\n"
    "КОНТЕКСТ: ВЫШЕ уже написан психологический профиль + боль/"
    "потребность. В user-сообщении передан ARTIFACT — ТОЧНОЕ название "
    "кнопки на сайте Фреди + эмодзи + что обещаем. Используй буквально.\n\n"
    "СТРУКТУРА КОНЦОВКИ (3-5 коротких строк, связный текст):\n"
    "  1) ОДНА ФРАЗА-НАБЛЮДЕНИЕ: «Я заметил, что ты ...» / «Я вижу, "
    "что ...» / «Меня зацепило, как ты ...» — НАЗОВИ боль/потребность "
    "прямо. Опирайся на анализ выше. Глубина, не комплименты.\n"
    "  2) ПЕРЕХОД К АРТЕФАКТУ: «У меня для тебя есть «ARTIFACT»» / "
    "«Я подобрал тебе «ARTIFACT»» / «Специально для тебя приготовил "
    "«ARTIFACT»» — НАЗВАНИЕ В КАВЫЧКАХ ТОЧНО как в user-сообщении.\n"
    "  3) ОДНО ОБЕЩАНИЕ: что найдёт там, что произойдёт за 10 минут "
    "(используй PROMISE_TEXT, перефразируй мягко).\n"
    "  4) УКАЗАТЕЛЬ-СЕМЯ: «Открой " + FREDI_LANDING + " — слева в "
    "боковом меню, в {SECTION}, увидишь кнопку {EMOJI} «ARTIFACT»». "
    "ВСТАВЬ ЭМОДЗИ И НАЗВАНИЕ ИЗ user-сообщения БУКВАЛЬНО.\n"
    "  5) ЧЕСТНОЕ ЗАВЕРШЕНИЕ: «На старте бесплатно — 10 минут в день. "
    "На входе короткая регистрация: email и 4-значный пин-код, чтобы "
    "прогресс не терялся».\n\n"
    "ЖЁСТКО:\n"
    "  - ARTIFACT и EMOJI из user-сообщения — БУКВАЛЬНО.\n"
    "  - НИКОГДА не пиши «без регистрации» — Фреди ТРЕБУЕТ короткую "
    "регистрацию на входе (email + 4-значный пин-код).\n"
    "  - НЕ предлагай ВТОРОЙ инструмент. Один артефакт-семя.\n"
    "  - НЕ ставь диагнозов («у тебя депрессия», «ты тревожная»).\n"
    "  - НЕ маркетинг («трансформация», «прорыв», «х10», «решение»).\n"
    "  - НЕ перечисляй другие функции Фреди.\n"
    "  - Без markdown, без списков, связный текст. Максимум 1 эмодзи "
    "(тот, что указывает на кнопку в меню).\n"
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


# === B2C VOICE — 60 сек, обещает АРТЕФАКТ, голос мужчины-психолога ===
_B2C_VOICE_SYSTEM = (
    "Ты — копирайтер ГОЛОСОВОГО сообщения от Фреди — AI-психолога. "
    "TTS читает за 50–60 секунд (700–900 символов). Адресат — ЖЕНЩИНА.\n\n"
    "ВАЖНО — голос и текст работают в ПАРЕ:\n"
    "  • Голос (твой) — эмоциональный контакт через манеру мужчины-"
    "психолога + ОБЕЩАНИЕ одного конкретного инструмента Фреди по "
    "его НАЗВАНИЮ.\n"
    "  • Текст (отдельно) — ссылка и повтор этого же названия.\n"
    "  • Когда она заходит на сайт и видит в меню кнопку с тем же "
    "названием — она УЗНАЁТ её. Это рефлекс узнавания. ЭТО ЦЕЛЬ.\n\n"
    + _FREDI_MANNERS + "\n"
    "В user-сообщении тебе передан ARTIFACT — ТОЧНОЕ название "
    "инструмента + описание иконки + что обещаем. Используй буквально.\n\n"
    "СТРУКТУРА (60 сек):\n"
    "  1. ПРЕДСТАВЛЕНИЕ (5–8 сек): «Здравствуй, [имя]. Меня зовут "
    "Фреди, я виртуальный психолог. Я прошёл по твоей странице.»\n"
    "  2. ВНИМАТЕЛЬНЫЙ ВЗГЛЯД (10–15 сек): 2-3 коротких предложения. "
    "«Меня зацепило, как ты...» / «Я заметил, что ты...» / «Видно, "
    "что тебе сейчас...». Назови боль/потребность спокойно, глубоко, "
    "не торопясь. Опирайся на pain_active и pain_type. БЕЗ диагнозов.\n"
    "  3. ВЕДЕНИЕ + ОБЕЩАНИЕ АРТЕФАКТА (15–20 сек): «Специально для "
    "тебя я приготовил ARTIFACT. Это PROMISE_VOICE.» — ARTIFACT "
    "произнести СЛОВО В СЛОВО, как в user-сообщении. Утверждение, "
    "не вопрос.\n"
    "  4. УКАЗАТЕЛЬ-СЕМЯ (5–8 сек): «Когда зайдёшь на сайт — слева "
    "в меню, в SECTION, увидишь раздел ARTIFACT, иконка как "
    "ICON_WORD». БЕЗ URL.\n"
    "  5. ЧЕСТНЫЙ И СПОКОЙНЫЙ ВЫХОД (8–12 сек): «Десять минут в "
    "день — бесплатно. На входе короткая регистрация: email и "
    "четырёхзначный пин, чтобы прогресс не терялся. Если зайдёт — "
    "будешь возвращаться. Если нет — ничего не теряешь».\n\n"
    "ЖЁСТКО:\n"
    "  - ARTIFACT в голосе ПРОИЗНЕСТИ СЛОВО В СЛОВО.\n"
    "  - ICON_WORD описать словами (НЕ читать эмодзи).\n"
    "  - БЕЗ URL, БЕЗ доменов, БЕЗ эмодзи — TTS их не прочитает.\n"
    "  - НИКОГДА не говори «без регистрации» — у Фреди ЕСТЬ короткая "
    "регистрация (email + четырёхзначный пин).\n"
    "  - НЕ предлагай ВТОРОЙ инструмент. Один артефакт за раз.\n"
    "  - БЕЗ диагнозов и пафоса.\n"
    "  - БЕЗ маркетинга («парсинг», «ЦА», «бренд-аудит»).\n"
    "  - КОРОТКИЕ ПРЕДЛОЖЕНИЯ. Низкий, спокойный темп речи — это "
    "ведущий голос, а не диктор рекламы.\n"
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
    cognitive_style = "rational"
    if b2c_mode:
        if pain_summary:
            pain_type = (pain_summary.get("pain_type") or "").strip()
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
        user_msg = (
            f"Имя адресата: {name or 'друг'}\n"
            f"Пол адресата: {_gender_label(gender)} (gender={gender})\n"
            f"Cognitive style: {cognitive_style}\n"
            f"(Адресат — обычная женщина, не практик. Назови боль/"
            f"потребность первой фразой — она должна узнать себя.)\n\n"
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
    cognitive_style = "rational"
    if b2c_mode:
        pain_type = (pain.get("pain_type") or "").strip()
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
        user_msg = (
            f"Имя адресата: {first_name or 'друг'}\n"
            f"Пол адресата: {_gender_label(gender)} (gender={gender})\n"
            f"Cognitive style: {cognitive_style}\n"
            f"(Адресат — обычная женщина, не практик.)\n\n"
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
            f"назови боль/тему через внимательный взгляд («я заметил», "
            f"«меня зацепило»). Дальше — ОДНО обещание: ARTIFACT по "
            f"имени с глаголом-ведением («специально для тебя приготовил», "
            f"«я подобрал тебе») + PROMISE_VOICE. В конце укажи где "
            f"кнопка («слева в меню, в SECTION, иконка как ICON_WORD»). "
            f"Тон спокойного мужчины-психолога — она должна почувствовать, "
            f"что её ведут, а не уговаривают."
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
            f"Я прошёл по твоей странице — и зацепило, как ты держишь её. "
            f"Специально для тебя я приготовил {artifact['name']}: это "
            f"{artifact['promise_voice']}. Когда зайдёшь на сайт — слева "
            f"в меню, в {artifact['section']}, увидишь раздел "
            f"{artifact['name']}, иконка как {artifact['icon_word']}. "
            f"Десять минут в день — бесплатно. На входе короткая "
            f"регистрация: email и четырёхзначный пин, чтобы прогресс "
            f"не терялся. Если зайдёт — будешь возвращаться. Если нет — "
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
        return (
            f"Если что-то из анализа выше откликнулось — у меня для "
            f"тебя есть «{artifact['name']}»: {artifact['promise_text']}. "
            f"Открой {FREDI_LANDING} — слева в боковом меню, в "
            f"{artifact['section']}, найдёшь кнопку {artifact['icon_emoji']} "
            f"«{artifact['name']}». На старте бесплатно — 10 минут в день. "
            f"На входе короткая регистрация (email + 4-значный пин-код), "
            f"чтобы прогресс не терялся."
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
