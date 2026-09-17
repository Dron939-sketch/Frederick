"""
test_pdf.py — генератор PDF-портрета по результатам теста.

Лёгкий генератор: fpdf2 (pure-python, без cairo/system-deps), DejaVu-шрифт
для кириллицы. Один файл — один портрет: архетип, код, тип восприятия,
4 вектора с описаниями уровней, AI-комментарий.

Назначение — отправлять файл в MAX-бот после прохождения теста, чтобы
у пользователя оставался артефакт «на память», без необходимости открывать
веб-приложение.
"""
from __future__ import annotations

import io
import os
from datetime import datetime
import re
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# DejaVu Sans (наш шрифт для кириллицы) не содержит цветных эмодзи —
# fpdf2 на каждом 🏔/🔑/💪/🎯 ругается «missing glyph» и оставляет
# квадратик. Чистим строки от эмодзи перед рендером, оставляя только
# текст и стандартную пунктуацию. Для уже существующих heading-эмодзи
# (🔑/💪/🎯/🌱 в AI-тексте) это даёт «КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА» вместо
# «🔑 КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА» — без визуального мусора.
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F9FF"   # symbols + pictographs, emoticons, supplemental
    "\U0001FA00-\U0001FAFF"   # symbols & pictographs ext-A
    "\U00002600-\U000027BF"   # misc symbols + dingbats
    "\U0001F000-\U0001F02F"   # mahjong/dominoes
    "\U0001F0A0-\U0001F0FF"   # playing cards
    "\U0001F100-\U0001F1FF"   # enclosed alphanumerics + flags
    "\U0001F200-\U0001F2FF"   # enclosed ideographs
    "\U0000FE00-\U0000FE0F"   # variation selectors
    "\U0001F3FB-\U0001F3FF"   # skin tone modifiers
    "\U0000200D"              # ZWJ — emoji-склейщик
    "]+",
    flags=re.UNICODE,
)


def _clean_for_pdf(text: str) -> str:
    """Удаляет эмодзи и схлопывает образовавшиеся двойные пробелы."""
    if not text:
        return ""
    s = _EMOJI_RE.sub("", text)
    # Убираем двойные пробелы и пустые строки в начале строк после удаления.
    s = re.sub(r"[ \t]{2,}", " ", s)
    s = re.sub(r"\n[ \t]+", "\n", s)
    return s.strip()

