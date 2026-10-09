# -*- coding: utf-8 -*-
"""Данные хода доходят до BasicMode; профиль без теста обнуляется.

10.10.2026: get_mode (без теста) и конструктор BasicMode собирали
user_data из семи полей. Всё остальное, что main.py кладёт для промпта,
выпадало: persona и token_mode чата /chat/ (личности отвечали «Я Фреди»),
session_turns и остаток минут (ритуал завершения, предупреждение о стене),
crisis_notice_shown, scenario_key, memory_allowed, пресет, приглашение."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.environ.setdefault("DEEPSEEK_API_KEY", "test")

# Другие тесты подменяют пакет modes пустым (без голосового стека). Тогда
# доисполняем настоящий modes/__init__.py в тот же объект пакета.
import modes  # noqa: E402
if not hasattr(modes, "get_mode"):
    _init = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "modes", "__init__.py")
    modes.__package__ = "modes"
    exec(compile(open(_init, encoding="utf-8").read(), _init, "exec"), modes.__dict__)
get_mode = modes.get_mode

TURN = {"persona": "mark", "token_mode": True, "session_turns": 3, "remaining_minutes": 2,
        "limit_minutes": 15, "crisis_notice_shown": True, "scenario_key": "x",
        "memory_allowed": True, "is_registered": False, "history": []}


def test_turn_data_reaches_basic_mode_without_test():
    m = get_mode("basic", 1, dict(TURN), None)
    for k, v in TURN.items():
        if k != "history":
            assert m.user_data.get(k) == v, k


def test_profile_blanked_without_test():
    m = get_mode("basic", 1, {**TURN, "deep_patterns": {"a": 1}, "confinement_model": {"b": 2}}, None)
    assert m.user_data["deep_patterns"] == {} and m.user_data["confinement_model"] is None


def test_persona_reaches_prompt():
    s = get_mode("basic", 1, dict(TURN), None)._build_system_prompt_block()
    assert "Тебя зовут «Без соплей»" in s and "Я Фреди" not in s
    assert "Тебя зовут Фреди" in get_mode("basic", 2, {"history": []}, None)._build_system_prompt_block()
