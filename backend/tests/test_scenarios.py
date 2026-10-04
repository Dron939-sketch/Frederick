# -*- coding: utf-8 -*-
"""Сценарии по проблеме с первых реплик (04.10.2026): плечо, меню и
карточка, метка, проводка в BasicMode и main.py.

Запуск: python3 -m pytest -q backend/tests/test_scenarios.py
"""
import importlib.util
import pathlib

BACKEND = pathlib.Path(__file__).resolve().parents[1]
BASIC = (BACKEND / "modes" / "basic.py").read_text(encoding="utf-8")
MAIN = (BACKEND / "main.py").read_text(encoding="utf-8")


def _mod():
    spec = importlib.util.spec_from_file_location(
        "scenarios_probe", BACKEND / "modes" / "prompts" / "scenarios.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_arm_is_half_and_independent_of_parity():
    m = _mod()
    ids = range(1790538520834000, 1790538520834400)
    on = [i for i in ids if m.arm_on(i)]
    assert len(on) == 200
    assert any(i % 2 == 0 for i in on) and any(i % 2 == 1 for i in on)
    assert not m.arm_on(0) and not m.arm_on(None) and not m.arm_on("x")


def test_every_scenario_is_complete_and_grounded():
    m = _mod()
    assert len(m.SCENARIOS) >= 10
    full = m.scenario_prompt()
    for key, s in m.SCENARIOS.items():
        assert f"### {key}" in full
        assert 1 <= len(s["ask"]) <= 2, key
        assert s["give"] and s["avoid"] and s["route"] and s["specialist"], key
    cards = "\n".join(m._card(k, s) for k, s in m.SCENARIOS.items())
    for banned in ("исследовани", "учёные", "доказали", "8-800", "MBTI", "Люшер", "шаг 1"):
        assert banned.lower() not in cards.lower(), banned


def test_menu_is_compact_and_card_is_single():
    m = _mod()
    menu = m.menu_prompt()
    assert len(menu) < 9000, len(menu)
    for key in m.SCENARIOS:
        assert f"- {key} — " in menu
    for must in ("[[SCN:", "ОДИН", "третьему ответу", "метку не ставить", "больше двух раз",
                 "Кризисный блок", "номеров телефонов", "только из каталога", "путь"):
        assert must in menu, must
    card = m.card_prompt("anxiety", 3)
    assert "### anxiety" in card and "### partner.breakup" not in card
    assert "третий ответ" in card
    assert len(card) < 4000, len(card)
    assert "НЕ ставить" in m.menu_prompt(voice=True) and "НЕ ставить" not in menu


def test_block_follows_the_conversation():
    m = _mod()
    assert "Сценарии (ключ" in m.scenario_block(1)
    assert "Сценарии (ключ" in m.scenario_block(2)
    assert m.scenario_block(3) == "", "без выбора после второй реплики — обычный разговор"
    assert "### partner.conflict" in m.scenario_block(3, "partner.conflict")
    assert "### partner.conflict" in m.scenario_block(6, "PARTNER.CONFLICT")
    assert m.scenario_block(7, "partner.conflict") == ""
    assert m.scenario_block(2, "nope") == "", "неизвестный ключ — не меню и не карточка"
    # голос: меню держится до шестой реплики, метка запрещена
    assert "Сценарии (ключ" in m.scenario_block(5, voice=True)
    assert m.scenario_block(7, voice=True) == ""


def test_mark_strip_and_find():
    m = _mod()
    t = "Понял, речь про расставание. Сколько прошло? [[SCN:partner.breakup]]"
    assert m.strip_mark(t) == "Понял, речь про расставание. Сколько прошло?"
    assert m.find_mark(t) == "partner.breakup"
    assert m.find_mark("без метки") is None
    assert m.strip_mark("") == ""
    assert m.strip_mark("середина [[ SCN : anxiety ]] конец") == "середина конец"
    for key in m.SCENARIOS:
        assert m.find_mark(f"x [[SCN:{key}]]") == key


def test_basic_mode_and_main_are_wired():
    i = BASIC.index("def get_system_prompt")
    block = BASIC[i:i + 4500]
    assert "from .prompts.scenarios import arm_on, scenario_block" in block
    assert "scenario_block(self._human_turns(), ud.get(\"scenario_key\"), bool(ud.get(\"via_voice\")))" in block
    assert "{products}{scenarios}" in block
    j = MAIN.index("from modes.prompts.scenarios import strip_mark as _strip_scn")
    seg = MAIN[j:j + 600]
    assert "context_obj[\"scenario_key\"] = _scn" in seg
    assert "response_text = _strip_scn(response_text)" in seg
    assert "\"scenario_key\": context_obj.get(\"scenario_key\")" in MAIN
