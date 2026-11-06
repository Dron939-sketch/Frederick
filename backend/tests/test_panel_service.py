# -*- coding: utf-8 -*-
"""Панель двух моделей: как выбирается итоговый ответ.

Проверяем четыре сценария: ответы совпали (синтез не тратится), разошлись
(синтез собирает один текст), одна модель молчит (панель вырождается в
одиночный ответ), обе молчат (None — вызывающий код отдаёт заглушку).

Запуск: python3 backend/tests/test_panel_service.py
"""
import asyncio
import importlib.util
import os
import sys
import time

os.environ.setdefault("DEEPSEEK_API_KEY", "test")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

_spec = importlib.util.spec_from_file_location(
    "panel_service_probe",
    os.path.join(os.path.dirname(__file__), "..", "services", "panel_service.py"))
panel = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(panel)


def _const(value):
    async def fn(*a, **k):
        return value
    return fn


async def _discuss(primary_value, secondary_value, synth_value, user="вопрос"):
    calls = {"synth": 0}

    async def _synth(system_prompt, user_prompt):
        calls["synth"] += 1
        return synth_value

    if isinstance(primary_value, Exception):
        async def _primary(*a, **k):
            raise primary_value
    else:
        _primary = _const(primary_value)
    if isinstance(secondary_value, Exception):
        async def _secondary(*a, **k):
            raise secondary_value
    else:
        _secondary = _const(secondary_value)

    out = await panel.discuss(_primary, _secondary, _synth, user, "coach")
    return out, calls


def test_similar_answers_keep_primary_without_synth():
    same = "Сон налаживается режимом, а не силой воли."
    out, calls = asyncio.run(_discuss(same, same + " И светом.", "НЕ ДОЛЖНО БЫТЬ"))
    assert out == same, out
    assert calls["synth"] == 0, "при совпадении синтез — лишний вызов"


def test_different_answers_go_to_synthesis():
    out, calls = asyncio.run(_discuss(
        "Начни с режима и подъёма в одно время.",
        "Добавь утренний свет и убери экран за час до сна.",
        "Итог: режим, свет и экран."))
    assert out == "Итог: режим, свет и экран.", out
    assert calls["synth"] == 1


def test_secondary_silent_returns_primary():
    out, calls = asyncio.run(_discuss("Только основной ответ.", None, "НЕ НУЖНО"))
    assert out == "Только основной ответ.", out
    assert calls["synth"] == 0


def test_primary_silent_returns_secondary():
    out, calls = asyncio.run(_discuss(None, "Только второй ответ.", "НЕ НУЖНО"))
    assert out == "Только второй ответ.", out
    assert calls["synth"] == 0


def test_both_silent_returns_none():
    out, calls = asyncio.run(_discuss(None, None, "НЕ НУЖНО"))
    assert out is None
    assert calls["synth"] == 0


def test_synth_failure_falls_back_to_primary():
    out, calls = asyncio.run(_discuss("Основной ответ целиком.", "Совсем другой текст.",
                                      ""))
    assert out == "Основной ответ целиком.", out
    assert calls["synth"] == 1


def test_model_exception_does_not_break_panel():
    out, _ = asyncio.run(_discuss(RuntimeError("boom"), "Второй ответ.", "НЕ НУЖНО"))
    assert out == "Второй ответ.", out


def test_synth_user_keeps_figure_braces():
    text = "было {незакрытая скобка и {ещё одна"
    built = panel.build_synth_user("вопрос {x}", "первый {y}", text)
    assert text in built and "первый {y}" in built


def test_panel_mode_setting():
    old_mode, old_modes = os.environ.get("PANEL_MODE"), os.environ.get("PANEL_MODES")
    try:
        os.environ["PANEL_MODE"] = "off"
        assert panel.enabled() is False and panel.mode_applies("coach") is False

        os.environ["PANEL_MODE"] = "heavy"
        os.environ["PANEL_MODES"] = "psychologist,coach"
        assert panel.mode_applies("coach") is True
        assert panel.mode_applies("basic") is False

        os.environ["PANEL_MODE"] = "all"
        assert panel.mode_applies("basic") is True
    finally:
        for key, value in (("PANEL_MODE", old_mode), ("PANEL_MODES", old_modes)):
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def test_slow_secondary_does_not_block_primary():
    """Второе мнение не должно держать ответ: не успело — уходит основной."""
    old = os.environ.get("PANEL_SECONDARY_TIMEOUT")
    os.environ["PANEL_SECONDARY_TIMEOUT"] = "0.1"

    async def _primary():
        return "Ответ основной модели."

    async def _secondary():
        await asyncio.sleep(1.0)
        return "поздно"

    async def _synth(*a, **k):
        return "НЕ ДОЛЖНО"

    t0 = time.time()
    try:
        out = asyncio.run(panel.discuss(_primary, _secondary, _synth, "вопрос", "coach"))
    finally:
        if old is None:
            os.environ.pop("PANEL_SECONDARY_TIMEOUT", None)
        else:
            os.environ["PANEL_SECONDARY_TIMEOUT"] = old

    assert out == "Ответ основной модели.", out
    assert time.time() - t0 < 0.9, "ждать медленное второе мнение нельзя"


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
