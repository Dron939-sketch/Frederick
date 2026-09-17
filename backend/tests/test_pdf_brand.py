"""Разбор теста выглядит как фирменное издание, а не как выгрузка.

17.09.2026, первый заход. Владелец показал свой гайд «Зумы внимания» —
чёрный #1C1C1C, янтарный #FFB800, белый, шрифт Cera Pro — и сказал:
«должно получиться не хуже вот этого… нужен титульный лист и все
остальные». Отдельно: «на титульнике будем писать архетип и картинку» и
«шрифтов не будет, найди сам». До этого отчёт был серо-синим: тёмно-синяя
плашка в 62 мм над текстом, синие полосы векторов, DejaVu — шрифт,
который просто стоял в системе.

17.09.2026, второй заход. Посмотрев на результат: «продумай всю концепцию
ещё раз, нужно сделать презентабельно и дорого». Претензия по делу —
макет был собран из приёмов веб-интерфейса: скруглённая плашка обложки,
янтарная «пилюля» архетипа, кремовая карточка выноски, кнопка-таблетка в
подвале. На бумаге всё это читается как скриншот приложения.

Тесты ниже стерегут ровно те решения, которыми это чинилось, — каждое
однажды было сделано неправильно.
"""

import pathlib
import sys

BACKEND = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

SRC = (BACKEND / "test_pdf.py").read_text(encoding="utf-8")


def _titul() -> str:
    return SRC.split("# ── Титульный лист")[1].split("# ── Векторы")[0]


# ── Палитра и шрифт ──────────────────────────────────────────────────
def test_brand_palette_defined():
    """Фирменные цвета заданы именами, а не втыканы числами по месту."""
    assert "BRAND_BLACK = (28, 28, 28)" in SRC
    assert "BRAND_AMBER = (255, 184, 0)" in SRC


def test_blue_accent_is_gone():
    """Синего из приложения в отчёте больше нет — ни в акценте, ни в тексте.

    INK был (26, 32, 44): почти чёрный, но с синевой. На экране незаметно,
    на бумаге даёт выцветшую печать рядом с настоящим чёрным плашек.
    """
    assert "(59, 130, 255)" not in SRC, "вернулся синий акцент"
    assert "ACCENT = (255, 184, 0)" in SRC
    assert "INK = (26, 26, 26)" in SRC, "текст снова с синевой"


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


# ── Обложка ──────────────────────────────────────────────────────────
def test_title_page_is_separate():
    """Титул — отдельная страница, а не плашка над текстом."""
    assert "# ── Титульный лист" in SRC
    assert "pdf.add_page()" in _titul()


def test_cover_band_is_full_bleed():
    """Чёрное поле обложки идёт в обрез, без полей и без скруглений.

    Было `pdf.rect(MARGIN, 24, CONTENT_W, 70, round_corners=True,
    corner_radius=12)` — ровно так рисуют карточку в вебе, и обложка
    выглядела скриншотом приложения.
    """
    t = _titul()
    assert "pdf.rect(0, 0, 210, COVER_BAND_H" in t, "полоса обложки не в обрез"
    assert "round_corners" not in t, "на обложке вернулись скругления"


def test_archetype_is_the_cover_title():
    """Архетип — заголовок издания на полосе, а не «пилюля» под ней."""
    t = _titul()
    assert "corner_radius" not in t, "вернулась пилюля архетипа"
    # белым по чёрному, с посчитанным числом строк
    assert "arch_lines" in t, "высота архетипа не считается"
    assert "pdf.set_text_color(255, 255, 255)" in t


def test_long_archetype_height_is_computed():
    """Длинные названия не обрезаются: высота блока считается по строкам.

    «Спокойный воин» и «Наблюдатель за наблюдателем внутри себя» — разной
    длины, и подпись под архетипом с фиксированной координатой на втором
    наезжала на текст.
    """
    assert "44 + arch_lines * 10 + 4" in _titul()


def test_owner_kicker_is_on_the_cover():
    """Строка, которую заказал владелец, стоит на обложке целиком.

    «Разбор психологического профиля от виртуального психолога Фреди с
    использованием MeysterAi» — разнесена на два конца полосы: жанр
    сверху, авторство снизу.
    """
    t = _titul()
    assert "Разбор психологического профиля" in t
    assert "Виртуальный психолог Фреди" in t
    assert "MeysterAi" in t


def test_meysterai_keeps_its_case():
    """«MeysterAi» не уходит в верхний регистр — это название, а не слово.

    Капитель по умолчанию поднимает строку в caps, и название выходило
    как «MEYSTERAI».
    """
    # Название встречается и в комментарии-пояснении, и в самой строке —
    # берём последнее вхождение, то есть код.
    t = _titul()
    kicker = t.rsplit("MeysterAi", 1)[1][:200]
    assert "caps=False" in kicker, "название бренда уедет в верхний регистр"


