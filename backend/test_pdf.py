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
        # Заголовок раздела: коротко и целиком заглавными.
        if letters and len(t) <= 42 and all(c.isupper() for c in letters):
            flush()
            r.h(t.capitalize() if t.isupper() and len(t) > 30 else t, size=11, top=5, rule=False)
            continue
        # Подзаголовок цены.
        if re.match(r"^Цена\s*\d+[.):]", t):
            flush()
            pdf.ln(1)
            pdf.set_font("DejaVu", "B", 10.5)
            _rgb(pdf, "set_text_color", INK)
            pdf.set_x(MARGIN)
            pdf.multi_cell(CONTENT_W, 5.4, t)
            pdf.set_font("DejaVu", "", 10.5)
            continue
        # Пункт списка: с отступом, чтобы перенос не липнул к маркеру.
        if t.startswith(("•", "-", "—")):
            flush()
            body = t.lstrip("•-— ").strip()
            pdf.set_font("DejaVu", "", 10.5)
            _rgb(pdf, "set_text_color", INK)
            pdf.set_x(MARGIN + 2)
            pdf.cell(4, 5.4, "•")
            pdf.set_x(MARGIN + 6)
            pdf.multi_cell(CONTENT_W - 6, 5.4, body)
            pdf.ln(0.8)
            continue
        buf.append(t)
    flush()


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


# ── Оформление ────────────────────────────────────────────────────────
# Документ читают на телефоне, в почте, спустя дни — и он единственное,
# что остаётся у человека от получаса работы. Поэтому здесь не «отчёт из
# базы», а печатный разворот: обложка, воздух, узкая колонка текста,
# шкалы вместо цифр. Дорого выглядит сдержанность — два цвета, тонкие
# линейки, крупный заголовок и поля, а не градиенты и рамки.
# Фирменная палитра. До 17.09.2026 отчёт был серо-синим и ничем не
# напоминал остальные материалы: владелец показал свой гайд «Зумы
# внимания» — чёрный #1C1C1C, янтарный #FFB800, белый — и попросил,
# чтобы разбор выглядел не хуже. Три цвета, больше ничего.
BRAND_BLACK = (28, 28, 28)
BRAND_AMBER = (255, 184, 0)

INK = (26, 32, 44)        # основной текст, почти чёрный с синевой
MUTED = (107, 114, 128)   # подписи и второстепенное
HAIR = (226, 232, 240)    # волосяные линейки
# Янтарь — для заливок: полос, кнопки, подложки карточки. Для ТЕКСТА он
# не годится, на белом читается плохо, поэтому заголовки и названия
# рекомендаций идут чёрным, а янтарь их только подчёркивает.
ACCENT = (255, 184, 0)
ACCENT_SOFT = (255, 246, 219)
PAPER_DARK = (22, 28, 40) # плашка обложки
FREDI_URL = "https://meysternlp.ru/fredi/"

MARGIN = 20               # поля шире обычных: воздух и есть «дорого»
CONTENT_W = 210 - MARGIN * 2


def _rgb(pdf, setter, color):
    getattr(pdf, setter)(*color)


