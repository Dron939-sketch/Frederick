# -*- coding: utf-8 -*-
"""Письмо записавшимся на курс из «Скоро», когда курс вышел.

Курс и первая лекция берутся из каталога Лектория; письмо в голосе сайта,
без цен и обещаний; одно на заявку — повтор отсекается по notified_at.
"""
import os
import re
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import waitlist_notify as wn  # noqa: E402


def test_course_from_catalog():
    c = wn.course_info("delo-zhizni")
    assert c and c["title"] == "Дело жизни" and len(c["lectures"]) == 10
    assert wn.course_info("net-takogo-kursa") is None


def test_letter_voice_and_links():
    c = wn.course_info("delo-zhizni")
    m = wn.letter(c, "Валерия", datetime(2026, 9, 16, 20, 6))
    assert m["subject"] == "Курс «Дело жизни» готов — вы на него записывались"
    assert m["plain"].startswith("Валерия, здравствуйте.")
    assert "16 сентября вы оставили заявку" in m["plain"]
    assert "10 лекций" in m["plain"]
    assert "https://meysternlp.ru/blog/lektorij/delo-zhizni/" in m["plain"]
    assert "https://meysternlp.ru/blog/lekciya-delo-zhizni-1-" in m["plain"]
    assert "from=lektorij-delo-zhizni" in m["plain"]
    assert "Больше писем по этой заявке не будет" in m["plain"]
    for bad in ("₽", "руб", "!", "изменить жизнь", "дорог", "в современном мире"):
        assert bad not in m["plain"], bad
    assert not re.search(r"[А-Яа-яЁё][A-Za-z]|[A-Za-z][А-Яа-яЁё]", m["plain"]), "смешение алфавитов"
    assert m["html"].count("<a href=") >= 3
    # без имени — нейтральное приветствие, без даты — «недавно»
    m2 = wn.letter(c, "", None)
    assert m2["plain"].startswith("Здравствуйте.") and "недавно вы оставили" in m2["plain"]


def test_candidates_sql_is_one_shot():
    assert "notified_at IS NULL" in wn.CANDIDATES_SQL
    assert "ADD COLUMN IF NOT EXISTS notified_at" in wn.MIGRATION_SQL
    src = open(os.path.join(os.path.dirname(__file__), "..", "waitlist_notify.py"), encoding="utf-8").read()
    assert "SET notified_at = NOW()" in src
