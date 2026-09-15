# -*- coding: utf-8 -*-
"""Кризисный перехват не должен заканчивать ход.

До 15.09.2026 перехват делал yield кризисной реплики и `return`: человек
рассказывал самое тяжёлое — про вред себе, про мысли не жить, — а получал
служебное сообщение с номером ВМЕСТО ответа. По существу сказанного Фреди
в этот ход не отвечал вообще, и со стороны это читается как «выслушал и
отправил куда-то».

Теперь безопасность идёт первой репликой, флаг _crisis_continue взводится,
и обычный путь отрабатывает следом: модель отвечает на то, что человек
сказал. _build_crisis_block говорит ей не повторять номера и не отсылать
к специалисту второй раз.

Импортировать basic.py целиком нельзя (БД, Redis, голос), поэтому метод
достаётся разбором исходника — как в соседних тестах.
"""
import ast
import os

import pytest

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "modes", "basic.py"))


def _source():
    return open(_SRC, encoding="utf-8").read()


def _load_block():
    cls = next(n for n in ast.parse(_source()).body if isinstance(n, ast.ClassDef))
    fn = next(n for n in cls.body
              if isinstance(n, ast.FunctionDef) and n.name == "_build_crisis_block")
    ns = {}
    exec(compile(ast.Module([fn], []), "<fn>", "exec"), ns)

    class Probe:
        _build_crisis_block = ns["_build_crisis_block"]

    return Probe()


@pytest.fixture(scope="module")
def probe():
    return _load_block()


def test_block_empty_without_crisis(probe):
    """Обычный ход — никаких кризисных указаний в промпте."""
    assert probe._build_crisis_block() == ""


def test_block_tells_not_to_repeat_numbers(probe):
    probe._crisis_continue = True
    out = probe._build_crisis_block()
    assert out, "после кризисной реплики блок обязан появиться"
    low = out.lower()
    assert "не повторяй номера" in low
    assert "не отсылай" in low
    assert "остаёшься" in low
    # Требовать шаг у человека в таком состоянии нельзя — это правило
    # пресета «когда шаг требовать нельзя», и здесь оно повторено явно.
    assert "не требуй шага" in low


def test_intercept_does_not_end_the_turn():
    """Страховка от возврата старого поведения.

    Между выдачей кризисного текста и продолжением не должно снова
    появиться `return`: именно он и обрывал разговор.
    """
    src = _source()
    i = src.index("crisis_text = (")
    j = src.index("_crisis_continue = True", i)
    between = src[i:j]
    assert "yield crisis_text" in between
    # Голый `return` в этом куске означает, что ход снова обрывается.
    for line in between.splitlines():
        assert line.strip() != "return", "кризисный перехват снова обрывает ход"


def test_crisis_line_has_no_trailing_question():
    """Вопрос задаёт настоящий ответ модели, который идёт следом.

    Иначе человек получает два вопроса подряд в худший момент — это
    прямо запрещено пресетом («подряд два вопроса — уже допрос»).
    """
    src = _source()
    i = src.index("crisis_text = (")
    j = src.index("self.conversation_history.append", i)
    block = src[i:j]
    assert "?" not in block, "в кризисной реплике не должно быть вопроса"


def test_numbers_are_routed_by_age():
    """8-800-2000-122 — детская линия, взрослым она не называется."""
    src = _source()
    i = src.index("_minor = _age is not None")
    j = src.index("crisis_text = (", i)
    block = src[i:j]
    assert "8-800-2000-122" in block
    assert "8-495-989-50-50" in block
    assert "_minor else" in block, "номер обязан выбираться по возрасту"