def test_cover_illustration_is_the_owner_drawing():
    """На обложке рисунок владельца, и его пропорции заданы явно."""
    assert 'ART_FILE = "titul-marionetka.png"' in SRC
    assert (BACKEND / "assets" / "pdf" / "titul-marionetka.png").exists()
    assert "ART_RATIO = 1100 / 687" in SRC


def test_missing_illustration_does_not_break_report():
    """Нет картинки — отчёт всё равно собирается: текст важнее рисунка."""
    t = _titul()
    assert "os.path.exists(art)" in t
    assert "except Exception" in t


def test_cover_does_not_spill_to_new_page():
    """Обложка не уезжает на пустой лист.

    Автоперенос срабатывает на 271-м мм, выходные данные стоят на 277-м —
    без выключения переноса в отчёте появлялась страница, где не было
    ничего, кроме «meysternlp.ru».
    """
    t = _titul()
    assert "prev_auto = pdf.auto_page_break" in t
    assert "pdf.set_auto_page_break(False)" in t


# ── Внутренние страницы ──────────────────────────────────────────────
def test_running_head_starts_after_cover():
    """Колонтитул есть на всех страницах, кроме обложки."""
    assert "class _Book(FPDF)" in SRC
    head = SRC.split("def header(self)")[1].split("pdf = _Book")[0]
    assert "self.page_no() == 1" in head, "колонтитул полезет на обложку"
    assert "self.page_no() - 1" in head, "нумерация считает обложку"


def test_sections_are_numbered():
    """Разделы нумеруются — это и отличает издание от выгрузки."""
    assert 'f"{self.section:02d}"' in SRC


def test_heading_is_not_left_hanging():
    """Заголовок не остаётся один в подвале страницы."""
    assert "keep: float = 34" in SRC
    assert "pdf.get_y() + top + keep > 262" in SRC


def test_recommendations_stay_on_one_page():
    """«С чего начать» не разрывается: иначе под ним зияет полстраницы."""
    assert 'r.h("С чего начать", keep=min(3, len(recs)) * 36)' in SRC


def test_body_text_is_not_justified():
    """Текст выключен влево.

    В fpdf2 multi_cell по умолчанию выключает по формату, а переносов
    он не расставляет: в русском абзаце на 166 мм это давало реки из
    пробелов — самый дешёвый вид, какой бывает у набора.
    """
    assert "pdf.multi_cell(CONTENT_W, lead, para, align=\"L\")" in SRC
    for bad in ('multi_cell(CONTENT_W, 6, t)',
                'multi_cell(CONTENT_W, 6, body)',
                'multi_cell(inner, 6.4, p)'):
        assert bad not in SRC, f"вернулась выключка по формату: {bad}"


def test_quote_has_no_filled_card():
    """Выноска — янтарная вертикаль на поле, без кремовой заливки."""
    assert "ACCENT_SOFT" not in SRC, "вернулась заливка карточки"
    assert "def quote(" in SRC
    assert "def card(" not in SRC


def test_bars_are_thin_rules():
    """Шкала — тонкая дорожка во всю колонку, а не девять брусков.

    Бруски по 8×3.2 мм перетягивали страницу на себя и читались как
    индикатор загрузки.
    """
    bar = SRC.split("def bar(")[1].split("def quote(")[0]
    assert "seg_w" not in bar, "вернулись бруски"
    assert "pdf.rect(MARGIN, y, CONTENT_W, 1.6" in bar


# ── Концовка ─────────────────────────────────────────────────────────
def test_coda_is_a_band_not_a_button():
    """Финал — распашная чёрная полоса, рифма к обложке.

    Была янтарная кнопка-таблетка в 74 мм — та же, что в приложении, и
    последний лист превращался в баннер.
    """
    coda = SRC.split("# ── Концовка")[1]
    assert "pdf.rect(0, CODA_TOP, 210, 297 - CODA_TOP" in coda
    assert "corner_radius" not in coda, "вернулась кнопка-таблетка"
    assert "link=FREDI_URL" in coda, "из концовки пропала ссылка"


def test_coda_never_lands_on_content():
    """Полоса концовки не наезжает на текст."""
    coda = SRC.split("# ── Концовка")[1]
    assert "if pdf.get_y() > CODA_TOP - 22" in coda
    assert "pdf.set_auto_page_break(False)" in coda