class _Report:
    """Тонкая обёртка над FPDF: колонтитул и повторяющиеся приёмы вёрстки."""

    def __init__(self, pdf, font_bold_real: bool):
        self.pdf = pdf
        self.bold_real = font_bold_real

    def h(self, text: str, size: int = 13, top: float = 7, rule: bool = True):
        """Заголовок раздела: капитель, линейка под ним, воздух сверху."""
        pdf = self.pdf
        pdf.ln(top)
        pdf.set_font("DejaVu", "B", size)
        _rgb(pdf, "set_text_color", INK)
        pdf.cell(0, 7, text, ln=1)
        if rule:
            _rgb(pdf, "set_draw_color", HAIR)
            pdf.set_line_width(0.3)
            y = pdf.get_y() + 1
            pdf.line(MARGIN, y, 210 - MARGIN, y)
            pdf.ln(3)

    def body(self, text: str, size: float = 10.5, lead: float = 5.6,
             color=None, gap: float = 2):
        pdf = self.pdf
        pdf.set_font("DejaVu", "", size)
        _rgb(pdf, "set_text_color", color or INK)
        for para in [p.strip() for p in str(text).split("\n\n") if p.strip()]:
            # multi_cell в fpdf2 оставляет курсор у ПРАВОГО края блока.
            # Без явного возврата к полю следующий абзац начинается там же
            # и уезжает за страницу — на второй странице так и вышло:
            # формат и адрес курса оказались обрезаны краем листа.
            pdf.set_x(MARGIN)
            pdf.multi_cell(CONTENT_W, lead, para)
            pdf.ln(gap)

    def label(self, text: str):
        pdf = self.pdf
        pdf.set_font("DejaVu", "", 8)
        _rgb(pdf, "set_text_color", MUTED)
        pdf.cell(0, 5, text.upper(), ln=1)

    def bar(self, label: str, level: int, caption: str):
        """Вектор шкалой, а не числом: уровень видно, не читая."""
        pdf = self.pdf
        if pdf.get_y() > 240:
            pdf.add_page()
        pdf.set_font("DejaVu", "B", 10.5)
        _rgb(pdf, "set_text_color", INK)
        pdf.cell(14, 6, label, ln=0)

        # Девять делений: заполненные — акцентом, пустые — волосяной линией.
        x = pdf.get_x()
        y = pdf.get_y() + 1.6
        seg_w, gap_w, hgt = 8.0, 1.6, 3.2
        lvl = int(level or 0)
        for i in range(9):
            _rgb(pdf, "set_fill_color", ACCENT if i < lvl else HAIR)
            pdf.rect(x + i * (seg_w + gap_w), y, seg_w, hgt, style="F")
        pdf.set_xy(x + 9 * (seg_w + gap_w) + 3, pdf.get_y())
        pdf.set_font("DejaVu", "", 9.5)
        _rgb(pdf, "set_text_color", MUTED)
        pdf.cell(0, 6, f"{lvl or '—'} из 9", ln=1)

        pdf.set_x(MARGIN + 14)
        pdf.set_font("DejaVu", "", 10)
        _rgb(pdf, "set_text_color", MUTED)
        pdf.multi_cell(CONTENT_W - 14, 5.2, caption)
        pdf.ln(2.5)

    def card(self, title: str, text: str):
        """Плашка для выделенного раздела — мягкая заливка, без рамки."""
        pdf = self.pdf
        if pdf.get_y() > 225:
            pdf.add_page()
        _rgb(pdf, "set_fill_color", ACCENT_SOFT)
        x, y = MARGIN, pdf.get_y()
        # Высоту считаем по тексту: рисуем заливку заранее, поверх — текст.
        pdf.set_font("DejaVu", "", 10.5)
        lines = 0
        for para in [p.strip() for p in text.split("\n\n") if p.strip()]:
            lines += len(pdf.multi_cell(CONTENT_W - 14, 5.6, para,
                                        split_only=True)) + 1
        hgt = lines * 5.6 + 16
        pdf.rect(x, y, CONTENT_W, hgt, style="F")
        pdf.set_xy(x + 7, y + 6)
        pdf.set_font("DejaVu", "B", 10.5)
        _rgb(pdf, "set_text_color", BRAND_BLACK)
        pdf.cell(0, 6, title, ln=1)
        pdf.set_x(x + 7)
        pdf.set_font("DejaVu", "", 10.5)
        _rgb(pdf, "set_text_color", INK)
        for para in [p.strip() for p in text.split("\n\n") if p.strip()]:
            pdf.set_x(x + 7)
            pdf.multi_cell(CONTENT_W - 14, 5.6, para)
            pdf.ln(1)
        pdf.set_y(y + hgt + 4)


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

    sb = _last_level(behavioral.get("СБ"))
    tf = _last_level(behavioral.get("ТФ"))
    ub = _last_level(behavioral.get("УБ"))
    cv = _last_level(behavioral.get("ЧВ"))

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.set_margins(MARGIN, MARGIN, MARGIN)
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
    # Раньше обложка была полосой в 62 мм, и разбор начинался прямо под
    # ней — документ читался как выгрузка, а не как письмо человеку.
    addressee = (user_name or "").strip()
    if addressee.lower() in ("друг", "гость"):
        addressee = ""
    stamp = datetime.now().strftime("%d.%m.%Y")

    # Чёрный блок с заголовком, именем и датой.
    _rgb(pdf, "set_fill_color", BRAND_BLACK)
    pdf.rect(MARGIN, 20, CONTENT_W, 70, style="F",
             round_corners=True, corner_radius=12)
    _rgb(pdf, "set_text_color", BRAND_AMBER)
    pdf.set_font("DejaVu", "B", 20)
    pdf.set_xy(MARGIN + 10, 33)
    pdf.cell(0, 10, "РАЗБОР ТЕСТА", ln=1)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("DejaVu", "", 12)
    pdf.set_xy(MARGIN + 10, 49)
    # Имя ставим как есть, без «Для …»: склонять чужое имя вслепую —
    # верный способ получить «Для Андрей» или «Для Любовю».
    pdf.cell(0, 7, addressee or "Ваш психологический портрет", ln=1)
    pdf.set_font("DejaVu", "", 9.5)
    pdf.set_text_color(185, 185, 185)
    pdf.set_xy(MARGIN + 10, 62)
    sub = [p for p in (perception_type, f"мышление {thinking_level}/9") if p]
    pdf.cell(0, 6, "  ·  ".join(sub + [stamp]), ln=1)

    # Архетип — янтарная «пилюля». Высота считается по числу строк:
    # «Спокойный воин» и «Наблюдатель за наблюдателем» — разной длины,
    # и фиксированная рамка обрезала бы второй.
    arch = str(archetype or "").strip() or "—"
    pdf.set_font("DejaVu", "B", 13)
    lines = max(1, int(pdf.get_string_width(arch) // (CONTENT_W - 16)) + 1)
    pill_h = 12 + 7 * (lines - 1)
    _rgb(pdf, "set_draw_color", BRAND_AMBER)
    pdf.set_line_width(0.9)
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(MARGIN, 102, CONTENT_W, pill_h, style="D",
             round_corners=True, corner_radius=min(9, pill_h / 2))
    _rgb(pdf, "set_text_color", BRAND_BLACK)
    pdf.set_xy(MARGIN + 8, 102 + (pill_h - 7 * lines) / 2)
    pdf.multi_cell(CONTENT_W - 16, 7, arch.upper(), align="C")

    # Рисунок. Если файла нет — просто пустое место: отчёт важнее
    # картинки, и падать из-за отсутствующего png он не должен.
    art = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "assets", "pdf", "titul-zerkalo.png")
    if os.path.exists(art):
        try:
            pdf.image(art, x=(210 - 70) / 2, y=150, w=70)
        except Exception as e:
            logger.warning(f"титульный рисунок не вставился: {e}")

    # Подвал титула. Автоперенос на время выключаем: он срабатывает на
    # 275-м миллиметре, и подпись в 274-м улетала на отдельную страницу —
    # в отчёте появлялся лист, где не было ничего, кроме «meysternlp.ru».
    prev_auto = pdf.auto_page_break
    pdf.set_auto_page_break(False)
    _rgb(pdf, "set_draw_color", BRAND_BLACK)
    pdf.set_line_width(0.3)
    pdf.line(MARGIN, 272, 210 - MARGIN, 272)
    pdf.set_font("DejaVu", "", 8.5)
    _rgb(pdf, "set_text_color", MUTED)
    pdf.set_xy(MARGIN, 274)
    pdf.cell(0, 5, "meysternlp.ru")
    pdf.set_auto_page_break(prev_auto, margin=22)

    pdf.add_page()
    r.body("Это описание того, как вы обычно поступаете, — не диагноз и не "
           "ярлык. Привычный ход можно менять; об этом и разговор с Фреди.",
           size=11, lead=6, color=MUTED)

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
        pdf.ln(4)
        r.card("Взгляд психолога", pt_clean)

    # ── С чего начать ────────────────────────────────────────────────
    # Правило владельца: результат теста обязан вести дальше. В файле,
    # который человек откроет через неделю, это единственная дверь.
    recs = [x for x in (recommendations or []) if isinstance(x, dict) and x.get("title")]
    if recs:
        r.h("С чего начать")
        for it in recs[:3]:
            pdf.set_font("DejaVu", "B", 10.5)
            _rgb(pdf, "set_text_color", BRAND_BLACK)
            title = _clean_for_pdf(str(it.get("title") or ""))
            url = str(it.get("url") or "")
            if url and not url.startswith("http"):
                url = "https://meysternlp.ru" + url
            pdf.set_x(MARGIN)
            pdf.multi_cell(CONTENT_W, 5.8, title)
            pdf.set_font("DejaVu", "", 9.5)
            _rgb(pdf, "set_text_color", MUTED)
            fmt = _clean_for_pdf(str(it.get("format") or ""))
            if fmt:
                pdf.set_x(MARGIN)
                pdf.multi_cell(CONTENT_W, 5, fmt)
            what = _clean_for_pdf(str(it.get("what") or ""))
            if what:
                _rgb(pdf, "set_text_color", INK)
                pdf.set_font("DejaVu", "", 10)
                pdf.set_x(MARGIN)
                pdf.multi_cell(CONTENT_W, 5.2, what)
            if url:
                pdf.set_font("DejaVu", "", 9)
                _rgb(pdf, "set_text_color", MUTED)
                pdf.set_x(MARGIN)
                pdf.multi_cell(CONTENT_W, 5, url, link=url)
            pdf.ln(4)

    # ── Дверь обратно ────────────────────────────────────────────────
    # Файл открывают через дни, и адреса к этому моменту человек не
    # помнит. Кнопка нажимается прямо в PDF — так же, как ссылки выше.
    if pdf.get_y() > 235:
        pdf.add_page()
    pdf.ln(6)
    btn_y = pdf.get_y()
    _rgb(pdf, "set_fill_color", ACCENT)
    pdf.rect(MARGIN, btn_y, 74, 13, style="F",
             round_corners=True, corner_radius=6.5)
    pdf.set_xy(MARGIN, btn_y + 3.4)
    pdf.set_font("DejaVu", "B", 11)
    # Чёрным по янтарю, а не белым: белый на #FFB800 не читается вовсе.
    _rgb(pdf, "set_text_color", BRAND_BLACK)
    pdf.cell(74, 6, "Поговорить с Фреди", align="C",
             link=FREDI_URL)
    pdf.set_y(btn_y + 16)
    pdf.set_x(MARGIN)
    pdf.set_font("DejaVu", "", 9.5)
    _rgb(pdf, "set_text_color", MUTED)
    pdf.multi_cell(CONTENT_W, 5,
        "Кнопка не нажимается — наберите адрес: meysternlp.ru/fredi")

    # ── Подвал ───────────────────────────────────────────────────────
    pdf.ln(5)
    _rgb(pdf, "set_draw_color", HAIR)
    pdf.set_line_width(0.3)
    pdf.line(MARGIN, pdf.get_y(), 210 - MARGIN, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("DejaVu", "", 9)
    _rgb(pdf, "set_text_color", MUTED)
    pdf.set_x(MARGIN)
    pdf.multi_cell(CONTENT_W, 5,
        "Фреди — виртуальный психолог. Сделан психологом Андреем Мейстером.")

    out = pdf.output(dest="S")
    if isinstance(out, str):
        return out.encode("latin-1")
    return bytes(out)
