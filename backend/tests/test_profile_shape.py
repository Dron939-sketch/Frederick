# -*- coding: utf-8 -*-
"""Разбор после теста должен попадать в человека, а не в «людей такого типа».

16.09.2026. Владелец прошёл тест, получил портрет из пяти общих блоков и
сказал: «как будто не дожали — не напугали и не обрадовали. Сначала надо
похвалить за сильные стороны, потом чутка напугать, чем обернутся слабые,
и только потом — как это исправить».

Схема взята из бота «Тестирование личности», где она уже работает:
узнавание → цена проблемы → первый шаг → что дальше.

Здесь проверяется то, что ломается молча: порядок блоков, передача
собственных ответов человека в промпт и запрет называть курсы (их имена
подставляет каталог, а выдуманное название человек не найдёт).
"""
import os
import sys

import pytest

_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)


def _src(name):
    return open(os.path.join(_BACKEND, name), encoding="utf-8").read()


def test_profile_prompt_keeps_the_owners_order():
    src = _src(os.path.join("services", "ai_service.py"))
    i = src.index("async def generate_ai_profile")
    block = src[i:i + 6000]
    order = ["ЭТО ПРО ТЕБЯ, ЕСЛИ", "ЧТО У ТЕБЯ СИЛЬНОГО", "ЧЕМ ЭТО ОБХОДИТСЯ",
             "ГЛАВНЫЙ УЗЕЛ", "ПЕРВЫЙ ШАГ СЕГОДНЯ", "О ЧЁМ СПРОСИТЬ МЕНЯ"]
    pos = [block.index(h) for h in order]
    assert pos == sorted(pos), "похвала должна идти до цены, а шаги — после неё"


def test_prompt_forbids_inventing_course_names():
    """Каталог подставляется блоком рекомендаций; выдуманное имя не найдут."""
    src = _src(os.path.join("services", "ai_service.py"))
    i = src.index("async def generate_ai_profile")
    block = src[i:i + 6000]
    assert "Не называй курсы, игры, лекции и книги" in block
    # И по-прежнему запрещено пугать болезнями и ставить диагнозы.
    assert "Не ставь диагнозов" in block


def test_answers_reach_the_prompt():
    """Без ответов модель знает только коды и пишет про тип, а не про него.

    ai_service целиком не импортируется (тянет voice_service и numpy),
    поэтому функция выдёргивается из исходника — как в соседних тестах.
    """
    import ast

    src = _src(os.path.join("services", "ai_service.py"))
    tree = ast.parse(src)
    fn = None
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "_format_test_answers":
            fn = node
    assert fn is not None, "выжимка ответов для промпта не найдена"
    ns = {}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), "<fn>", "exec"), ns)
    fmt = ns["_format_test_answers"]

    answers = [{"question": f"Вопрос {n}", "answer": f"Ответ {n}"} for n in range(40)]
    block = fmt(answers)
    assert "ЕГО СОБСТВЕННЫЕ ОТВЕТЫ" in block
    lines = [ln for ln in block.splitlines() if ln.startswith("—")]
    assert len(lines) <= 18, "в промпт кладём выжимку, а не все сорок"
    assert len(lines) >= 10
    assert fmt(None) == ""
    assert fmt([]) == ""
    assert fmt([{"question": "", "answer": ""}]) == ""

    main = _src("main.py")
    j = main.index("full_profile = {")
    assert "'all_answers': results.get('all_answers')" in main[j:j + 1200]


def test_pdf_lays_out_headings_and_prices():
    """Иначе разбор падает в письмо одним сплошным абзацем."""
    pdf_src = _src("test_pdf.py")
    assert "_render_ai_text" in pdf_src
    i = pdf_src.index("def _render_ai_text")
    body = pdf_src[i:i + 2200]
    assert "Цена" in body, "подзаголовки цен должны выделяться"
    assert "isupper" in body, "заголовки разделов должны распознаваться"


def test_pdf_builds_with_the_new_shape():
    pytest.importorskip("fpdf")
    import test_pdf

    ai = ("🪞 ЭТО ПРО ТЕБЯ, ЕСЛИ\n\n• Ты молчишь и досадуешь.\n\n"
          "⚠️ ЧЕМ ЭТО ОБХОДИТСЯ\n\nЦена 1. Время\nВечер уходит на переигрывание.\n")
    data = test_pdf.generate_test_pdf_bytes(
        {"profile_data": {"display_name": "СБ-4", "archetype": "Защитник позиций"},
         "behavioral_levels": {"СБ": [4], "ТФ": [4], "УБ": [4], "ЧВ": [4]},
         "deep_patterns": {"attachment": "Тревожный"},
         "ai_generated_profile": ai})
    assert data and data[:4] == b"%PDF"
