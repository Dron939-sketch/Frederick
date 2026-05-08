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
_FONT_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "fonts", "DejaVuSans.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
]
_FONT_BOLD_CANDIDATES = [
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


def _last_level(arr) -> int:
    """behavioral_levels хранит массив уровней по стадиям. Берём последний (стадия 3)."""
    if isinstance(arr, list) and arr:
        try:
            return int(arr[-1])
        except (TypeError, ValueError):
            return 0
    if isinstance(arr, (int, float)):
        return int(arr)
    return 0


def generate_test_pdf_bytes(profile: Dict[str, Any], user_name: Optional[str] = None) -> bytes:
    """
    Собирает PDF-портрет по profile (как он лежит в fredi_users.profile JSONB).
    Возвращает байты PDF. Бросает исключение, если шрифт не найден.
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

    sb = _last_level(behavioral.get("СБ"))
    tf = _last_level(behavioral.get("ТФ"))
    ub = _last_level(behavioral.get("УБ"))
    cv = _last_level(behavioral.get("ЧВ"))

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.add_font("DejaVu", "", font_regular, uni=True)
    if font_bold:
        pdf.add_font("DejaVu", "B", font_bold, uni=True)
    else:
        # Если жирного начертания нет — используем regular как базу,
        # fpdf2 эмулирует жирность затемнением (грубо, но работает).
        pdf.add_font("DejaVu", "B", font_regular, uni=True)

    # Заголовок
    pdf.set_font("DejaVu", "B", 22)
    pdf.set_text_color(20, 20, 20)
    pdf.cell(0, 12, "Психологический портрет", ln=1)
    pdf.set_font("DejaVu", "", 11)
    pdf.set_text_color(110, 110, 110)
    addressee = (user_name or "").strip()
    if addressee:
        pdf.cell(0, 6, f"Для {addressee}", ln=1)
    pdf.cell(0, 6, "Сгенерировано Фреди — твоим виртуальным психологом", ln=1)
    pdf.ln(4)

    # Архетип-карточка
    pdf.set_fill_color(255, 245, 235)
    pdf.set_draw_color(255, 200, 170)
    x0, y0 = pdf.get_x(), pdf.get_y()
    pdf.set_font("DejaVu", "B", 18)
    pdf.set_text_color(255, 107, 59)
    pdf.cell(0, 12, str(archetype), ln=1, fill=True, border=1)
    pdf.set_text_color(100, 100, 100)
    pdf.set_font("DejaVu", "", 10)
    sub_parts = []
    if display_name:
        sub_parts.append(f"Код: {display_name}")
    if perception_type:
        sub_parts.append(f"Тип восприятия: {perception_type}")
    sub_parts.append(f"Уровень мышления: {thinking_level}/9")
    pdf.cell(0, 7, " · ".join(sub_parts), ln=1)
    pdf.ln(6)

    # Векторы
    pdf.set_font("DejaVu", "B", 13)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 8, "Поведенческие векторы", ln=1)
    pdf.set_font("DejaVu", "", 11)

    def _vector_row(label: str, level: int, descr: Dict[int, str]):
        pdf.set_text_color(40, 40, 40)
        pdf.set_font("DejaVu", "B", 11)
        pdf.cell(36, 7, f"{label} {level or '—'}/9", ln=0)
        pdf.set_font("DejaVu", "", 11)
        pdf.set_text_color(80, 80, 80)
        text = descr.get(int(level), "—") if level else "Нет данных"
        pdf.multi_cell(0, 6, text)
        pdf.ln(1)

    _vector_row("СБ", sb, SB_LEVELS)
    _vector_row("ТФ", tf, TF_LEVELS)
    _vector_row("УБ", ub, UB_LEVELS)
    _vector_row("ЧВ", cv, CV_LEVELS)

    pdf.ln(2)

    # Глубинный паттерн
    attach = _clean_for_pdf(deep.get("attachment") or "")
    if attach:
        pdf.set_font("DejaVu", "B", 13)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 8, "Глубинный паттерн", ln=1)
        pdf.set_font("DejaVu", "", 11)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(0, 6, attach)
        pdf.ln(2)

    # AI-комментарий
    if ai_text:
        pdf.set_font("DejaVu", "B", 13)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 8, "Комментарий", ln=1)
        pdf.set_font("DejaVu", "", 11)
        pdf.set_text_color(60, 60, 60)
        # Чистим markdown-bold и переносы.
        clean = ai_text.replace("**", "").replace("__", "")
        for para in clean.split("\n\n"):
            pdf.multi_cell(0, 6, para.strip())
            pdf.ln(1)

    # Подвал
    pdf.ln(4)
    pdf.set_draw_color(220, 220, 220)
    pdf.set_line_width(0.2)
    pdf.line(pdf.l_margin, pdf.get_y(), 210 - pdf.r_margin, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(150, 150, 150)
    pdf.multi_cell(0, 5,
        "Это твой портрет — он не диагноз и не приговор, а ориентир. "
        "Я буду рядом, когда захочешь вернуться к практике. — Фреди")

    out = pdf.output(dest="S")
    if isinstance(out, str):
        return out.encode("latin-1")
    return bytes(out)
