# -*- coding: utf-8 -*-
"""Поток чата не должен обрываться по длине ответа.

15.09.2026 владелец получил ответ, оборванный на полуслове («…лишь бы не
приближа»). Причина — `ClientTimeout(total=60)` на потоковом запросе:
total считает весь поток целиком, а не паузу в нём, поэтому длинный,
исправно идущий ответ рубился ровно на шестидесятой секунде. В логах
рядом лежит «streaming timeout (60s) prompt_chars=20765».

Тот же разбор уже был сделан для голосового потока (total=180,
sock_read=60) — но `_call_deepseek_streaming`, которым отвечает обычный
чат, остался с прежним значением.

Правило: у потокового запроса обязан стоять sock_read — стоп-сигналом
должна быть тишина, а не длина ответа. Проверяем разбором исходника:
импортировать сервис целиком нельзя (сеть, ключи, БД).
"""
import ast
import os

import pytest

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..",
                                    "services", "ai_service.py"))


def _timeouts_in(func_name):
    """Все ClientTimeout(...) внутри функции: список словарей kwargs."""
    tree = ast.parse(open(_SRC, encoding="utf-8").read())
    fn = None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            fn = node
            break
    assert fn is not None, f"функция {func_name} не найдена"
    out = []
    for node in ast.walk(fn):
        if isinstance(node, ast.Call):
            f = node.func
            name = getattr(f, "attr", None) or getattr(f, "id", None)
            if name == "ClientTimeout":
                out.append({k.arg: getattr(k.value, "value", None) for k in node.keywords})
    return out


@pytest.mark.parametrize("func", ["_call_deepseek_streaming"])
def test_streaming_has_sock_read(func):
    tos = _timeouts_in(func)
    assert tos, "в потоковом вызове нет ClientTimeout — это не проверяется"
    for to in tos:
        assert to.get("sock_read"), (
            "у потокового запроса обязан стоять sock_read: иначе total режет "
            "длинный ответ на полуслове"
        )
        assert (to.get("sock_read") or 0) < (to.get("total") or 0), (
            "sock_read должен быть меньше total — иначе тишина не отличается "
            "от долгого ответа"
        )


def test_streaming_total_is_not_a_minute():
    """Страховка от возврата прежнего значения."""
    for to in _timeouts_in("_call_deepseek_streaming"):
        assert (to.get("total") or 0) >= 180, (
            "минуты на весь поток мало: ответ на 1500 токенов при длинном "
            "промпте в неё не укладывается"
        )