# ── Числа векторов ───────────────────────────────────────────────────
def test_vector_levels_match_what_the_app_showed():
    """PDF повторяет числа, которые человек видел на экране.

    Ошибка нашлась 17.09.2026 на живом профиле. Генератор брал последний
    этап массива (_last_level), а приложение считает среднее по этапам
    (fredi/test.js, calculateFinalProfile). У человека с массивами
    СБ [6,5], ТФ [5,1], УБ [1,6], ЧВ [6,3] на экране стоял код
    СБ-6_ТФ-3_УБ-4_ЧВ-5, а в файл уходило СБ-5_ТФ-1_УБ-6_ЧВ-3 — мимо по
    всем четырём векторам.
    """
    import test_pdf
    behavioral = {"СБ": [6, 5], "ТФ": [5, 1], "УБ": [1, 6], "ЧВ": [6, 3]}
    got = [test_pdf._avg_level(behavioral[k])
           for k in ("СБ", "ТФ", "УБ", "ЧВ")]
    assert got == [6, 3, 4, 5], f"векторы разошлись с приложением: {got}"


def test_half_rounds_up_like_javascript():
    """Половина округляется вверх.

    JS Math.round(4.5) = 5, а встроенный round() в Python = 4 (до
    чётного). ЧВ [6, 3] даёт ровно 4.5 — на банковском округлении файл
    снова разошёлся бы с экраном.
    """
    import test_pdf
    assert test_pdf._avg_level([6, 3]) == 5
    assert test_pdf._avg_level([1, 2]) == 2


def test_app_snapshot_wins_over_recount():
    """Пока есть снимок приложения, ничего не пересчитываем."""
    import test_pdf
    pd = {"sbLevel": 6, "tfLevel": 3, "ubLevel": 4, "chvLevel": 5}
    beh = {"СБ": [1], "ТФ": [1], "УБ": [1], "ЧВ": [1]}
    got = [test_pdf._vector_level(pd, beh, k)
           for k in ("СБ", "ТФ", "УБ", "ЧВ")]
    assert got == [6, 3, 4, 5]


def test_old_records_without_snapshot_still_work():
    """Старые записи без profile_data считаются по массиву этапов."""
    import test_pdf
    assert test_pdf._vector_level({}, {"СБ": [6, 5]}, "СБ") == 6
    assert test_pdf._vector_level({}, {}, "СБ") == 0


def test_vector_scale_tops_out_at_six():
    """Шкала векторов 1..6, а не 1..9.

    В отчёте стояло «6 / 9», и каждая шкала выглядела на треть короче,
    чем есть: шесть — это потолок, а читалось как «до потолка далеко».
    Уровни 7–9 бывают только у вопросов этапа мышления и в
    behavioral_levels не попадают. Проверено на 108 живых профилях
    17.09.2026: ни одного значения выше шести.
    """
    import test_pdf
    assert test_pdf.VECTOR_MAX == 6
    bar = SRC.split("def bar(")[1].split("def quote(")[0]
    assert "/ 9" not in bar, "шкала снова рисуется из девяти"
    assert "9.0" not in bar
    assert "VECTOR_MAX" in bar


def test_pdf_and_doubles_count_vectors_the_same_way():
    """PDF и поиск двойников считают вектора одинаково.

    До 17.09.2026 в бэкенде жило три разных способа свести
    behavioral_levels в число, и все три давали разное. У 74 профилей из
    108 карточка «двойника» показывала вектора, не сходившиеся с кодом
    профиля, напечатанным рядом в той же карточке.
    """
    import pathlib as pl
    main = (pl.Path(__file__).resolve().parents[1]
            / "main.py").read_text(encoding="utf-8")
    vl = main.split("def _vector_levels(")[1].split("\ndef ")[0]
    assert "math.floor(sum(nums) / len(nums) + 0.5)" in vl, (
        "round() округляет половину до чётного, а экран — вверх")
    assert "snapshot.get(fields[k])" in vl, "снимок приложения игнорируется"


# ── Сборка целиком ───────────────────────────────────────────────────
def test_report_builds_end_to_end():
    """Отчёт собирается на реальном профиле."""
    import warnings
    warnings.filterwarnings("ignore")
    import test_pdf
    profile = {
        "profile_data": {"archetype": "Спокойный воин", "display_name": "Анна",
                         "perception_type": "аудиал", "thinking_level": 6},
        "behavioral_levels": {"СБ": [5], "ТФ": [7], "УБ": [3], "ЧВ": [6]},
        "ai_generated_profile": "КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА\nДержите удар.\n\n"
                                "• Первый пункт\n• Второй пункт",
        "deep_patterns": {"attachment": "тревожно-избегающий"},
    }
    data = test_pdf.generate_test_pdf_bytes(
        profile, user_name="Анна",
        psychologist_thought="Разрыв между стойкостью и деньгами.",
        recommendations=[{"title": "Курс «Границы»", "format": "Лекторий",
                          "what": "Про отказ без ссоры.",
                          "url": "/blog/lektorij/granicy/"}])
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


def test_empty_profile_still_produces_a_document():
    """Пустой профиль не роняет генератор: отчёт без данных всё равно файл."""
    import warnings
    warnings.filterwarnings("ignore")
    import test_pdf
    data = test_pdf.generate_test_pdf_bytes({})
    assert data[:4] == b"%PDF"
