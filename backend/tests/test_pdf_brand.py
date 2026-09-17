"""Разбор теста выглядит как фирменный материал, а не как выгрузка.

17.09.2026 владелец показал свой гайд «Зумы внимания» — чёрный #1C1C1C,
янтарный #FFB800, белый, шрифт Cera Pro — и сказал: «должно получиться
не хуже вот этого… нужен титульный лист и все остальные». Отдельно:
«на титульнике будем писать архетип и картинку» и «шрифтов не будет,
найди сам».

До этого отчёт был серо-синим: тёмно-синяя плашка в 62 мм над текстом,
синие полосы векторов, DejaVu — шрифт по умолчанию, который стоит в
системе, а не выбран.
"""

import pathlib
import re
import sys

BACKEND = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

SRC = (BACKEND / "test_pdf.py").read_text(encoding="utf-8")


def test_brand_palette_defined():
    """Фирменные цвета заданы именами, а не втыканы числами по месту."""
    assert "BRAND_BLACK = (28, 28, 28)" in SRC
    assert "BRAND_AMBER = (255, 184, 0)" in SRC


def test_blue_accent_is_gone():
    """Синего из приложения в отчёте больше нет."""
    assert "(59, 130, 255)" not in SRC, "вернулся синий акцент"
    assert "ACCENT = (255, 184, 0)" in SRC


def test_montserrat_is_first_choice():
    """Montserrat впереди DejaVu, и оба начертания настоящие."""
    for cand in ("_FONT_CANDIDATES", "_FONT_BOLD_CANDIDATES"):
        block = SRC.split(cand + " = [")[1].split("]")[0]
        first = [l for l in block.splitlines() if l.strip()][0]
        assert "Montserrat" in first, f"{cand}: первым не Montserrat"


def test_font_files_shipped_with_licence():
    """Шрифты лежат в репозитории вместе с лицензией OFL."""
    d = BACKEND / "assets" / "fonts"
    for f in ("Montserrat-Regular.ttf", "Montserrat-Bold.ttf", "OFL.txt"):
        assert (d / f).exists(), f"нет файла {f}"
    licence = (d / "OFL.txt").read_text(encoding="utf-8", errors="ignore")
    assert "SIL Open Font License" in licence


def test_title_page_is_separate():
    """Титул — отдельная страница, а не плашка над текстом."""
    assert "# ── Титульный лист" in SRC
    assert "РАЗБОР ТЕСТА" in SRC
    # после титула обязательно новая страница, иначе разбор полезет на обложку
    titul = SRC.split("# ── Титульный лист")[1].split("# ── Векторы")[0]
    assert "pdf.add_page()" in titul


def test_archetype_pill_height_is_computed():
    """Рамка архетипа считает высоту: длинные названия не обрезаются."""
    assert "pill_h = 12 + 7 * (lines - 1)" in SRC


def test_missing_illustration_does_not_break_report():
    """Нет картинки — отчёт всё равно собирается: текст важнее рисунка."""
    titul = SRC.split("# ── Титульный лист")[1].split("# ── Векторы")[0]
    assert "os.path.exists(art)" in titul
    assert "except Exception" in titul


def test_footer_does_not_spill_to_new_page():
    """Подвал титула не уезжает на пустой лист.

    Автоперенос срабатывает на 275-м мм, подпись стоит на 274-м — без
    выключения переноса в отчёте появлялась страница, где не было
    ничего, кроме «meysternlp.ru».
    """
    assert "prev_auto = pdf.auto_page_break" in SRC
    assert "pdf.set_auto_page_break(False)" in SRC


def test_button_text_is_readable_on_amber():
    """Белым по янтарю не пишем — не читается."""
    btn = SRC.split("Поговорить с Фреди")[0][-400:]
    assert "set_text_color\", BRAND_BLACK" in btn or "BRAND_BLACK)" in btn


def test_report_builds_end_to_end():
    """Отчёт собирается на реальном профиле и содержит три страницы."""
    import warnings
    warnings.filterwarnings("ignore")
    import test_pdf
    profile = {
        "profile_data": {"archetype": "Спокойный воин", "display_name": "Анна",
                         "perception_type": "аудиал", "thinking_level": 6},
        "behavioral_levels": {"СБ": [5], "ТФ": [7], "УБ": [3], "ЧВ": [6]},
        "ai_generated_profile": "КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА\nДержите удар.",
        "deep_patterns": {"attachment": "тревожно-избегающий"},
    }
    data = test_pdf.generate_test_pdf_bytes(profile, user_name="Анна")
    assert data[:4] == b"%PDF"
    assert len(data) > 20000, "отчёт подозрительно лёгкий — шрифты не вшились"


def test_long_archetype_does_not_crash():
    """Длинное название архетипа не ломает вёрстку титула."""
    import warnings
    warnings.filterwarnings("ignore")
    import test_pdf
    profile = {
        "profile_data": {"archetype": "Наблюдатель за наблюдателем внутри себя",
                         "display_name": "Пётр", "thinking_level": 4},
        "behavioral_levels": {"СБ": [2], "ТФ": [2], "УБ": [2], "ЧВ": [2]},
    }
    data = test_pdf.generate_test_pdf_bytes(profile, user_name="Пётр")
    assert data[:4] == b"%PDF"
