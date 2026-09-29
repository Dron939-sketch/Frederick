"""Выдуманные сроки вырезаются из ответа, повторы называются модели.

Выгрузка 22–29.09.2026: блок «ФАКТЫ» (#699) не остановил «Две недели назад
ты бы сказала…» и «Ты уже месяц живёшь…» в десятиминутном разговоре.
Там же оплативший пробу получил «две колонки» четыре раза за утро.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASIC = (ROOT / "modes" / "basic.py").read_text(encoding="utf-8")
MAIN = (ROOT / "main.py").read_text(encoding="utf-8")

# Модульная часть фильтра — без импорта BasicMode с его зависимостями.
_ns = {"re": re}
_start = BASIC.index("# Выдуманные сроки")
_end = BASIC.index("\n\n\n", BASIC.index("def strip_invented_time"))
exec(BASIC[_start:_end], _ns)
strip = _ns["strip_invented_time"]


def _method(name, **extra):
    i = BASIC.index(f"    def {name}(")
    j = BASIC.find("\n    def ", i + 1)
    body = re.sub(r"^    ", "", BASIC[i:j], flags=re.M)
    ns = dict(_ns, **extra)
    exec(body, ns)
    return ns[name]


def test_invented_time_removed_from_real_replies():
    assert strip("Ты уже месяц живёшь с двумя взаимоисключающими вещами.") == \
        "Ты живёшь с двумя взаимоисключающими вещами."
    assert strip("Две недели назад ты бы сказала «муж меня любит», сейчас — «муж врёт».") == \
        "Ты бы сказала «муж меня любит», сейчас — «муж врёт»."
    assert strip("Это про то, что ты годами делал его работу, а он не заметил.") == \
        "Это про то, что ты делал его работу, а он не заметил."


def test_advice_about_future_untouched():
    for s in ("Запиши три дня подряд эти моменты.",
              "Попробуй на этой неделе один раз не вмешаться.",
              "Через неделю вернись и расскажи, что вышло.",
              "Пять лет, и не раз — это уже не про паузу.",
              "Двадцать лет назад об этом вообще не говорили.",
              # вопрос о сроке и условие — не утверждения
              "Скажи, а её живот давно беспокоит — дни или уже недели?",
              "Скажи прямо: это тянется месяцами или появилось после чего-то?",
              "Если это всё подряд, годами — тогда ты складываешь в помещение без выхода."):
        assert strip(s) == s, s


def test_sentence_of_only_time_dropped():
    assert strip("Уже неделю.") == ""
    assert strip("Неделю назад ты бы и не заметила этого, а сейчас замечаешь.") == \
        "Ты бы и не заметила этого, а сейчас замечаешь."


class _Self:
    def __init__(self, days, history=(), memory=""):
        self.user_data = {} if days is None else {"first_seen_days": days}
        self.history = list(history)
        self._memory_text = memory


def test_filter_only_first_day_without_named_time():
    on = _method("_time_filter_on")
    assert on(_Self(0), "муж врёт") is True
    # сам назвал время — сроки в ответе могут быть его
    assert on(_Self(0), "мы вместе три года") is False
    assert on(_Self(0, [{"role": "user", "content": "это давно тянется"}]), "что делать") is False
    # вернувшийся и голосовой путь без давности — не трогаем
    assert on(_Self(3), "муж врёт") is False
    assert on(_Self(None), "муж врёт") is False


def test_filter_wired_into_stream_and_fallback():
    assert BASIC.count("self._filter_time(") >= 3
    assert "time_on = self._time_filter_on(question)" in BASIC


def test_repeat_block_names_own_repeats():
    build = _method("_build_repeat_block")

    class S:
        history = [
            {"role": "user", "content": "опять подозрения"},
            {"role": "assistant", "content": "Подозрения вернулись — это не про неё, это про неизвестность."},
            {"role": "user", "content": "да"},
            {"role": "assistant", "content": "От тревоги умереть нельзя. Сделай две колонки."},
        ]

    text = build(S())
    assert "уже был" in text
    assert "«Подозрения вернулись —" in text and "«От тревоги умереть нельзя" in text
    assert "не предлагай заново" in text

    class Empty(S):
        history = [{"role": "user", "content": "привет"}]

    assert build(Empty()) == ""


def test_voice_block_only_for_voice():
    build = _method("_build_voice_block")

    class V:
        user_data = {"via_voice": True}

    class T:
        user_data = {}

    assert "переспроси" in build(V())
    assert build(T()) == ""
    assert MAIN.count('"via_voice": True') == 3
