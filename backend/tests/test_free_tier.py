# -*- coding: utf-8 -*-
"""Бесплатная версия без аккаунта не помнит вчерашнего — и это правда.

Владелец, 13.09.2026: после второго-третьего сообщения человеку говорят,
что он в бесплатной версии, диалог не сохраняется и завтра всё сначала.
Значит, у анонима в промпт идёт только текущий разговор и не идёт память
прошлых сессий. Плюс опрос «что остановило» в письме третьего дня.

Запуск: python3 backend/tests/test_free_tier.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import free_tier as ft  # noqa: E402

NOW = datetime(2026, 9, 13, 12, 0, tzinfo=timezone.utc)


def _row(minutes_ago, role="user"):
    return {"role": role, "content": "x",
            "created_at": (NOW - timedelta(minutes=minutes_ago)).isoformat()}


def test_anonymous_gets_only_current_conversation():
    hist = [_row(60 * 26), _row(60 * 25, "assistant"), _row(30), _row(5, "assistant")]
    out = ft.session_history(hist, registered=False, now=NOW)
    assert out == hist[2:], out


def test_registered_keeps_everything():
    hist = [_row(60 * 26), _row(30)]
    assert ft.session_history(hist, registered=True, now=NOW) == hist


def test_anonymous_row_without_time_is_dropped():
    hist = [{"role": "user", "content": "вчера"}, _row(3)]
    assert ft.session_history(hist, registered=False, now=NOW) == [hist[1]]


def test_why_not_links_carry_reason_codes():
    link = "https://meysternlp.ru/fredi/?ref=reeng&cid=t1&utm_source=fredi_mail"
    text = ft.why_not_block(link)
    html = ft.why_not_html(link)
    for code, label in ft.WHY_NOT_REASONS:
        assert f"&why={code}" in text and label in text
        assert f"&why={code}" in html and label in html
    assert text.count("why=") == 4
    assert ft.why_not_block("https://x/app").count("?why=") == 4


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
