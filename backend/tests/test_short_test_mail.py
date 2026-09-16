# -*- coding: utf-8 -*-
"""Короткие тесты сайта тоже собирают почту.

16.09.2026. За неделю PHQ-9, GAD-7, ревность и «умение любить» дали 84
прохождения против 52 стартов большого теста — вдвое больше людей, и ни
одного адреса: позвать их обратно было нечем.

Главное, что здесь проверяется, — письмо собирается на сервере из своего
каталога, а не приходит готовым со страницы. Ручка, принимающая чужой
текст и рассылающая его нашим именем, — открытый ретранслятор, и это
куда дороже, чем пропущенная почта.

main.py импортировать нельзя (БД, Redis, ключи), поэтому эндпоинт
проверяется разбором исходника — как в соседних тестах.
"""
import ast
import os
import sys

import pytest

_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

import short_test_mail as stm  # noqa: E402


def _src(name):
    return open(os.path.join(_BACKEND, name), encoding="utf-8").read()


def test_every_band_builds_a_letter():
    """Полоса без письма — это человек, оставивший адрес зря."""
    n = 0
    for key, test in stm.TESTS.items():
        for band in test["bands"]:
            score = 5 if test.get("max") else None
            subject, text, html = stm.build_letter(key, band, score)
            assert subject and text and html
            assert test["bands"][band]["name"] in text
            assert "meysternlp.ru/fredi" in text, (key, band)
            assert stm.build_followup(key, band)[1], (key, band)
            n += 1
    assert n >= 19


def test_letter_text_comes_from_our_catalogue_only():
    """Тело запроса несёт ключи, а не готовый текст."""
    tree = ast.parse(_src("main.py"))
    model = None
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "ShortTestMailIn":
            model = node
    assert model is not None, "модель запроса ShortTestMailIn не найдена"
    fields = {t.target.id for t in model.body if isinstance(t, ast.AnnAssign)}
    assert fields == {"test", "band", "score", "email"}, fields
    for forbidden in ("text", "html", "body", "subject", "message"):
        assert forbidden not in fields, f"через ручку можно прислать свой {forbidden}"


def test_unknown_test_or_band_is_refused():
    assert stm.valid("phq9", "moderate", 12)
    assert not stm.valid("phq9", "нет-такой-полосы", 1)
    assert not stm.valid("чужой-тест", "moderate", 1)
    # Балл вне шкалы — признак подделки, а не опечатки.
    assert not stm.valid("phq9", "moderate", 999)
    assert not stm.valid("gad7", "min", -1)


def test_clinical_bands_never_sell_a_course():
    """С порога очной оценки продукт не встаёт вперёд врача.

    Человек в таком состоянии берёт первое, что предложили, и
    откладывает визит. На клинических полосах остаётся только протокол
    стабилизации — «продержаться до приёма, а не вместо него».
    """
    for key, test in stm.TESTS.items():
        for band, b in test["bands"].items():
            if not b.get("clinical"):
                continue
            urls = [r["url"] for r in b["recs"]]
            assert all("lektorij" not in u or key == "revnost" for u in urls), (key, band)
            assert any("m=sos" in u for u in urls), (key, band, "нет протокола на острый момент")


def test_letter_carries_a_way_back_and_a_way_out():
    """Дверь к Фреди — и отписка: письмо, от которого нельзя отписаться, спам."""
    subject, text, html = stm.build_letter("gad7", "light", 7, "https://x/api/reengagement/optout?t=abc")
    assert "?ask=" in text, "Фреди должен уже знать результат"
    assert "отписаться" in html and "https://x/api/reengagement/optout?t=abc" in html
    # Без ссылки отписки блок не рисуется пустым.
    assert "отписаться" not in stm.build_letter("gad7", "light", 7)[2]


def test_lead_is_saved_apart_from_accounts():
    """Адрес без пароля в fredi_users закрыл бы человеку регистрацию его же почтой."""
    src = _src("main.py")
    assert "fredi_test_leads" in src
    i = src.index("async def email_short_test")
    body = src[i:i + 4000]
    assert "INSERT INTO fredi_test_leads" in body
    assert "UPDATE fredi_users" not in body, "адрес с теста не должен трогать аккаунты"


def test_day3_letter_skips_those_who_made_an_account():
    """Иначе человек получит два письма за день — наше и обычное d3."""
    src = _src(os.path.join("services", "reengagement.py"))
    i = src.index("async def _scan_and_send_test_leads")
    body = src[i:i + 3000]
    assert "fredi_test_leads" in body
    assert "FROM fredi_users u" in body and "NOT EXISTS" in body
    assert "opted_out_at IS NULL" in body
    assert "_scan_and_send_test_leads(db, es)" in src, "проход не включён в шедулер"


def test_optout_covers_people_without_an_account():
    """У этих людей нет user_id — отписка обязана работать всё равно."""
    src = _src("reengagement_routes.py")
    assert "fredi_test_leads" in src
    i = src.index("async def optout")
    body = src[i:i + 2500]
    assert "opted_out_at = NOW()" in body
    assert "WHERE email = $1" in body, "отписка должна гасить все записи адреса"
