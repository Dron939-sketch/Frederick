# -*- coding: utf-8 -*-
"""Под meter стоят только ручки, которые действительно жгут токены.

Зачем тест. Список платных путей — одна регулярка в main.py, и ошибка в
ней не видна ниоткуда: лишний путь молча отвечает 402 и ломает сценарий,
недостающий — так же молча раздаёт LLM бесплатно. 14.09.2026 туда попал
/api/mirrors/complete — чистая запись в базу, ноль токенов, — и зеркала
приглашённых друзей не активировались вообще: ручка зовётся в конце
пятнадцатиминутного теста, когда бесплатный лимит уже исчерпан.

Регулярка читается прямо из исходника main.py: импортировать модуль
нельзя (он поднимает БД, Redis и голос), а копия здесь разъехалась бы с
оригиналом в первый же день.
"""

import ast
import os
import re

_MAIN = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "main.py")


def _meter_regex():
    with open(_MAIN, encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=_MAIN)
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        names = [t.id for t in node.targets if isinstance(t, ast.Name)]
        if "_METER_AI_REGEX" not in names:
            continue
        call = node.value
        assert isinstance(call, ast.Call), "_METER_AI_REGEX собирается не compile()"
        pattern = call.args[0]
        assert isinstance(pattern, ast.Constant), "шаблон перестал быть литералом"
        return re.compile(pattern.value)
    raise AssertionError("_METER_AI_REGEX не найдена в main.py")


REGEX = _meter_regex()


def test_llm_paths_are_metered():
    for path in (
        "/api/chat/stream",
        "/api/voice/process_stream",
        "/api/ai/generate",
        "/api/deep-analysis",
        "/api/dreams/interpret",
        "/api/tarot/interpret",
        "/api/natal/interpret",
    ):
        assert REGEX.match(path), f"{path} должен быть под meter"


def test_mirror_completion_is_free():
    """Главный случай: активация зеркала — запись в БД, а не генерация."""
    assert not REGEX.match("/api/mirrors/complete")
    assert not REGEX.match("/api/mirrors/mirror_ab12cd/complete")


def test_free_service_paths_are_not_metered():
    for path in (
        "/api/save-test-results",
        "/api/test/recommendations/900000042",
        "/api/mirrors/create",
        "/api/auth/register",
        "/health",
    ):
        assert not REGEX.match(path), f"{path} не должен требовать оплаты"
