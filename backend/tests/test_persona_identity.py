# -*- coding: utf-8 -*-
"""Личность чата /chat/ не должна называть себя Фреди.

09.10.2026, проверка на проде после запуска: «Без соплей» на «Привет. Кто
ты и чем поможешь?» ответил «Я Фреди… Меня создал Андрей Мейстер, я его
цифровая копия. С чем пришёл?». Блок личности стоял в конце системного
промпта, а после него шли примеры ответов с подписью «Фреди:», история
с той же подписью и весь запрос пользователя — модель шла за большинством.
"""
import os
import sys
import types
import importlib.util

BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, BACKEND)
os.environ.setdefault("DEEPSEEK_API_KEY", "test")


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(BACKEND, rel))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


if "services.ai_service" not in sys.modules:
    _services = types.ModuleType("services")
    _services.__path__ = [os.path.join(BACKEND, "services")]
    sys.modules["services"] = _services
    _load("services.ai_service", "services/ai_service.py")
if "modes" not in sys.modules:
    _modes = types.ModuleType("modes")
    _modes.__path__ = [os.path.join(BACKEND, "modes")]
    sys.modules["modes"] = _modes

from modes.basic import BasicMode  # noqa: E402


def _mode(**user_data):
    b = BasicMode.__new__(BasicMode)
    b.user_data = user_data
    return b


def test_fredi_prompt_unchanged():
    b = _mode()
    assert b._persona_name() == ""
    assert _mode(persona="fredi")._persona_name() == ""


def test_persona_name_resolved():
    assert _mode(persona="mark")._persona_name() == "Без соплей"
    # Неизвестный id — это Фреди, а не исключение посреди ответа.
    assert _mode(persona="nope")._persona_name() == ""


def test_reminder_is_explicit():
    r = BasicMode._persona_reminder("Без соплей")
    assert "«Без соплей»" in r and "не говори «я Фреди»" in r


def test_first_contact_block_silent_for_persona():
    """Представление «Я Фреди. Моя задача…» — чужое для личности."""
    q = BasicMode._SEARCH_STARTS[0] + " с работы"
    assert _mode(session_turns=0)._build_first_contact_block(q)
    assert _mode(session_turns=0, persona="mark")._build_first_contact_block(q) == ""
