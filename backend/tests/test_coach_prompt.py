# -*- coding: utf-8 -*-
"""Коуч задаёт вопросы, а не советует.

Владелец, 13.09.2026: задача коуча — вопросами делать мышление чище,
чтобы человек сам находил ответы и сам выводил себя в ясность; за
основу образа взят Бертран Рассел. Выгрузка до 13.09: из 37 ответов
коуча вопросом кончались 8, остальные — объяснения и советы по
600–1600 знаков.

Запуск: python3 backend/tests/test_coach_prompt.py
"""
import importlib.util
import os
import sys
import types

BACKEND = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, BACKEND)

_modes = types.ModuleType("modes")
_modes.__path__ = [os.path.join(BACKEND, "modes")]
sys.modules["modes"] = _modes
from modes.prompts import coach as c  # noqa: E402


def test_russell_stays_the_base():
    p = c.build_coach_system_prompt({})
    assert "Бертран" in p or "Рассел" in p


def test_answer_is_one_question_not_advice():
    p = c.build_coach_system_prompt({})
    assert "УСТРОЙСТВО КАЖДОГО ОТВЕТА" in p
    assert "ОДИН вопрос" in p
    assert "Без списка шагов" in p
    assert "КАКИЕ ВОПРОСЫ РАБОТАЮТ" in p
    assert "РАМКА РАЗГОВОРА" in p and "Что стало яснее?" in p
    # Общие правила «просят совет — дай» и «веди к действию» переопределены.
    assert "совет — это вопрос" in p
    assert "Три и больше — никогда" in p
    assert "КОНВЕЙЕР РАБОТЫ С ЗАПРОСОМ" not in p


def test_fewshot_answers_are_short_and_end_with_a_question():
    for m in c.COACH_FEWSHOT:
        if m["role"] != "assistant":
            continue
        t = m["content"].strip()
        assert t.endswith("?"), t
        assert len(t) < 400, len(t)
        assert "\n\n" not in t, "один абзац"
        assert "1." not in t and "Первое:" not in t, "без списков"


def test_fewshot_has_the_direct_ask_case():
    users = [m["content"] for m in c.COACH_FEWSHOT if m["role"] == "user"]
    assert any("Скажи прямо" in u for u in users)


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
