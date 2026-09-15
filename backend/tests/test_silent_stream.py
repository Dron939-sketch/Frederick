# -*- coding: utf-8 -*-
"""Беззвучный режим голосового стрима: text_only.

15.09.2026 в окне разговора появилась кнопка «выключить звук»: голос Фреди
из динамика в метро или в открытом офисе — неуместный формат, и человек
закрывает вкладку, а не ищет, где убавить громкость.

Тишина у человека — это половина дела. Вторая половина в том, что синтез
не должен состояться вовсе: он стоит денег и секунд ожидания, и платить
за озвучку, которую никто не услышит, незачем. Здесь проверяется именно
это: при text_only ветка синтеза недостижима, а предложение всё равно
уходит клиенту — одним текстом, без b64.

main.py не импортируется (БД, Redis, ключи), поэтому разбираем исходник.
"""
import ast
import os

import pytest

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "main.py"))


def _func(name, root=None):
    src = open(_SRC, encoding="utf-8").read()
    tree = root or ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"{name} в main.py не найдена")


@pytest.fixture(scope="module")
def endpoint():
    return _func("process_voice_stream")


def test_endpoint_accepts_text_only(endpoint):
    """Фронт присылает флаг формой — без параметра он молча потеряется."""
    names = [a.arg for a in endpoint.args.args + endpoint.args.kwonlyargs]
    assert "text_only" in names


def test_synth_returns_before_tts(endpoint):
    """При text_only синтез не вызывается: ранний возврат стоит до него."""
    synth = _func("_synth_sentence", endpoint)
    early = None
    tts = None
    for node in synth.body:
        if isinstance(node, ast.If) and isinstance(node.test, ast.Name) \
                and node.test.id == "text_only":
            assert any(isinstance(b, ast.Return) for b in node.body), (
                "ветка text_only обязана возвращать управление, а не просто "
                "что-то логировать"
            )
            early = node.lineno
    for node in ast.walk(synth):
        if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "_tts_wp":
            tts = node.lineno
    assert early is not None, "в _synth_sentence нет ветки text_only"
    assert tts is not None, "вызов синтеза не найден — тест устарел"
    assert early < tts, "ранний возврат стоит после синтеза: деньги уже потрачены"


def test_silent_sentences_still_reach_the_client(endpoint):
    """Без звука человек обязан видеть ответ предложение за предложением.

    Событие `audio` с одним полем text понимают и старые клиенты: текст они
    добавляют в ленту, а проигрывание на пустом b64 выходит сразу.
    """
    src = open(_SRC, encoding="utf-8").read()
    i = src.index("async def process_voice_stream")
    block = src[i:src.index("@app.post(\"/api/voice/stt\")")]
    assert "if _b64 or (text_only and _txt):" in block, (
        "молчаливое предложение никуда не уходит — человек смотрит в пустой "
        "экран до самого конца ответа"
    )
    assert "def _sentence_event(" in block


def test_fallback_path_is_silent_too(endpoint):
    """Фоллбэк на цельный ответ тоже не должен синтезировать."""
    src = open(_SRC, encoding="utf-8").read()
    i = src.index("# Fallback: process_question напрямую.")
    block = src[i:i + 1200]
    j = block.index("if text_only:")
    k = block.index("voice_service.text_to_speech")
    assert j < k, "фоллбэк озвучивает ответ даже в беззвучном режиме"
