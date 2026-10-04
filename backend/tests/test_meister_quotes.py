# -*- coding: utf-8 -*-
"""«Как говорит Андрей Мейстер» (04.10.2026): жёсткое правило упоминания.

Запуск: python3 -m pytest -q backend/tests/test_meister_quotes.py
"""
import importlib.util
import pathlib

BACKEND = pathlib.Path(__file__).resolve().parents[1]
BASIC = (BACKEND / "modes" / "basic.py").read_text(encoding="utf-8")


def _mod():
    spec = importlib.util.spec_from_file_location(
        "meister_probe", BACKEND / "modes" / "prompts" / "meister.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_quotes_are_verbatim_and_unique():
    m = _mod()
    texts = [q for _, q in m.QUOTES]
    assert len(texts) == len(set(texts))
    assert len(texts) >= 40
    for t in texts:
        assert t.endswith("."), t
        assert "Мейстер" not in t, "фраза не должна содержать имя — его добавляет ввод"
    assert all(topic in m.TOPIC_KEYWORDS for topic, _ in m.QUOTES)


def test_block_is_silent_without_topic_or_too_early():
    m = _mod()
    assert m.meister_block("привет", [], [], human_turns=1) == ""
    assert m.meister_block("муж опять кричит", ["он не слышит"], [], human_turns=2) == ""
    assert m.meister_block("как дела", ["ок", "норм"], [], human_turns=5) == "", \
        "нет темы — нет упоминания"


def test_block_picks_quotes_by_topic():
    m = _mod()
    b = m.meister_block("не могу сказать нет маме", ["она просит, а я не могу отказать"], [], human_turns=4)
    assert "Как говорит Андрей Мейстер" in b
    assert "Граница — это не разовое действие" in b
    assert b.count("\n— ") <= m.MEISTER_MAX_QUOTES


def test_block_once_per_conversation_and_never_in_crisis_or_minor():
    m = _mod()
    user = ["мне стыдно за то, что накричала"]
    assert m.meister_block("стыдно", user, [], human_turns=4) != ""
    used = ["Как говорит Андрей Мейстер: Стыд — единственное чувство…"]
    assert m.meister_block("стыдно", user, used, human_turns=4) == ""
    assert m.meister_block("стыдно", user, [], human_turns=4, crisis=True) == ""
    assert m.meister_block("стыдно", user, [], human_turns=4, minor=True) == ""
    assert m.meister_block("стыдно", user, [], human_turns=4, arm_on=False) == ""


def test_rules_text_is_strict():
    b = _mod().meister_block("тревога", ["тревожусь каждый день"], [], human_turns=3)
    for must in ("ОДНОГО раза", "ДОСЛОВНО", "ПОСЛЕ ответа", "молчание лучше натяжки",
                 "Не придумывай", "сказал бы"):
        assert must in b


def test_basic_mode_wires_block_after_crisis_and_by_parity():
    i = BASIC.index("crisis = self._build_crisis_block()")
    assert "self._build_meister_block(question, bool(crisis))" in BASIC[i:i + 800]
    assert "uid % 2 != 0" in BASIC, "половина людей без блока — для сравнения by=uidp"
