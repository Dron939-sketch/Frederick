#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Voice Service - сервис для работы с голосом
Поддержка живого голосового диалога (WebSocket + VAD + Barge-in)
Адаптирован из рабочего кода Telegram-бота MAX

ВЕРСИЯ 3.6 — ДОБАВЛЕН speech_to_text_pcm для WebSocket
- Автоматическая конвертация любого аудио в webm/opus для DeepGram
- Восстанавливает знаки препинания в тексте (точки, запятые, вопросительные знаки)
- Добавляет запятые после обращений и вводных слов
- Поддержка вокальных маркеров: [вздох], [смех], [пауза], [кашель]
- ПРЕОБРАЗУЕТ ремарки в паузы и междометия (вздыхает → пауза, смеётся → *смеётся*)
- НЕ удаляет ремарки, а делает речь естественной
- НОВОЕ: _pcm_to_wav + speech_to_text_pcm для WebSocket эндпоинта
"""

import logging
import base64
import asyncio
import os
import time
import traceback
import random
import re
import struct
import subprocess
import tempfile
from typing import Optional, Dict, Any, AsyncGenerator, Callable, Tuple

import httpx
import numpy as np

logger = logging.getLogger(__name__)

# ============================================
# КОНФИГУРАЦИЯ СЕРВИСА
# ============================================
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"

YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
YANDEX_TTS_API_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

VAD_MODE = int(os.getenv("VAD_MODE", "3"))
VAD_SAMPLE_RATE = 16000

# ============================================
# ГОЛОСА YANDEX TTS ДЛЯ РАЗНЫХ РЕЖИМОВ
# ============================================
VOICES = {
    "psychologist": "filipp",   # ermil нестабилен с emotion
    "coach": "filipp",
    "trainer": "filipp",        # alena давал женский голос везде
    "basic": "filipp",
    "default": "filipp"
}

# ============================================
# НАСТРОЙКИ СКОРОСТИ, ТОНА И ЭМОЦИЙ ДЛЯ РАЗНЫХ РЕЖИМОВ
# ============================================
VOICE_SETTINGS = {
    # Скорость снижена на 10% от прежних значений — пользователи
    # жаловались, что Фреди говорит слишком быстро.
    "psychologist": {
        "speed": 0.85,
        "emotion": "neutral",
        "description": "Спокойный, размеренный голос психолога"
    },
    "coach": {
        "speed": 0.90,
        "emotion": "good",
        "description": "Энергичный, мотивирующий голос коуча"
    },
    "trainer": {
        "speed": 1.00,
        "emotion": "good",
        "description": "Быстрый, бодрый голос тренера"
    },
    "basic": {
        "speed": 1.05,
        "emotion": "good",
        "description": "Быстрый, бодрый голос",
        "add_flavor": False
    },
    "default": {
        "speed": 0.90,
        "emotion": "neutral",
        "description": "Стандартный голос"
    }
}

# ============================================
# РЕМАРКИ И ИХ ЗАМЕНА ДЛЯ ЕСТЕСТВЕННОГО ОЗВУЧИВАНИЯ
# ============================================

REMAKE_TO_TEXT = {
    r'\b(делает паузу|пауза|молчит|замолкает)\b': '... ',
    r'\b(долгая пауза|задумался|задумалась|задумывается)\b': '... ... ',
    r'\b(вздыхает|вздохнул|вздохнула|вздыхая)\b': '... ',
    r'\b(смеётся|засмеялся|засмеялась|усмехается|смеясь)\b': ' *смеётся* ',
    r'\b(улыбается|улыбнулся|улыбнулась|улыбнувшись)\b': ' *с улыбкой* ',
    r'\b(тихо|шёпотом)\s+(говорит|сказал|сказала|промолвил)\b': ' ... ',
    r'\b(шутливо|смеясь)\s+(говорит|сказал|сказала)\b': ' *смеётся* ',
    r'\b(серьёзно|строго)\s+(говорит|сказал|сказала)\b': ' ... ',
    r'\b(иронично|с иронией)\s+(говорит|сказал|сказала)\b': ' *с иронией* ',
    r'\b(смотрит|посмотрел|посмотрела|глядит|взглянул)\s+в окно\b': ' ... ',
    r'\b(смотрит|посмотрел|посмотрела|глядит|взглянул)\s+на часы\b': ' ... ',
    r'\b(отводит|отвел|отвела)\s+взгляд\b': ' ... ',
    r'\b(пожимает|пожал)\s+плечами\b': ' ... ',
    r'\b(кивает|кивнул|кивнула|кивая)\b': ' да ',
    r'\b(качает|покачал|покачивает)\s+головой\b': ' нет ',
    r'\b(встаёт|встал|встала|поднимается)\b': ' ... ',
    r'\b(садится|сел|села|присаживается)\b': ' ... ',
    r'\b(отворачивается|отвернулся|отвернулась)\b': ' ... ',
    r'\b(прикрывает|прикрыл|прикрыла)\s+глаза\b': ' ... ',
    r'\b(проводит|провёл|провела)\s+рукой\b': ' ... ',
    r'^\s*(тихо|шёпотом|смеясь|вздыхая|задумчиво|с грустью|с иронией)\s*[,.]?\s*': '',
    r'^\s*(делает паузу|пауза)\s*[,.]?\s*': '',
    r'\bя\s+(вздыхаю|смеюсь|кашляю|молчу|задумываюсь)\b': '... ',
}

VOCAL_MARKERS = {
    '[вздох]': '... ',
    '[вздыхает]': '... ',
    '[смех]': ' *смеётся* ',
    '[смеётся]': ' *смеётся* ',
    '[пауза]': '... ',
    '[кашель]': '... ',
    '[молчание]': '... ',
    '[задумчиво]': '... ',
    '[тихо]': ' ',
    '[шёпотом]': ' ',
    '[радостно]': '! ',
    '[удивлённо]': '?! ',
    '[грустно]': '... ',
    '[иронично]': ' *с иронией* '
}


def process_remakes_to_text(text: str) -> str:
    if not text:
        return text
    original = text
    for pattern, replacement in REMAKE_TO_TEXT.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE | re.UNICODE)
    if text != original:
        logger.debug(f"🎭 Ремарки преобразованы: '{original[:80]}...' → '{text[:80]}...'")
    return text


def process_vocal_markers(text: str) -> str:
    if not text:
        return text
    original = text
    for marker, replacement in VOCAL_MARKERS.items():
        text = text.replace(marker, replacement)
    text = re.sub(r'\s+', ' ', text)
    if text != original:
        logger.debug(f"🎭 Вокальные маркеры обработаны: '{original[:100]}' → '{text[:100]}'")
    return text


# ============================================
# ВОССТАНОВЛЕНИЕ ПУНКТУАЦИИ
# ============================================

def restore_punctuation(text: str) -> str:
    if not text:
        return text
    original = text
    if text and text[-1] not in '.!?':
        text += '.'
    text = re.sub(r'([.!?])([А-ЯЁA-Zа-яёa-z0-9])', r'\1 \2', text)
    text = re.sub(r'([.!?])\1+', r'\1', text)
    text = re.sub(r'([,;:])\1+', r'\1', text)
    text = re.sub(r',\s*,', ',', text)
    text = re.sub(r'\,\s*\)', ')', text)
    # Заменяем только дефис-разделитель (пробел-дефис-пробел), не трогаем дефисы в словах
    text = re.sub(r'(?<=\s)-(?=\s)', '—', text)
    text = re.sub(r'—\s*—', '—', text)
    text = re.sub(r',\s*(и|а|но|или|да)\s+', r' \1 ', text, flags=re.IGNORECASE)
    text = re.sub(r'\b(не|ни)\s*,', r'\1', text, flags=re.IGNORECASE)
    # Запятые после обращений и вводных слов НЕ добавляем —
    # это делает речь дёрганой. Yandex TTS справляется сам.
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s*([.,!?:;])\s*', r'\1 ', text)
    text = re.sub(r'\s+([.,!?:;])', r'\1', text)
    text = re.sub(r'\s{2,}', ' ', text)
    if len(text) > 1 and text[-1] in '.!?' and text[-2] in '.!?':
        text = text[:-1]
    text = re.sub(r',\s*\.', '.', text)
    if text != original:
        logger.debug(f"🔄 Восстановлена пунктуация: '{original[:100]}...' → '{text[:100]}...'")
    return text


# ============================================
# НОРМАЛИЗАЦИЯ ЧИСЕЛ И ДАТ
# ============================================

def normalize_numbers(text: str) -> str:
    """Финальный fallback для оставшихся в тексте цифр.

    Запускается ПОСЛЕ _normalize_dates_temps_numbers — даты, температура,
    время и года уже превращены в слова. Здесь обрабатываем «свободные»
    числа: "5 минут", "1500 рублей", "200 раз", "1.5 часа", "10%".

    Зачем: TTS-движки (Fish Audio, Yandex) читают «5 минут» либо как
    «пять минут», либо коверкают окончания. Прописное число гарантирует
    правильное произношение, плюс TTS говорит «пять минут» естественнее
    чем «5 минут».
    """
    if not text:
        return text
    original = text

    # 1. Проценты: «5%» → «5 процентов» (потом цифра тоже превратится в слова)
    text = re.sub(r'(\d+)\s*%', r'\1 процентов', text)

    # 2. Десятичные дроби: «1.5» / «1,5» → «одна целая пять».
    # Сначала, чтобы целые/десятые не разделились на отдельные числа.
    def _decimal_to_words(m):
        try:
            whole = int(m.group(1))
            frac = m.group(2)
            return f"{_num_to_words_ru(whole)} целых {_num_to_words_ru(int(frac))}"
        except (ValueError, TypeError):
            return m.group(0)
    text = re.sub(r'\b(\d+)[.,](\d{1,3})\b', _decimal_to_words, text)

    # 3. Все оставшиеся целые числа. Без word-boundary — чтобы поймать
    #    цифры, прилипшие к буквам типа «5G», «iPhone14», «PS5».
    #    Раньше \b\d+\b их пропускал и TTS произносил по цифрам.
    def _int_to_words(m):
        try:
            n = int(m.group(0))
            # Оставляем огромные числа как есть, иначе num2words на больших
            # числах генерит километры слов.
            if abs(n) > 10**9:
                return m.group(0)
            return _num_to_words_ru(n)
        except (ValueError, OverflowError):
            return m.group(0)
    text = re.sub(r'\d+', _int_to_words, text)

    if text != original:
        logger.debug(f"🔢 Нормализованы числа: '{original[:100]}' → '{text[:100]}'")
    return text


# ============================================
# Числа → слова (русский). Дата, температура, время, год.
# Без этого Fish Audio / Yandex TTS читают «1961» по цифрам, а
# «25°C» вообще пропускают — звучит как «двадцать пять» без «градусов».
# ============================================
try:
    from num2words import num2words as _num2words_lib
    _NUM2WORDS_AVAILABLE = True
except Exception:
    _NUM2WORDS_AVAILABLE = False


def _num_to_words_ru(n: int, kind: str = "cardinal") -> str:
    """Цифру → слова. kind: 'cardinal' (один, два) | 'ordinal' (первый, второй)."""
    if not _NUM2WORDS_AVAILABLE:
        return str(n)
    try:
        return _num2words_lib(int(n), lang="ru", to=kind)
    except Exception:
        return str(n)


_RU_MONTHS_GEN = (
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
)


def _date_to_words(m: re.Match) -> str:
    """12.04.1961 → «двенадцатого апреля тысяча девятьсот шестьдесят первого года»."""
    try:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    except (ValueError, TypeError):
        return m.group(0)
    if not (1 <= day <= 31 and 1 <= month <= 12):
        return m.group(0)
    if year < 100:
        year += 2000 if year < 50 else 1900  # 25→2025, 99→1999
    parts = [
        _num_to_words_ru(day, "ordinal"),
        _RU_MONTHS_GEN[month - 1],
        _num_to_words_ru(year, "ordinal") + " года",
    ]
    return " ".join(parts)


def _temp_to_words(m: re.Match) -> str:
    """+25°C / -15° / 25°C → «плюс двадцать пять градусов» / «минус пятнадцать градусов»."""
    sign = (m.group(1) or "").strip()
    try:
        n = int(m.group(2))
    except (ValueError, TypeError):
        return m.group(0)
    sign_word = ""
    if sign in ("-", "−", "–"):
        sign_word = "минус "
    elif sign == "+":
        sign_word = "плюс "
    return f"{sign_word}{_num_to_words_ru(n)} градусов"


def _time_to_words(m: re.Match) -> str:
    """15:30 → «пятнадцать часов тридцать минут»."""
    try:
        h, mn = int(m.group(1)), int(m.group(2))
    except (ValueError, TypeError):
        return m.group(0)
    if not (0 <= h <= 23 and 0 <= mn <= 59):
        return m.group(0)
    return f"{_num_to_words_ru(h)} часов {_num_to_words_ru(mn)} минут"


def _year_to_words(m: re.Match) -> str:
    """Изолированный 4-значный год: «в 1961 году» → «в тысяча девятьсот шестьдесят первом году»."""
    try:
        y = int(m.group(1))
    except (ValueError, TypeError):
        return m.group(0)
    if not (1000 <= y <= 2100):
        return m.group(0)
    return f"{_num_to_words_ru(y, 'ordinal')} {m.group(2)}"


_RE_DATE = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b")
# Даты через слэш / дефис: 12/04/2024, 12-04-2024, 12/04/24
_RE_DATE_SLASH = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b")
# Дата без года: «15 марта», «15-го марта», «15 февраля» — день должен
# быть порядковым в родительном падеже («пятнадцатого»).
_RE_DATE_DAY_MONTH = re.compile(
    r"\b(\d{1,2})(?:-го|-ого|-ое|-е)?\s+("
    r"январ[яе]|феврал[яе]|март[ае]|апрел[яе]|ма[яе]|июн[яе]|июл[яе]|"
    r"август[ае]|сентябр[яе]|октябр[яе]|ноябр[яе]|декабр[яе])\b",
    re.IGNORECASE,
)
_RE_TEMP = re.compile(r"([+\-−–])?\s*(\d+)\s*°\s*[CcСсFfFf]?", re.IGNORECASE)
_RE_TIME = re.compile(r"\b(\d{1,2}):(\d{2})\b")
# 4-значный год перед «год/году/года/годом/годе»
_RE_YEAR = re.compile(r"\b(\d{4})\s+(год[уаеомы]?)\b", re.IGNORECASE)
# Денежные суммы. Символы валют + сокращения. Сами цифры заменим
# на _num_to_words_ru, валюту — на полное русское слово.
# ВАЖНО: длинные альтернативы (рублей, доллар) ставим ПЕРЕД короткими
# (руб, р.) — иначе `р\.?` сматчит просто «р» из «руб», и хвост «уб»
# останется в выводе как мусор.
_RE_MONEY = re.compile(
    r"(?:(\$|₽|€|£|¥)\s*(\d+)|"           # $100, ₽1500
    r"(\d+)\s*(\$|₽|€|£|¥)|"                # 100$, 1500₽
    r"(\d+)\s*(рублей|рубля|рубль|руб\.?|р\.?|"  # длинные → короткие
    r"долларов|доллара|доллар|долл\.?|"
    r"евро|фунтов|фунта|фунт|иены|иена|иен)\b)",
    re.IGNORECASE,
)


def _date_slash_to_words(m: re.Match) -> str:
    """12/04/2024 / 12-04-24 → словами через тот же _date_to_words."""
    return _date_to_words(m)


def _date_day_month_to_words(m: re.Match) -> str:
    """«15 марта» → «пятнадцатого марта». Месяц приводим к род. падежу."""
    try:
        day = int(m.group(1))
    except (ValueError, TypeError):
        return m.group(0)
    if not (1 <= day <= 31):
        return m.group(0)
    month_word = m.group(2).lower()
    # Сводим к роду «месяц + а/я» → правильный род. падеж из _RU_MONTHS_GEN.
    month_idx_map = {
        "январь": 0, "января": 0, "январе": 0,
        "февраль": 1, "февраля": 1, "феврале": 1,
        "март": 2, "марта": 2, "марте": 2,
        "апрель": 3, "апреля": 3, "апреле": 3,
        "май": 4, "мая": 4, "мае": 4,
        "июнь": 5, "июня": 5, "июне": 5,
        "июль": 6, "июля": 6, "июле": 6,
        "август": 7, "августа": 7, "августе": 7,
        "сентябрь": 8, "сентября": 8, "сентябре": 8,
        "октябрь": 9, "октября": 9, "октябре": 9,
        "ноябрь": 10, "ноября": 10, "ноябре": 10,
        "декабрь": 11, "декабря": 11, "декабре": 11,
    }
    idx = month_idx_map.get(month_word)
    if idx is None:
        return m.group(0)
    return f"{_num_to_words_ru(day, 'ordinal')} {_RU_MONTHS_GEN[idx]}"


_CURRENCY_WORDS = {
    "$": "долларов", "долл": "долларов", "доллар": "долларов",
    "доллара": "долларов", "долларов": "долларов",
    "₽": "рублей", "р": "рублей", "руб": "рублей", "рубль": "рублей",
    "рубля": "рублей", "рублей": "рублей",
    "€": "евро", "евро": "евро",
    "£": "фунтов", "фунт": "фунтов", "фунта": "фунтов", "фунтов": "фунтов",
    "¥": "иен", "иен": "иен", "иены": "иен", "иена": "иен",
}


def _money_to_words(m: re.Match) -> str:
    """$100 / 100₽ / 1500 руб. → «сто долларов» / «тысяча пятьсот рублей»."""
    sym_pre, num_pre = m.group(1), m.group(2)
    num_post1, sym_post1 = m.group(3), m.group(4)
    num_post2, word_post = m.group(5), m.group(6)
    try:
        if num_pre and sym_pre:
            n, key = int(num_pre), sym_pre
        elif num_post1 and sym_post1:
            n, key = int(num_post1), sym_post1
        elif num_post2 and word_post:
            n, key = int(num_post2), word_post.rstrip(".").lower()
        else:
            return m.group(0)
    except (ValueError, TypeError):
        return m.group(0)
    word = _CURRENCY_WORDS.get(key, _CURRENCY_WORDS.get(key.lower(), ""))
    if not word:
        return m.group(0)
    return f"{_num_to_words_ru(n)} {word}"


def _normalize_dates_temps_numbers(text: str) -> str:
    """Преобразование чисел/дат/температуры/денег в слова перед TTS.

    Порядок важен:
    - даты с точками (dd.mm.yyyy) РАНЬШЕ времени (hh:mm), иначе
      «12.04» в «12.04.1961» съест регэксп времени;
    - даты со слэшем/дефисом — после точечных, чтобы не путаться;
    - дата без года («15 марта») — после полных дат, иначе зацепит «15»
      из «15.03.2024»;
    - деньги — раньше catch-all чисел, чтобы валюта присоединилась.
    """
    if not text:
        return text
    text = _RE_DATE.sub(_date_to_words, text)
    text = _RE_DATE_SLASH.sub(_date_slash_to_words, text)
    text = _RE_DATE_DAY_MONTH.sub(_date_day_month_to_words, text)
    text = _RE_MONEY.sub(_money_to_words, text)
    text = _RE_TEMP.sub(_temp_to_words, text)
    text = _RE_TIME.sub(_time_to_words, text)
    text = _RE_YEAR.sub(_year_to_words, text)
    return text


# ============================================
# НОРМАЛИЗАЦИЯ ТЕКСТА ДЛЯ YANDEX TTS
# ============================================

def normalize_tts_text(text: str) -> str:
    if not text:
        return ""
    original = text

    # ФИХ 0а: убираем ремарки — DeepSeek добавляет актёрские пометки
    # (Мягко), (спокойно), *вздыхает*, **задумчиво** — не нужны в голосе
    text = re.sub(r'\([^)]*[а-яёА-ЯЁ][^)]{0,50}\)\s*', '', text)  # (ремарка) с кириллицей
    text = re.sub(r'\*\*?[^*]{1,40}\*\*?\s*', '', text)            # *ремарка* и **ремарка**

    # ФИХ 0б: восстанавливаем пробелы — DeepSeek склеивает слова
    # "Привет,как" → "Привет, как"  |  "КакДела" → "Как Дела"
    text = re.sub(r'([.!?,;:])([^\s\d\)\]\}])', r'\1 \2', text)
    text = re.sub(r'([\u2014\u2013])([^\s])', r'\1 \2', text)
    text = re.sub(r'([\u0430-\u044f\u0451])([\u0410-\u042f\u0401])', r'\1 \2', text)
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"
        "\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF"
        "\U0001F700-\U0001F77F"
        "\U0001F780-\U0001F7FF"
        "\U0001F800-\U0001F8FF"
        "\U0001F900-\U0001F9FF"
        "\U0001FA00-\U0001FA6F"
        "\U0001FA70-\U0001FAFF"
        "]+",
        flags=re.UNICODE
    )
    text = emoji_pattern.sub('', text)
    text = process_remakes_to_text(text)
    text = process_vocal_markers(text)
    text = re.sub(r'[#_`~<>|@$%^&+={}\\]', '', text)
    # Числа/даты/температура/время/годы → слова. Без этого Fish Audio
    # читает «12.04.1961» по точкам/цифрам, «25°C» проскакивает мимо.
    text = _normalize_dates_temps_numbers(text)
    # Финальный fallback: оставшиеся «свободные» цифры — в слова.
    # «5 минут» → «пять минут», «1500 рублей» → «тысяча пятьсот рублей».
    # TTS не может произнести «5» с правильным склонением — слова надёжнее.
    text = normalize_numbers(text)
    # restore_punctuation убрана — base_mode уже нормализует пунктуацию.
    # Оставляем только добавление точки в конце если её нет
    if text and text[-1] not in '.!?':
        text += '.'
    text = re.sub(r'\s+', ' ', text).strip()
    if not text or len(text) < 2:
        text = "Вопрос интересный. Расскажите подробнее."
    text = text.replace('*', '')
    if text != original:
        logger.debug(f"🔄 Нормализован текст: '{original[:100]}...' → '{text[:100]}...'")
    return text


# ============================================
# КОНВЕРТАЦИЯ АУДИО ДЛЯ DEEPGRAM
# ============================================

async def convert_to_webm(audio_bytes: bytes, source_format: str) -> Optional[bytes]:
    if source_format == "webm":
        return audio_bytes
    logger.info(f"🔄 Конвертируем {source_format} → webm/opus")
    try:
        with tempfile.NamedTemporaryFile(suffix=f'.{source_format}', delete=False) as f_in:
            f_in.write(audio_bytes)
            input_path = f_in.name
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f_out:
            output_path = f_out.name
        cmd = [
            'ffmpeg', '-i', input_path,
            '-c:a', 'libopus', '-b:a', '48k',
            '-ar', '16000', '-ac', '1',
            '-f', 'webm', '-y', output_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if result.returncode != 0:
            logger.error(f"FFmpeg ошибка: {result.stderr.decode()[:200]}")
            return None
        with open(output_path, 'rb') as f:
            converted = f.read()
        try:
            os.unlink(input_path)
            os.unlink(output_path)
        except Exception:
            pass
        logger.info(f"✅ Конвертация успешна: {len(audio_bytes)} → {len(converted)} байт")
        return converted
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timeout")
        return None
    except FileNotFoundError:
        logger.error("FFmpeg не установлен!")
        return None
    except Exception as e:
        logger.error(f"Ошибка конвертации: {e}")
        return None


async def check_audio_quality(audio_bytes: bytes, audio_format: str) -> Dict[str, Any]:
    try:
        if audio_format == "wav" and len(audio_bytes) > 44:
            sample_rate = int.from_bytes(audio_bytes[24:28], 'little')
            bits = int.from_bytes(audio_bytes[34:36], 'little')
            channels = int.from_bytes(audio_bytes[22:24], 'little')
            return {"format": "wav", "sample_rate": sample_rate, "bits": bits, "channels": channels, "size": len(audio_bytes)}
        return {"format": audio_format, "size": len(audio_bytes)}
    except Exception as e:
        logger.warning(f"Ошибка проверки аудио: {e}")
        return {"error": str(e)}


# ============================================
# ГЛОБАЛЬНЫЙ HTTP КЛИЕНТ
# ============================================
_http_client: Optional[httpx.AsyncClient] = None
_client_lock = asyncio.Lock()


async def get_http_client():
    global _http_client
    if _http_client is None:
        async with _client_lock:
            if _http_client is None:
                limits = httpx.Limits(max_keepalive_connections=10, max_connections=50, keepalive_expiry=30)
                timeouts = httpx.Timeout(connect=30.0, read=60.0, write=30.0, pool=None)
                _http_client = httpx.AsyncClient(limits=limits, timeout=timeouts, follow_redirects=True)
                logger.info("✅ Глобальный HTTPX клиент создан")
    return _http_client


async def close_http_client():
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None
        logger.info("🔒 HTTPX клиент закрыт")


# ============================================
# VAD - Voice Activity Detection
# ============================================

class VADDetector:
    def __init__(self, sample_rate: int = 16000, mode: int = 3):
        self.sample_rate = sample_rate
        self.mode = mode
        self.frame_duration = 30
        self.frame_size = int(sample_rate * self.frame_duration / 1000)
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False
        self.speech_trigger_frames = 3
        self.silence_trigger_frames = 10
        self.energy_threshold = 0.01
        self.vad = None
        self.has_vad = False
        try:
            import webrtcvad
            self.vad = webrtcvad.Vad(mode)
            self.has_vad = True
            logger.info(f"✅ WebRTC VAD инициализирован (mode={mode})")
        except ImportError:
            logger.info("ℹ️ WebRTC VAD не установлен → используется энергетический VAD")

    def reset(self):
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False

    def _calculate_energy(self, audio_chunk: bytes) -> float:
        try:
            audio_array = np.frombuffer(audio_chunk, dtype=np.int16)
            rms = np.sqrt(np.mean(audio_array.astype(np.float32) ** 2))
            return rms / 32768.0
        except Exception:
            return 0.0

    def _is_speech_energy(self, audio_chunk: bytes) -> bool:
        return self._calculate_energy(audio_chunk) > self.energy_threshold

    def _is_speech_webrtc(self, audio_chunk: bytes) -> bool:
        if not self.has_vad or len(audio_chunk) != self.frame_size * 2:
            return self._is_speech_energy(audio_chunk)
        try:
            return self.vad.is_speech(audio_chunk, self.sample_rate)
        except Exception:
            return self._is_speech_energy(audio_chunk)

    def process_chunk(self, audio_chunk: bytes) -> Dict[str, Any]:
        result = {
            "is_speech": False, "speech_started": False, "speech_ended": False,
            "is_speaking": self.is_speaking, "energy": self._calculate_energy(audio_chunk)
        }
        is_speech = self._is_speech_webrtc(audio_chunk)
        result["is_speech"] = is_speech
        if is_speech and not self.is_speaking:
            self.speech_frames += 1
            if self.speech_frames >= self.speech_trigger_frames:
                self.is_speaking = True
                result["speech_started"] = True
                result["is_speaking"] = True
                self.speech_frames = 0
        elif is_speech and self.is_speaking:
            self.silence_frames = 0
        elif not is_speech and self.is_speaking:
            self.silence_frames += 1
            if self.silence_frames >= self.silence_trigger_frames:
                self.is_speaking = False
                result["speech_ended"] = True
                result["is_speaking"] = False
                self.silence_frames = 0
        else:
            self.speech_frames = 0
            self.silence_frames = 0
        return result


# ============================================
# STT - Speech-to-Text (DeepGram)
# ============================================

async def speech_to_text(audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
    logger.info(f"🎤 Распознавание речи, формат: {audio_format}, размер: {len(audio_bytes)} байт")
    if not DEEPGRAM_API_KEY:
        logger.error("❌ DEEPGRAM_API_KEY не настроен")
        return None
    if len(audio_bytes) < 1000:
        logger.warning(f"⚠️ Аудио слишком короткое: {len(audio_bytes)} байт")
        return None
    audio_info = await check_audio_quality(audio_bytes, audio_format)
    logger.info(f"📊 Аудио параметры: {audio_info}")
    if audio_format != "webm":
        converted = await convert_to_webm(audio_bytes, audio_format)
        if converted:
            audio_bytes = converted
            audio_format = "webm"
        else:
            logger.warning(f"⚠️ Не удалось конвертировать {audio_format}, пробуем оригинал")
    mime_types = {"webm": "audio/webm", "ogg": "audio/ogg", "wav": "audio/wav", "mp3": "audio/mpeg", "mp4": "audio/mp4"}
    content_type = mime_types.get(audio_format, "audio/webm")
    headers = {"Authorization": f"Token {DEEPGRAM_API_KEY}", "Content-Type": content_type}
    # keywords=<слово>:<вес> усиливает распознавание редких/специфичных слов.
    # В логах часто «Фреди» распознавался как «Фрейзи/Фразия/Пройди/Вроде».
    # Вес 2 — мягкое boost, чтобы не тянуть false-positives.
    params = {
        "model": "nova-2", "language": "ru",
        "punctuate": "true", "smart_format": "true",
        "keywords": ["Фреди:2", "Фредди:2", "Фредерик:1"],
    }
    try:
        client = await get_http_client()
        response = await client.post(DEEPGRAM_API_URL, headers=headers, params=params, content=audio_bytes, timeout=30.0)
        if response.status_code == 200:
            data = response.json()
            # Учёт расходов: длительность аудио из metadata.duration (секунды).
            try:
                import asyncio as _aio
                from services.api_usage import log_stt_usage
                dur = float(((data or {}).get("metadata") or {}).get("duration") or 0.0)
                _aio.create_task(log_stt_usage(
                    provider="deepgram", model="nova-2",
                    seconds=dur,
                    feature="stt.deepgram",
                ))
            except Exception as _e:
                logger.warning(f"api_usage skip: {_e}")
            try:
                transcript = data['results']['channels'][0]['alternatives'][0].get('transcript', '')
                confidence = data['results']['channels'][0]['alternatives'][0].get('confidence', 0)
                logger.info(f"🎤 Распознано: '{transcript}' (уверенность: {confidence:.2f})")
                return transcript.strip() if transcript and transcript.strip() else None
            except (KeyError, IndexError) as e:
                logger.error(f"❌ Не удалось извлечь транскрипт: {e}")
                return None
        else:
            logger.error(f"❌ DeepGram error {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"❌ Ошибка распознавания речи: {e}")
        return None


# ============================================
# TTS - Text-to-Speech (Yandex)
# ============================================

async def text_to_speech(text: str, mode: str = "psychologist") -> Optional[bytes]:
    logger.info(f"🎤 TTS запрос — режим: {mode}")
    if not text or not text.strip():
        logger.warning("⚠️ Пустой текст для TTS")
        return None

    # ===== ДИАГНОСТИКА: текст ДО нормализации =====
    text_original = text
    logger.info("=" * 70)
    logger.info("🔍 TTS PIPELINE START")
    logger.info(f"  [0] ОРИГИНАЛ ({len(text)} симв): {repr(text[:300])}")

    # Применяем нормализацию пошагово для диагностики
    import re as _re

    _t1 = _re.sub(
        "[" "\U0001F600-\U0001F64F" "\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF" "\U0001F900-\U0001F9FF"
        "\U0001FA00-\U0001FAFF" "]+",
        '', text, flags=_re.UNICODE
    )
    if _t1 != text:
        logger.info(f"  [1] ПОСЛЕ убирания эмодзи: {repr(_t1[:200])}")

    _t2 = process_remakes_to_text(_t1)
    if _t2 != _t1:
        logger.info(f"  [2] ПОСЛЕ ремарок: {repr(_t2[:200])}")

    _t3 = process_vocal_markers(_t2)
    if _t3 != _t2:
        logger.info(f"  [3] ПОСЛЕ вокальных маркеров: {repr(_t3[:200])}")

    _t4 = _re.sub(r'[#_`~<>|@$%^&+={}\\]', '', _t3)
    if _t4 != _t3:
        logger.info(f"  [4] ПОСЛЕ спецсимволов: {repr(_t4[:200])}")

    # Минимальная пунктуация
    _t5 = _t4
    if _t5 and _t5[-1] not in '.!?':
        _t5 += '.'

    _t6 = _re.sub(r'\s+', ' ', _t5).strip()
    if _t6 != _t5:
        logger.info(f"  [5] ПОСЛЕ нормализации пробелов: {repr(_t6[:200])}")

    # Итоговый текст через normalize_tts_text
    text = normalize_tts_text(text_original)


    # Проверяем проблемы в итоговом тексте
    import re as _re_det
    issues = []
    if '  ' in text:
        issues.append("⚠️ ДВОЙНЫЕ ПРОБЕЛЫ")
    if _re_det.search(r'[а-яё][А-ЯЁ]', text):
        issues.append("⚠️ СКЛЕЕННЫЕ СЛОВА (строчная+заглавная)")
    # Точка/запятая без пробела — только если за ней идёт буква (не конец строки)
    if _re_det.search(r'[.!?,;:][А-ЯЁа-яё]', text):
        issues.append("⚠️ ЗАПЯТАЯ/ТОЧКА БЕЗ ПРОБЕЛА")
    # Длинные слова — порог 15 символов (персональный=12, чтотыначинаешь=15)
    long_w = _re_det.findall(r'[А-ЯЁа-яё]{15,}', text)
    if long_w:
        issues.append(f"⚠️ ДЛИННЫЕ СЛОВА (склейка?): {long_w[:2]}")
    if text_original != text:
        logger.info(f"  [FINAL] ИТОГ ({len(text)} симв): {repr(text[:300])}")
    else:
        logger.info(f"  [FINAL] Текст не изменился")

    if issues:
        logger.warning(f"  ПРОБЛЕМЫ: {' | '.join(issues)}")
    else:
        logger.info(f"  ✅ Текст чистый")

    settings = VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"])
    voice = VOICES.get(mode, VOICES["default"])
    logger.info(f"  ГОЛОС: {voice} | СКОРОСТЬ: {settings['speed']}")
    logger.info("=" * 70)

    if len(text) > 4500:
        text = text[:4500] + "..."

    # ===== FISH AUDIO (Jarvis) — PRIMARY =====
    try:
        from services.fish_audio_service import synthesize_fish_audio
        fish_result = await synthesize_fish_audio(text, mode)
        if fish_result:
            logger.info(f"✅ Fish Audio (Jarvis): {len(fish_result)} байт, mode={mode}")
            return fish_result
        logger.info("Fish Audio недоступен, переключаюсь на Yandex")
    except Exception as e:
        logger.warning(f"Fish Audio ошибка: {e}, fallback на Yandex")

    # ===== YANDEX (Filipp) — FALLBACK =====
    headers = {"Authorization": f"Api-Key {YANDEX_API_KEY}", "Content-Type": "application/x-www-form-urlencoded"}
    data = {"text": text, "lang": "ru-RU", "voice": voice, "speed": settings["speed"], "format": "mp3"}
    try:
        client = await get_http_client()
        response = await client.post(YANDEX_TTS_API_URL, headers=headers, data=data, timeout=30.0)
        if response.status_code == 200:
            audio_data = response.content
            logger.info(f"✅ Yandex TTS (Filipp): {len(audio_data)} байт, голос: {voice}")
            try:
                import asyncio as _aio
                from services.api_usage import log_tts_usage
                _aio.create_task(log_tts_usage(
                    provider="yandex", model=voice or "default",
                    chars=len(text or ""),
                    feature="tts.yandex_fallback",
                ))
            except Exception as _e:
                logger.warning(f"api_usage skip: {_e}")
            return audio_data
        else:
            logger.error(f"❌ Yandex TTS error {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"❌ Ошибка синтеза речи: {e}")
        logger.error(traceback.format_exc())
        return None


# ============================================
# ПОТОКОВОЕ РАСПОЗНАВАНИЕ РЕЧИ
# ============================================

async def speech_to_text_streaming(
    audio_stream: AsyncGenerator[bytes, None],
    sample_rate: int = 16000,
    on_transcript: Optional[Callable] = None,
    on_speech_start: Optional[Callable] = None,
    on_speech_end: Optional[Callable] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    vad = VADDetector(sample_rate, VAD_MODE)
    audio_buffer = bytearray()
    current_utterance = []
    is_collecting = False
    logger.info("🎤 Запуск потокового распознавания речи")
    async for chunk in audio_stream:
        if not chunk:
            continue
        vad_result = vad.process_chunk(chunk)
        if vad_result["speech_started"]:
            logger.info("🗣️ Речь началась")
            if on_speech_start:
                await on_speech_start()
            is_collecting = True
            audio_buffer.clear()
            current_utterance.clear()
        if is_collecting:
            audio_buffer.extend(chunk)
        if vad_result["speech_ended"] and len(audio_buffer) > 0:
            logger.info(f"🔇 Речь закончилась, собрано {len(audio_buffer)} байт")
            try:
                recognized = await speech_to_text(bytes(audio_buffer), "wav")
                if recognized and recognized.strip():
                    current_utterance.append(recognized)
                    full_text = " ".join(current_utterance)
                    if on_transcript:
                        await on_transcript(recognized, True)
                    if on_speech_end:
                        await on_speech_end(full_text)
                    yield {"type": "utterance", "text": full_text, "is_final": True, "segments": current_utterance.copy()}
                else:
                    yield {"type": "error", "error": "Речь не распознана"}
            except Exception as e:
                logger.error(f"Ошибка в speech_to_text: {e}")
                yield {"type": "error", "error": str(e)}
            audio_buffer.clear()
            is_collecting = False
            vad.reset()
        yield {"type": "vad_state", **vad_result}
    logger.info("🎤 Потоковое распознавание завершено")


# ============================================
# ПОТОКОВЫЙ СИНТЕЗ РЕЧИ
# ============================================

async def text_to_speech_streaming(
    text: str,
    mode: str = "psychologist",
    chunk_size: int = 32768
) -> AsyncGenerator[bytes, None]:
    """Синтез речи с чанкованной передачей.

    chunk_size 32КБ (вместо прежних 4КБ) — в 8 раз меньше итераций,
    значит меньше WebSocket-overhead и sleep-ов при той же latency
    первого байта.
    """
    logger.info(f"🎤 Потоковый синтез речи, режим: {mode}, текст: {text[:100]}...")
    audio_bytes = await text_to_speech(text, mode)
    if audio_bytes:
        total_sent = 0
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            yield chunk
            total_sent += len(chunk)
            # Минимальный sleep чтобы дать event-loop шанс отправить
            # буфер до следующего chunk-а; меньше — может перегрузить
            # WebSocket буфер на медленных соединениях.
            await asyncio.sleep(0.003)
        logger.info(f"✅ Потоковый синтез завершен, отправлено {total_sent} байт")
    else:
        logger.error("❌ Не удалось синтезировать речь")
        yield b''


# ============================================
# ОСНОВНОЙ КЛАСС VoiceService
# ============================================

class VoiceService:
    """Основной класс сервиса голосового взаимодействия."""

    def __init__(self):
        self.deepgram_key = DEEPGRAM_API_KEY
        self.yandex_key = YANDEX_API_KEY
        self._vad_cache: Dict[str, VADDetector] = {}

        logger.info("=" * 70)
        logger.info("🎤 VoiceService v3.6 успешно инициализирован")
        logger.info(f" DeepGram STT : {'✅' if self.deepgram_key else '❌'}")
        logger.info(f" Yandex TTS   : {'✅' if self.yandex_key else '❌'}")
        logger.info(f" VAD Mode     : {VAD_MODE}")
        logger.info(f" PCM→WAV конвертер: ✅")
        logger.info(f" Ремарки → паузы: ✅")
        logger.info(f" Вокальные маркеры: ✅")
        logger.info(f" Нормализация чисел: ✅")
        logger.info("=" * 70)

        if not self.deepgram_key:
            logger.warning("⚠️ DEEPGRAM_API_KEY не настроен!")
        if not self.yandex_key:
            logger.warning("⚠️ YANDEX_API_KEY не настроен!")

    # ============================================
    # ФИХ: PCM → WAV конвертация для WebSocket
    # ============================================

    def _pcm_to_wav(self, pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
        """
        Конвертирует сырой PCM (16-bit, mono) в WAV формат.
        Используется в speech_to_text_pcm для WebSocket эндпоинта.
        """
        num_channels = 1
        bits_per_sample = 16
        byte_rate = sample_rate * num_channels * bits_per_sample // 8
        block_align = num_channels * bits_per_sample // 8

        wav_header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            36 + len(pcm_bytes),   # размер файла - 8 байт
            b'WAVE',
            b'fmt ',
            16,                     # размер блока fmt
            1,                      # формат PCM
            num_channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
            b'data',
            len(pcm_bytes)
        )
        return wav_header + pcm_bytes

    async def speech_to_text_pcm(
        self, audio_bytes: bytes, sample_rate: int = 16000
    ) -> Optional[str]:
        """
        STT для сырого PCM-аудио.
        Используется в WebSocket эндпоинте /ws/voice/{user_id}.
        Конвертирует PCM → WAV и отправляет в DeepGram.
        """
        if not audio_bytes or len(audio_bytes) < 1000:
            logger.warning(
                f"⚠️ PCM слишком короткий: {len(audio_bytes) if audio_bytes else 0} байт"
            )
            return None
        wav_bytes = self._pcm_to_wav(audio_bytes, sample_rate)
        logger.info(f"🎤 PCM→WAV: {len(audio_bytes)} → {len(wav_bytes)} байт, rate={sample_rate}")
        return await speech_to_text(wav_bytes, "wav")

    # ============================================
    # СТАНДАРТНЫЕ МЕТОДЫ
    # ============================================

    async def speech_to_text(self, audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
        return await speech_to_text(audio_bytes, audio_format)

    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        audio_bytes = await text_to_speech(text, mode)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode('utf-8')
        return None

    async def text_to_speech_bytes(self, text: str, mode: str = "psychologist") -> Optional[bytes]:
        return await text_to_speech(text, mode)

    async def speech_to_text_streaming(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        sample_rate: int = 16000,
        on_transcript: Optional[Callable] = None,
        on_speech_start: Optional[Callable] = None,
        on_speech_end: Optional[Callable] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        async for result in speech_to_text_streaming(
            audio_stream, sample_rate, on_transcript, on_speech_start, on_speech_end
        ):
            yield result

    async def text_to_speech_streaming(
        self,
        text: str,
        mode: str = "psychologist",
        chunk_size: int = 4096
    ) -> AsyncGenerator[bytes, None]:
        async for chunk in text_to_speech_streaming(text, mode, chunk_size):
            yield chunk

    def create_vad(self, user_id: Optional[int] = None, sample_rate: int = 16000, mode: int = 3) -> VADDetector:
        if user_id is not None:
            cache_key = f"{user_id}:{sample_rate}:{mode}"
            if cache_key in self._vad_cache:
                vad = self._vad_cache[cache_key]
                vad.reset()
                return vad
            vad = VADDetector(sample_rate, mode)
            self._vad_cache[cache_key] = vad
            return vad
        return VADDetector(sample_rate, mode)

    def clear_vad_cache(self, user_id: Optional[int] = None):
        if user_id is not None:
            to_remove = [k for k in self._vad_cache if k.startswith(f"{user_id}:")]
            for key in to_remove:
                del self._vad_cache[key]
            logger.info(f"🗑️ Очищен кэш VAD для user_id={user_id}")
        else:
            self._vad_cache.clear()
            logger.info("🗑️ Очищен весь кэш VAD")

    def get_voice_info(self, mode: str = "psychologist") -> Dict[str, Any]:
        return {
            "mode": mode,
            "voice": VOICES.get(mode, VOICES["default"]),
            "settings": VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"]),
            "available_modes": list(VOICE_SETTINGS.keys())
        }

    async def close(self):
        await close_http_client()
        self.clear_vad_cache()
        logger.info("🔒 VoiceService полностью закрыт")


def create_voice_service() -> VoiceService:
    return VoiceService()


async def save_audio_debug(audio_bytes: bytes, prefix: str = "audio") -> Optional[str]:
    try:
        timestamp = int(time.time())
        filename = f"/tmp/{prefix}_{timestamp}.webm"
        with open(filename, 'wb') as f:
            f.write(audio_bytes)
        logger.info(f"💾 Аудио сохранено для отладки: {filename}")
        return filename
    except Exception as e:
        logger.warning(f"⚠️ Не удалось сохранить аудио: {e}")
        return None
