"""Вопрос про оплату получает факты из PLANS, а не «я бесплатный».

28.09.2026 на «как платно продолжить разговор» Фреди ответил, что он
бесплатный; человек хотел заплатить.
"""
import pathlib
import re

BASIC = (pathlib.Path(__file__).resolve().parents[1] / "modes" / "basic.py").read_text(encoding="utf-8")
PRESETS = (pathlib.Path(__file__).resolve().parents[1] / "modes" / "prompts" / "basic_presets.py").read_text(encoding="utf-8")


def _func(src, name):
    i = src.index(f"def {name}(")
    j = src.find("\n    def ", i + 1)
    return src[i:j if j > 0 else len(src)]


def test_pricing_block_uses_plans_and_forbids_free_claim():
    body = _func(BASIC, "_build_pricing_block")
    assert "from payment import PLANS" in body
    assert "Никогда не говори, что ты бесплатный" in body
    assert "690" not in body and "69 ₽" not in body, "цены только из PLANS"


def test_pricing_block_wired_into_prompt():
    # С 09.10.2026 в чате с токенами (/chat/) вместо него — блок токенов.
    assert "else self._build_pricing_block(question))" in BASIC
    assert "self._build_token_pricing_block(question) if token_mode" in BASIC


def test_pay_question_regex_catches_real_phrase():
    m = re.search(r'_PAY_QUESTION = re\.compile\(\s*(r".*?"\s*r".*?"\s*r".*?")', BASIC, re.S)
    assert m
    pat = "".join(eval(p) for p in re.findall(r'r"[^"]*"', m.group(1)))
    rx = re.compile(pat, re.I)
    for s in ("как платно продолжить разговор", "сколько стоит подписка", "как оплатить"):
        assert rx.search(s), s
    for s in ("мне плохо", "муж не разговаривает со мной"):
        assert not rx.search(s), s


def test_znakomstvo_preset_allows_direct_price_answer():
    assert "Никогда не говори,\n  что ты бесплатный" in PRESETS or "что ты бесплатный" in PRESETS
