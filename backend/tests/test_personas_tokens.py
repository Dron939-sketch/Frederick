# -*- coding: utf-8 -*-
"""Личности чата /chat/ и токены (09.10.2026).

Логика денег (выдача 50, списание без ухода в минус при 80 параллельных
запросах, однократное зачисление платежа, пришедшего трижды) проверена
на живом Postgres при разработке; здесь — то, что не требует базы.
"""
import importlib.util
import os

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))


def _load(name):
    spec = importlib.util.spec_from_file_location(name + "_t", os.path.join(ROOT, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


P = _load("personas")
T = _load("tokens")


def test_fredi_is_default_and_has_no_block():
    assert P.PERSONAS[0]["id"] == "fredi" == P.DEFAULT_ID
    assert P.get("нет-такого")["id"] == "fredi"
    assert P.prompt_block("fredi") == ""


def test_personas_keep_fredi_rules_and_honesty():
    for p in P.PERSONAS[1:]:
        b = P.prompt_block(p["id"])
        assert "главнее личности" in b, p["id"]
        assert "живым человеком себя не называй" in b, p["id"]
        assert "Не флиртуй" in b, p["id"]


def test_public_list_hides_prompts():
    for p in P.public_list():
        assert "prompt" not in p and p["greeting"] and p["name"]


def test_voices_fish_for_fredi_yandex_for_others():
    assert P.get("fredi")["voice"]["provider"] == "fish"
    for p in P.PERSONAS[1:]:
        assert p["voice"]["provider"] == "yandex" and p["voice"]["voice"], p["id"]


def test_token_economy_matches_owner_decision():
    assert T.FREE_TOKENS == 50 and T.COST_MESSAGE == 1 and T.COST_VOICE == 1
    assert {k: (v["tokens"], v["amount"]) for k, v in T.TOKEN_PACKS.items()} == {
        "tokens_100": (100, "149.00"), "tokens_300": (300, "349.00"), "tokens_1000": (1000, "990.00")}


def test_token_payment_is_not_a_subscription():
    src = open(os.path.join(ROOT, "payment.py"), encoding="utf-8").read()
    assert 'if payment_type == "tokens":' in src
    assert 'payment_data.pop("save_payment_method", None)' in src
    routes = open(os.path.join(ROOT, "payment_routes.py"), encoding="utf-8").read()
    assert "plan not in TOKEN_PACKS" in routes


def test_persona_endpoint_outside_minute_meter():
    import re
    src = open(os.path.join(ROOT, "main.py"), encoding="utf-8").read()
    i = src.index("_METER_AI_REGEX = _re_meter.compile(")
    pat = src[i:src.index(")", src.index("re.IGNORECASE", i) if "re.IGNORECASE" in src[i:i+3000] else src.index('$"', i))]
    assert '@app.post("/api/persona/stream")' in src
    assert "chat" in pat and "persona" not in pat


def test_basic_token_mode_has_no_minutes_talk():
    src = open(os.path.join(ROOT, "modes", "basic.py"), encoding="utf-8").read()
    assert 'closing = "" if token_mode else self._build_closing_block()' in src
    assert "if not closing and not token_mode:" in src