# Попытка найти DejaVu — стандартный кириллический Unicode-шрифт.
# Render/Debian-образ обычно содержит его. Для локальной разработки можно
# положить TTF в backend/fonts/DejaVuSans.ttf — этот путь проверяется первым.
# Montserrat первым, DejaVu запасным. Фирменный шрифт материалов —
# Cera Pro, но он платный и лицензии нет (владелец 17.09.2026: «шрифтов
# не будет, найди сам»). Montserrat — геометрический гротеск той же
# породы, с полной кириллицей, настоящими Regular и Bold и лицензией
# OFL: в коммерции можно, файл лицензии лежит рядом со шрифтами.
#
# Manrope и Jost проверены и отброшены: у обоих в свободном доступе
# только переменные файлы, из которых fpdf2 берёт светлое начертание —
# заголовок «РАЗБОР ТЕСТА» выходил бледным и разваливался.
#
# DejaVu оставлен запасным: если шрифты не доехали в образ, отчёт должен
# собраться некрасивым, но собраться.
_ASSET_FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "assets", "fonts")
_FONT_CANDIDATES = [
    os.path.join(_ASSET_FONTS, "Montserrat-Regular.ttf"),
    os.path.join(os.path.dirname(__file__), "fonts", "DejaVuSans.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
]
_FONT_BOLD_CANDIDATES = [
    os.path.join(_ASSET_FONTS, "Montserrat-Bold.ttf"),
    os.path.join(os.path.dirname(__file__), "fonts", "DejaVuSans-Bold.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
]


def _find_font(candidates):
    for p in candidates:
        if os.path.exists(p):
            return p
    return None


# Описания уровней по шкале /9 — синхронны с текстом на финале теста (test.js).
SB_LEVELS = {
    1: "Под давлением замираете",
    2: "Избегаете конфликтов",
    3: "Внешне соглашаетесь",
    4: "Внешне спокойны",
    5: "Умеете защищать",
    6: "Защищаете и используете силу",
    7: "Видите давление как жизненный урок",
    8: "Распознаёте универсальные паттерны",
    9: "Опираетесь на законы развития",
}
TF_LEVELS = {
    1: "Деньги как повезёт",
    2: "Ищете возможности",
    3: "Зарабатываете трудом",
    4: "Хорошо зарабатываете",
    5: "Создаёте системы дохода",
    6: "Управляете капиталом",
    7: "Видите деньги как часть экономики",
    8: "Деньги — отражение ценности",
    9: "Деньги — универсальный эквивалент",
}
UB_LEVELS = {
    1: "Не думаете о сложном",
    2: "Верите в знаки",
    3: "Доверяете экспертам",
    4: "Ищете заговоры",
    5: "Анализируете факты",
    6: "Строите теории",
    7: "Ищете аналогии в истории",
    8: "Строите модели мира",
    9: "Видите закономерности",
}
CV_LEVELS = {
    1: "Сильно привязываетесь",
    2: "Подстраиваетесь",
    3: "Хотите нравиться",
    4: "Умеете влиять",
    5: "Строите равные отношения",
    6: "Создаёте сообщества",
    7: "Понимаете историю группы",
    8: "Видите архетипы отношений",
    9: "Понимаете универсальные законы",
}



def _render_ai_text(r, text: str):
    """Раскладывает разбор: заголовки, подзаголовки цен, пункты списка."""
    pdf = r.pdf
    blocks = [ln.rstrip() for ln in str(text).split("\n")]
    buf = []

    def flush():
        if buf:
            r.body("\n".join(buf).strip(), gap=1.5)
            buf.clear()

    for line in blocks:
        t = line.strip()
        if not t:
            flush()
            continue
        letters = [c for c in t if c.isalpha()]
        # Заголовок внутри разбора: коротко и целиком заглавными. Идёт
        # подзаголовком, а не разделом: номер раздела здесь уже занят
        # («Что это значит»), и вторая нумерация внутри него сбивала бы.
        if letters and len(t) <= 42 and all(c.isupper() for c in letters):
            flush()
            r.sub(t)
            continue
        # Подзаголовок цены.
        if re.match(r"^Цена\s*\d+[.):]", t):
            flush()
            pdf.ln(1)
            pdf.set_font("DejaVu", "B", 10.5)
            _rgb(pdf, "set_text_color", BRAND_BLACK)
            pdf.set_x(MARGIN)
            pdf.multi_cell(CONTENT_W, 6, t, align="L")
            pdf.set_font("DejaVu", "", 10.5)
            continue
        # Пункт списка. Маркер — янтарная точка на левом поле: колонка
        # текста остаётся прямой, а перечень видно с одного взгляда.
        if t.startswith(("•", "-", "—")):
            flush()
            body = t.lstrip("•-— ").strip()
            y0 = pdf.get_y()
            if y0 > 255:
                pdf.add_page()
                y0 = pdf.get_y()
            _rgb(pdf, "set_fill_color", ACCENT)
            pdf.rect(MARGIN - 6, y0 + 2.4, 1.8, 1.8, style="F")
            pdf.set_font("DejaVu", "", 10.5)
            _rgb(pdf, "set_text_color", INK)
            pdf.set_xy(MARGIN, y0)
            pdf.multi_cell(CONTENT_W, 6, body, align="L")
            pdf.ln(1.4)
            continue
        buf.append(t)
    flush()


import math

# Соответствие вектора и поля, в котором приложение держит его итог.
_VECTOR_FIELDS = {"СБ": "sbLevel", "ТФ": "tfLevel",
                  "УБ": "ubLevel", "ЧВ": "chvLevel"}


def _avg_level(arr) -> int:
    """Уровень вектора по массиву этапов — СРЕДНЕЕ, а не последний этап.

    Здесь была ошибка, которую видно только на живых данных. Функция
    называлась _last_level и брала arr[-1] «стадию 3», а приложение
    считает иначе (fredi/test.js, calculateFinalProfile):

        const avg = arr => arr.reduce((a,b)=>a+b,0)/arr.length
        sbR = Math.round(avg(behavioralLevels['СБ']))

    У человека, прошедшего тест 17.09.2026, поведенческие массивы были
    СБ [6, 5], ТФ [5, 1], УБ [1, 6], ЧВ [6, 3]. На экране он увидел код
    СБ-6_ТФ-3_УБ-4_ЧВ-5, а в PDF ему уходило СБ-5_ТФ-1_УБ-6_ЧВ-3 — мимо
    по всем четырём векторам. Файл противоречил экрану, с которого его
    скачали, и «Умеете защищать» превращалось в «Деньги как повезёт».

    Округление именно floor(x + 0.5): JS Math.round округляет половину
    ВВЕРХ, а встроенный round() в Python — до чётного, и на ЧВ [6, 3]
    (среднее 4.5) он дал бы 4 вместо приложенческих 5.
    """
    if isinstance(arr, list) and arr:
        try:
            nums = [float(x) for x in arr]
        except (TypeError, ValueError):
            return 0
        return int(math.floor(sum(nums) / len(nums) + 0.5))
    if isinstance(arr, (int, float)):
        return int(arr)
    return 0


def _vector_level(profile_data: Dict[str, Any], behavioral: Dict[str, Any],
                  code: str) -> int:
    """Итог по вектору: сначала то, что посчитало приложение.

    profile_data — снимок, сделанный самим тестом в момент прохождения.
    Пока он есть, пересчитывать нечего: любой наш пересчёт рискует
    разойтись с числом, которое человек уже видел на экране. Массив
    этапов — запасной путь для старых записей, где снимка нет.
    """
    field = _VECTOR_FIELDS.get(code)
    if field:
        val = profile_data.get(field)
        if isinstance(val, (int, float)) and val:
            return int(val)
    return _avg_level(behavioral.get(code))


# ── Оформление ────────────────────────────────────────────────────────
# ЗАМЫСЕЛ. Документ читают на телефоне, в почте, спустя дни — и он
# единственное, что остаётся у человека от получаса работы. Значит это не
# «выгрузка из базы», а печатное издание: обложка, колонтитул, нумерация
# разделов, узкая колонка, много полей.
#
# 17.09.2026 владелец: «продумай всю концепцию ещё раз, нужно сделать
# презентабельно и дорого». Дорого в печати делают ровно четыре вещи, и
# ни одна из них не стоит денег:
#
#   1. ВОЗДУХ. Поля 22 мм, интерлиньяж 6.2 при кегле 10.5, пустое место
#      под иллюстрацией. Плотно набранная страница выглядит дёшево даже
#      идеальным шрифтом.
#   2. ВОЛОСЯНЫЕ ЛИНИИ ВМЕСТО РАМОК И ПЛАШЕК. Заливка кричит, линия в
#      0.2 мм — нет. Поэтому ушли: янтарная «пилюля» архетипа, кремовая
#      карточка «Взгляда психолога», янтарная кнопка-таблетка.
#   3. КОНТРАСТ КЕГЛЕЙ, А НЕ КОНТРАСТ ЦВЕТОВ. Разрядка 7 pt капителью
#      против 19 pt заголовка — это и есть «дорогая» типографика.
#      Дополнительных цветов не добавлено ни одного.
#   4. РАСПАШНЫЕ ПЛАШКИ. Чёрное поле обложки и чёрная концовка идут в
#      обрез, от края до края листа. Скруглённый прямоугольник с полями
#      читается как карточка веб-интерфейса; полоса в обрез — как книга.
#
# Палитра прежняя и по-прежнему из трёх цветов: чёрный #1C1C1C, янтарный
# #FFB800, белый — из гайда владельца «Зумы внимания».
BRAND_BLACK = (28, 28, 28)
BRAND_AMBER = (255, 184, 0)

# Текст чёрный нейтральный, без синевы: синева была наследством от
# интерфейса приложения и на бумаге читалась как выцветшая печать.
INK = (26, 26, 26)        # основной текст
MUTED = (122, 122, 122)   # подписи и второстепенное
HAIR = (219, 219, 219)    # волосяные линейки
DARK_MUTED = (146, 146, 146)   # второстепенное на чёрном
DARK_MICRO = (124, 124, 124)   # капитель на чёрном
# Янтарь — только заливка: полоски шкал, короткие акцентные штрихи,
# номера разделов. Для длинного ТЕКСТА он не годится — на белом не
# читается, поэтому заголовки всегда чёрные.
ACCENT = (255, 184, 0)
FREDI_URL = "https://meysternlp.ru/fredi/"

MARGIN = 22               # поля шире обычных: воздух и есть «дорого»
CONTENT_W = 210 - MARGIN * 2

# Обложка: распашная чёрная полоса и рисунок под ней.
COVER_BAND_H = 104
# Концовка: такая же полоса внизу последней страницы — обложка и финал
# рифмуются, документ получает начало и конец.
CODA_TOP = 249

ART_FILE = "titul-marionetka.png"
# Рисунок владельца (штриховая тушь): человек на марионеточных нитях
# поднимается по лестнице, ступени впереди — пунктиром, за спиной —
# контур того, кем он мог бы быть. Ровно то, о чём отчёт: привычный ход
# виден со стороны, и дальше есть куда шагнуть. Пропорции 687×1100.
ART_RATIO = 1100 / 687


def _rgb(pdf, setter, color):
    getattr(pdf, setter)(*color)


def _micro(pdf, text: str, color=MUTED, size: float = 7,
           spacing: float = 1.5, w: float = 0, align: str = "L",
           link: str = "", caps: bool = True):
    """Капитель вразрядку — вся мелкая служебная типографика отчёта.

    Разрядка здесь не украшение: заглавные без неё слипаются в пятно, а
    с ней строка читается как штемпель на бланке. Свойство сбрасываем
    сразу — забытый char_spacing разъезжается по всему документу.

    caps=False нужен там, где в строке есть имя с собственным регистром:
    «MeysterAi» в верхнем регистре превращается в «MEYSTERAI» и перестаёт
    быть названием.
    """
    pdf.set_font("DejaVu", "", size)
    _rgb(pdf, "set_text_color", color)
    pdf.set_char_spacing(spacing)
    pdf.cell(w or CONTENT_W, 4.4, text.upper() if caps else text,
             align=align, ln=1, link=link or "")
    pdf.set_char_spacing(0)


class _Report:
    """Тонкая обёртка над FPDF: повторяющиеся приёмы вёрстки издания."""

    def __init__(self, pdf, font_bold_real: bool):
        self.pdf = pdf
        self.bold_real = font_bold_real
        self.section = 0

    # ── Заголовки ────────────────────────────────────────────────────
    def h(self, text: str, top: float = 12, keep: float = 34):
        """Заголовок раздела: номер янтарём, название, линейка под ним.

        Нумерация не для порядка — читать разбор можно с любого места.
        Она делает документ изданием: «01», «02» на полях сразу говорят,
        что страницу собирали, а не выгрузили.

        keep — сколько миллиметров раздела обязано уместиться под
        заголовком. По умолчанию три строки: заголовок в самом подвале
        листа, а текст на следующем — самая заметная ошибка вёрстки.
        Разделу, который нельзя разрывать вовсе, передают его высоту.
        """
        pdf = self.pdf
        self.section += 1
        if pdf.get_y() + top + keep > 262:
            pdf.add_page()
        else:
            pdf.ln(top)
        pdf.set_x(MARGIN)
        _micro(pdf, f"{self.section:02d}", color=BRAND_AMBER, size=8,
               spacing=1.2)
        pdf.set_x(MARGIN)
        pdf.set_font("DejaVu", "B", 15)
        _rgb(pdf, "set_text_color", BRAND_BLACK)
        pdf.cell(CONTENT_W, 8, text, ln=1)
        _rgb(pdf, "set_draw_color", HAIR)
        pdf.set_line_width(0.2)
        y = pdf.get_y() + 1.5
        pdf.line(MARGIN, y, 210 - MARGIN, y)
        pdf.ln(5)

    def sub(self, text: str):
        """Подзаголовок внутри раздела — капитель, без линейки."""
        pdf = self.pdf
        if pdf.get_y() > 252:
            pdf.add_page()
        pdf.ln(4)
        pdf.set_x(MARGIN)
        _micro(pdf, text, color=BRAND_BLACK, size=8.5, spacing=1.0)
        pdf.ln(1.2)

    def body(self, text: str, size: float = 10.5, lead: float = 6.2,
             color=None, gap: float = 2.6):
        pdf = self.pdf
        pdf.set_font("DejaVu", "", size)
        _rgb(pdf, "set_text_color", color or INK)
        for para in [p.strip() for p in str(text).split("\n\n") if p.strip()]:
            # multi_cell в fpdf2 оставляет курсор у ПРАВОГО края блока.
            # Без явного возврата к полю следующий абзац начинается там же
            # и уезжает за страницу — на второй странице так и вышло:
            # формат и адрес курса оказались обрезаны краем листа.
            pdf.set_x(MARGIN)
            pdf.multi_cell(CONTENT_W, lead, para, align="L")
            pdf.ln(gap)

    # ── Шкалы ────────────────────────────────────────────────────────
    def bar(self, label: str, level: int, caption: str):
        """Вектор тонкой дорожкой во всю колонку.

        Было девять янтарных брусков по 8 мм — они перетягивали на себя
        страницу и читались как индикатор загрузки. Стало: строка
        «код — что это значит — N/9» и под ней дорожка в 1.6 мм с
        белыми насечками. Девять делений по-прежнему видно, но вес у
        блока текстовый, а не плакатный.
        """
        pdf = self.pdf
        if pdf.get_y() > 248:
            pdf.add_page()
        lvl = int(level or 0)
        y0 = pdf.get_y()

        pdf.set_xy(MARGIN, y0)
        pdf.set_font("DejaVu", "B", 10.5)
        _rgb(pdf, "set_text_color", BRAND_BLACK)
        pdf.cell(13, 5.6, label, ln=0)
        pdf.set_font("DejaVu", "", 10.5)
        _rgb(pdf, "set_text_color", INK)
        pdf.cell(CONTENT_W - 13 - 18, 5.6, caption, ln=0)
        pdf.set_font("DejaVu", "", 9)
        _rgb(pdf, "set_text_color", MUTED)
        pdf.cell(18, 5.6, f"{lvl or '—'} / 9", align="R", ln=1)

        y = y0 + 7.6
        _rgb(pdf, "set_fill_color", HAIR)
        pdf.rect(MARGIN, y, CONTENT_W, 1.6, style="F")
        if lvl:
            _rgb(pdf, "set_fill_color", ACCENT)
            pdf.rect(MARGIN, y, CONTENT_W * lvl / 9.0, 1.6, style="F")
        pdf.set_fill_color(255, 255, 255)
        for i in range(1, 9):
            pdf.rect(MARGIN + CONTENT_W * i / 9.0 - 0.25, y, 0.5, 1.6,
                     style="F")
        pdf.set_xy(MARGIN, y + 1.6 + 5.4)

    # ── Выноска ──────────────────────────────────────────────────────
    def quote(self, title: str, text: str):
        """Выделенный раздел — янтарная вертикаль на поле, без заливки.

        Кремовая плашка на всю ширину выглядела как цветная врезка в
        рекламной листовке. Вертикальный штрих в 1.6 мм на левом поле
        делает то же самое — говорит «это голос автора» — и при этом
        не красит страницу.
        """
        pdf = self.pdf
        paras = [p.strip() for p in str(text).split("\n\n") if p.strip()]
        if not paras:
            return
        pdf.ln(9)
        inner = CONTENT_W - 13
        pdf.set_font("DejaVu", "", 11)
        lines = sum(len(pdf.multi_cell(inner, 6.4, p, split_only=True))
                    for p in paras)
        hgt = 7.5 + lines * 6.4 + (len(paras) - 1) * 2.4
        # Вертикаль рисуется одной высотой — значит блок обязан уместиться
        # на странице целиком, иначе штрих оборвётся, а текст поедет дальше.
        if pdf.get_y() + hgt > 262:
            pdf.add_page()
        x, y = MARGIN, pdf.get_y()
        _rgb(pdf, "set_fill_color", ACCENT)
        pdf.rect(x, y, 1.6, hgt, style="F")

        pdf.set_xy(x + 13, y)
        pdf.set_font("DejaVu", "", 7.5)
        _rgb(pdf, "set_text_color", MUTED)
        pdf.set_char_spacing(1.5)
        pdf.cell(inner, 4.4, title.upper(), ln=1)
        pdf.set_char_spacing(0)
        pdf.ln(2)
        pdf.set_font("DejaVu", "", 11)
        _rgb(pdf, "set_text_color", INK)
        for p in paras:
            pdf.set_x(x + 13)
            pdf.multi_cell(inner, 6.4, p, align="L")
            pdf.ln(2.4)
        pdf.set_y(y + hgt + 3)


def generate_test_pdf_bytes(profile: Dict[str, Any],
                              user_name: Optional[str] = None,
                              psychologist_thought: Optional[str] = None,
                              recommendations: Optional[list] = None) -> bytes:
    """
    Собирает «полный отчёт» PDF по результатам теста:
      - архетип, код, тип восприятия, уровень мышления
      - 4 поведенческих вектора (СБ/ТФ/УБ/ЧВ) с описаниями уровней /9
      - глубинный паттерн привязанности
      - AI-комментарий к профилю
      - мысли психолога (если сгенерированы)

    Бросает исключение, если шрифт DejaVu не найден.
    """
    try:
        from fpdf import FPDF  # type: ignore
    except ImportError as e:
        raise RuntimeError("fpdf2 не установлен — добавьте в requirements.txt") from e

    font_regular = _find_font(_FONT_CANDIDATES)
    font_bold = _find_font(_FONT_BOLD_CANDIDATES)
    if not font_regular:
        raise RuntimeError("DejaVu Unicode-шрифт не найден в системе")

    profile_data = profile.get("profile_data") or {}
    behavioral = profile.get("behavioral_levels") or profile_data.get("behavioral_levels") or {}
    ai_text = _clean_for_pdf(profile.get("ai_generated_profile")
               or profile_data.get("ai_generated_profile") or "")
    archetype = _clean_for_pdf(str(profile_data.get("archetype")
                 or profile.get("archetype") or "—"))
    display_name = _clean_for_pdf(str(profile_data.get("display_name")
                                       or profile.get("display_name") or ""))
    perception_type = _clean_for_pdf(str(profile_data.get("perception_type")
                       or profile.get("perception_type") or ""))
    thinking_level = (profile_data.get("thinking_level")
                      or profile.get("thinking_level") or "—")
    deep = (profile_data.get("deep_patterns")
            or profile.get("deep_patterns") or {}) or {}

    sb = _vector_level(profile_data, behavioral, "СБ")
    tf = _vector_level(profile_data, behavioral, "ТФ")
    ub = _vector_level(profile_data, behavioral, "УБ")
    cv = _vector_level(profile_data, behavioral, "ЧВ")

    class _Book(FPDF):
        """Колонтитул издания: слева — чей разбор, справа — номер листа.

        Раньше страницы ничем не отличались одна от другой, и с третьей
        читатель терял, что вообще держит в руках. Обложка колонтитула
        не несёт — на ней он был бы шумом.
        """
        head_left = ""
        show_head = False

        def header(self):
            if not self.show_head or self.page_no() == 1:
                return
            self.set_font("DejaVu", "", 7)
            _rgb(self, "set_text_color", MUTED)
            self.set_char_spacing(1.4)
            self.set_xy(MARGIN, 13)
            self.cell(CONTENT_W - 12, 4.4, self.head_left.upper(), ln=0)
            self.set_char_spacing(0)
            self.cell(12, 4.4, f"{self.page_no() - 1}", align="R", ln=1)
            _rgb(self, "set_draw_color", HAIR)
            self.set_line_width(0.2)
            self.line(MARGIN, 19.5, 210 - MARGIN, 19.5)
            self.set_xy(MARGIN, 30)

    pdf = _Book(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=26)
    pdf.set_margins(MARGIN, 30, MARGIN)
    pdf.add_page()
    pdf.add_font("DejaVu", "", font_regular, uni=True)
    if font_bold:
        pdf.add_font("DejaVu", "B", font_bold, uni=True)
    else:
        # Если жирного начертания нет — используем regular как базу,
        # fpdf2 эмулирует жирность затемнением (грубо, но работает).
        pdf.add_font("DejaVu", "B", font_regular, uni=True)

    r = _Report(pdf, bool(font_bold))

    # ── Титульный лист ───────────────────────────────────────────────
    # Отдельная страница, а не плашка над текстом. Решение владельца
    # 17.09.2026: «на титульнике будем писать архетип и картинку».
    #
    # Полоса идёт В ОБРЕЗ — от левого края листа до правого, без полей и
    # без скруглений. Прежняя версия была прямоугольником со скруглением
    # 12 мм внутри полей: ровно так рисуют карточку в веб-интерфейсе, и
    # обложка выглядела скриншотом. Полоса до края читается как книга.
    #
    # Архетип поднят на обложку как ЗАГОЛОВОК ИЗДАНИЯ — белым по чёрному,
    # капителью вразрядку, а не янтарной «пилюлей» под плашкой. Пилюля
    # была третьим элементом на листе и спорила с полосой за внимание.
    addressee = (user_name or "").strip()
    if addressee.lower() in ("друг", "гость"):
        addressee = ""
    stamp = datetime.now().strftime("%d.%m.%Y")

    prev_auto = pdf.auto_page_break
    # Обложка верстается абсолютными координатами, автоперенос тут только
    # мешает: подпись на 274-м мм срабатывала на его границе в 275-м, и в
    # отчёте появлялся лист, где не было ничего, кроме «meysternlp.ru».
    pdf.set_auto_page_break(False)

    _rgb(pdf, "set_fill_color", BRAND_BLACK)
    pdf.rect(0, 0, 210, COVER_BAND_H, style="F")

    # Жанр документа — капителью вверху полосы. Просьба владельца
    # 17.09.2026: «сверху напишем „разбор психологического профиля от
    # виртуального психолога Фреди с использованием MeysterAi“, не очень
    # крупным шрифтом». Предложение разнесено на два конца полосы: жанр
    # сверху, авторство внизу. Одной строкой в 8 pt оно висело над
    # плашкой ничьим текстом; так это шапка и выходные данные.
    pdf.set_xy(MARGIN, 24)
    _micro(pdf, "Разбор психологического профиля", color=DARK_MICRO,
           size=7.5, spacing=2.0)

    _rgb(pdf, "set_fill_color", BRAND_AMBER)
    pdf.rect(MARGIN, 33, 16, 1.2, style="F")

    # Архетип. Высота считается по числу строк: «Спокойный воин» и
    # «Наблюдатель за наблюдателем внутри себя» — разной длины, и блок с
    # фиксированной высотой второй обрезал бы.
    arch = (str(archetype or "").strip() or "—").upper()
    pdf.set_font("DejaVu", "B", 19)
    pdf.set_char_spacing(1.1)
    arch_lines = max(1, len(pdf.multi_cell(CONTENT_W, 10, arch,
                                           split_only=True)))
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(MARGIN, 44)
    pdf.multi_cell(CONTENT_W, 10, arch, align="L")
    pdf.set_char_spacing(0)

    pdf.set_font("DejaVu", "", 9.5)
    _rgb(pdf, "set_text_color", DARK_MUTED)
    pdf.set_xy(MARGIN, 44 + arch_lines * 10 + 4)
    sub = [p for p in (perception_type, f"мышление {thinking_level}/9") if p]
    pdf.cell(CONTENT_W, 6, "  ·  ".join(sub), ln=1)

    pdf.set_xy(MARGIN, COVER_BAND_H - 16)
    _micro(pdf, "Виртуальный психолог Фреди  ·  с использованием MeysterAi",
           color=DARK_MICRO, size=7.5, spacing=1.1, caps=False)

    # Рисунок. Если файла нет — просто пустое место: отчёт важнее
    # картинки, и падать из-за отсутствующего png он не должен.
    art = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "assets", "pdf", ART_FILE)
    if os.path.exists(art):
        try:
            art_w = 84
            pdf.image(art, x=(210 - art_w) / 2,
                      y=COVER_BAND_H + 12, w=art_w, h=art_w * ART_RATIO)
        except Exception as e:
            logger.warning(f"титульный рисунок не вставился: {e}")

    # Выходные данные обложки: кому и когда. Имя ставим как есть, без
    # «Для …»: склонять чужое имя вслепую — верный способ получить
    # «Для Андрей» или «Для Любовю».
    _rgb(pdf, "set_draw_color", BRAND_BLACK)
    pdf.set_line_width(0.4)
    pdf.line(MARGIN, 266, 210 - MARGIN, 266)
    pdf.set_xy(MARGIN, 269)
    pdf.set_font("DejaVu", "B", 10.5)
    _rgb(pdf, "set_text_color", BRAND_BLACK)
    pdf.cell(CONTENT_W - 30, 6, addressee or "Ваш психологический портрет",
             ln=0)
    pdf.set_font("DejaVu", "", 9)
    _rgb(pdf, "set_text_color", MUTED)
    pdf.cell(30, 6, stamp, align="R", ln=1)
    pdf.set_xy(MARGIN, 277)
    _micro(pdf, "meysternlp.ru", color=MUTED, size=7, spacing=1.6)

    pdf.set_auto_page_break(prev_auto, margin=26)

    # Со второй страницы идёт колонтитул: он и превращает пачку листов
    # в издание. На обложке его нет — там он был бы шумом.
    pdf.head_left = addressee or (archetype if archetype != "—"
                                  else "Психологический портрет")
    pdf.show_head = True
    pdf.add_page()
    r.body("Это описание того, как вы обычно поступаете, — не диагноз и не "
           "ярлык. Привычный ход можно менять; об этом и разговор с Фреди.",
           size=11, lead=6.4, color=MUTED)

    # ── Векторы ──────────────────────────────────────────────────────
    r.h("Четыре вектора поведения")
    r.body("Шкала — не оценка «хорошо / плохо», а высота уровня: чем выше, "
           "тем больше у вас выбора в этой области.", size=9.5, lead=5,
           color=MUTED, gap=3)
    r.bar("СБ", sb, SB_LEVELS.get(int(sb), "Нет данных") if sb else "Нет данных")
    r.bar("ТФ", tf, TF_LEVELS.get(int(tf), "Нет данных") if tf else "Нет данных")
    r.bar("УБ", ub, UB_LEVELS.get(int(ub), "Нет данных") if ub else "Нет данных")
    r.bar("ЧВ", cv, CV_LEVELS.get(int(cv), "Нет данных") if cv else "Нет данных")

    # ── Глубинный паттерн ────────────────────────────────────────────
    attach = _clean_for_pdf(deep.get("attachment") or "")
    if attach:
        r.h("Глубинный паттерн")
        r.body(attach)

    # ── Что это значит ───────────────────────────────────────────────
    # Разбор приходит размеченным: заголовки заглавными, пункты через «•»,
    # цены подзаголовками «Цена 1. …». Раньше всё это падало в PDF одним
    # сплошным абзацем — владелец 16.09.2026 о таком письме: «как будто не
    # дожали». Теперь заголовки идут заголовками, пункты — с отступом.
    if ai_text:
        r.h("Что это значит")
        _render_ai_text(r, ai_text.replace("**", "").replace("__", ""))

    # ── Мысли психолога ──────────────────────────────────────────────
    pt_clean = _clean_for_pdf(psychologist_thought or "")
    pt_clean = pt_clean.replace("**", "").replace("__", "")
    if pt_clean:
        r.quote("Взгляд психолога", pt_clean)

    # ── С чего начать ────────────────────────────────────────────────
    # Правило владельца: результат теста обязан вести дальше. В файле,
    # который человек откроет через неделю, это единственная дверь.
    recs = [x for x in (recommendations or []) if isinstance(x, dict) and x.get("title")]
    if recs:
        # Раздел держим на одном листе: позиция стоит около 36 мм, три —
        # около 110. Без этого первая оставалась внизу страницы, две
        # уезжали на следующую, и под ними до концовки зияло полстраницы
        # пустоты — читалось как обрыв, а не как воздух.
        r.h("С чего начать", keep=min(3, len(recs)) * 36)
        # Нумерованный перечень с волосяными разделителями вместо плашек:
        # три позиции читаются как оглавление раздела, а не как витрина.
        for i, it in enumerate(recs[:3], 1):
            if pdf.get_y() > 236:
                pdf.add_page()
            y0 = pdf.get_y()
            title = _clean_for_pdf(str(it.get("title") or ""))
            url = str(it.get("url") or "")
            if url and not url.startswith("http"):
                url = "https://meysternlp.ru" + url

            # Номер вынесен на левое поле — колонка текста не рвётся.
            pdf.set_xy(MARGIN - 8, y0 + 0.4)
            pdf.set_font("DejaVu", "", 9)
            _rgb(pdf, "set_text_color", BRAND_AMBER)
            pdf.cell(7, 5.8, f"{i}", align="R", ln=0)

            pdf.set_xy(MARGIN, y0)
            pdf.set_font("DejaVu", "B", 11)
            _rgb(pdf, "set_text_color", BRAND_BLACK)
            pdf.multi_cell(CONTENT_W, 6, title, link=url or "", align="L")
            fmt = _clean_for_pdf(str(it.get("format") or ""))
            if fmt:
                pdf.set_x(MARGIN)
                _micro(pdf, fmt, color=MUTED, size=7, spacing=1.2)
            what = _clean_for_pdf(str(it.get("what") or ""))
            if what:
                pdf.ln(1)
                _rgb(pdf, "set_text_color", INK)
                pdf.set_font("DejaVu", "", 10)
                pdf.set_x(MARGIN)
                pdf.multi_cell(CONTENT_W, 5.8, what, align="L")
            if url:
                pdf.set_font("DejaVu", "", 8.5)
                _rgb(pdf, "set_text_color", MUTED)
                pdf.set_x(MARGIN)
                pdf.multi_cell(CONTENT_W, 5, url, link=url, align="L")
            pdf.ln(4)
            if i < len(recs[:3]):
                _rgb(pdf, "set_draw_color", HAIR)
                pdf.set_line_width(0.2)
                pdf.line(MARGIN, pdf.get_y(), 210 - MARGIN, pdf.get_y())
                pdf.ln(5)

    # ── Концовка ─────────────────────────────────────────────────────
    # Файл открывают через дни, и адреса к этому моменту человек не
    # помнит. Раньше здесь была янтарная кнопка-таблетка в 74 мм — та же
    # кнопка, что в приложении, и она превращала последний лист в баннер.
    # Стало: распашная чёрная полоса в подвале последней страницы,
    # рифма к обложке. Ссылка нажимается ровно так же.
    if pdf.get_y() > CODA_TOP - 22:
        pdf.add_page()
    prev_auto = pdf.auto_page_break
    pdf.set_auto_page_break(False)
    _rgb(pdf, "set_fill_color", BRAND_BLACK)
    pdf.rect(0, CODA_TOP, 210, 297 - CODA_TOP, style="F")
    _rgb(pdf, "set_fill_color", BRAND_AMBER)
    pdf.rect(MARGIN, CODA_TOP + 12, 16, 1.2, style="F")
    pdf.set_xy(MARGIN, CODA_TOP + 19)
    pdf.set_font("DejaVu", "B", 15)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(CONTENT_W, 9, "Поговорить с Фреди", ln=1, link=FREDI_URL)
    pdf.set_xy(MARGIN, CODA_TOP + 29)
    pdf.set_font("DejaVu", "", 9.5)
    _rgb(pdf, "set_text_color", DARK_MUTED)
    pdf.cell(CONTENT_W, 5.6,
             "meysternlp.ru/fredi  —  открывается в браузере, "
             "регистрация не нужна", ln=1, link=FREDI_URL)
    pdf.set_xy(MARGIN, 288)
    _micro(pdf, "Фреди — виртуальный психолог. "
                "Сделан психологом Андреем Мейстером.",
           color=DARK_MICRO, size=6.5, spacing=1.2)
    pdf.set_auto_page_break(prev_auto, margin=26)

    out = pdf.output(dest="S")
    if isinstance(out, str):
        return out.encode("latin-1")
    return bytes(out)
