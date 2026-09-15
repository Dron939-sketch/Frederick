# -*- coding: utf-8 -*-
"""Срезатель запрещённых зачинов ответа.

Пресет запрещает открывать ответ словами «Так стоп», «Стоп», «Смотри»,
«О, ловлю тебя», «Спорим», «А вот это интересно». Инструкции оказалось
мало: в выгрузке диалогов за 09–15.09.2026 ими начинался каждый пятый
ответ — 309 из 1419. Причём строка про «Так стоп» стояла в промпте уже
с прошлой выгрузки, то есть текстом это не лечится. Отсюда механический
срез в BasicMode.

Импортировать basic.py целиком нельзя — он тянет БД, Redis и голос,
поэтому достаём регулярку и метод разбором исходника, как это уже
сделано в соседних тестах.
"""
import ast
import os
import re

import pytest

_SRC = os.path.join(os.path.dirname(__file__), "..", "modes", "basic.py")


def _load():
    src = open(os.path.abspath(_SRC), encoding="utf-8").read()
    cls = next(n for n in ast.parse(src).body if isinstance(n, ast.ClassDef))
    pat = next(
        n for n in cls.body
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "_BANNED_OPENER"
    )
    fn = next(
        n for n in cls.body
        if isinstance(n, ast.FunctionDef) and n.name == "_strip_banned_opener"
    )
    ns = {"re": re}
    exec(compile(ast.Module([pat], []), "<pat>", "exec"), ns)
    exec(compile(ast.Module([fn], []), "<fn>", "exec"), ns)

    class Probe:
        _BANNED_OPENER = ns["_BANNED_OPENER"]
        _strip_banned_opener = ns["_strip_banned_opener"]

    return Probe()


@pytest.fixture(scope="module")
def probe():
    return _load()


@pytest.mark.parametrize("before,after", [
    ("Так стоп. «Просто спать» — это не про усталость.",
     "«Просто спать» — это не про усталость."),
    ("Смотри, «нет сил» — это редко про тело.",
     "«нет сил» — это редко про тело."),
    ("Спорим, ты уже знаешь ответ.", "Ты уже знаешь ответ."),
    ("О, ловлю тебя на слове: ты сказал «никогда».",
     "Ты сказал «никогда»."),
    ("Стоп. Дело не в лени.", "Дело не в лени."),
    ("А вот это интересно — ты назвал это работой.",
     "Ты назвал это работой."),
])
def test_strips_banned_openers(probe, before, after):
    assert probe._strip_banned_opener(before) == after


@pytest.mark.parametrize("text", [
    # Не зачин, а нормальное начало предложения с тем же корнем.
    "Смотрите на это иначе: дело не в лени.",
    "Стопроцентной уверенности не даст никто.",
    "Спорить с ним бесполезно.",
    "Столько лет вместе — и вдруг чужие.",
    # «Прямо сейчас» намеренно не в списке: им начинаются и нужные фразы.
    # Срезать зачин ценой ослабленного предупреждения о враче нельзя.
    "Прямо сейчас вам нужен врач, а не разговор.",
])
def test_keeps_legitimate_starts(probe, text):
    assert probe._strip_banned_opener(text) == text


def test_empty_when_sentence_was_only_the_opener(probe):
    """Предложение из одного зачина обнуляется — вызывающий его пропустит,
    и первым станет следующее, а не пустая строка в чате."""
    assert probe._strip_banned_opener("Так стоп.") == ""
    assert probe._strip_banned_opener("Стоп!") == ""


def test_capitalizes_after_cut(probe):
    """После среза предложение не должно начинаться со строчной буквы."""
    assert probe._strip_banned_opener("Смотри, ты уже сам назвал корень.") \
        == "Ты уже сам назвал корень."


def test_noop_on_empty(probe):
    assert probe._strip_banned_opener("") == ""
    assert probe._strip_banned_opener(None) is None
