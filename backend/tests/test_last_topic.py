# -*- coding: utf-8 -*-
"""Тема последнего разговора для строки возврата в шапке.

Шапка приложения встречала вернувшегося тем же «Я Фреди — ваш виртуальный
психолог», что и человека, зашедшего впервые. А вернувшийся ценнее:
15.09.2026 в приложении 50 новых и 16 вернувшихся, но новые сидели 349
секунд, а вернувшиеся — 935. Возвращает в разговор не приветствие, а
собственная незакрытая тема, и её отдаёт /api/chat/last-topic.

Импортировать main.py нельзя (БД, Redis, ключи), поэтому функция
достаётся разбором исходника — как в соседних тестах.
"""
import os

import pytest

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "main.py"))


def _load():
    src = open(_SRC, encoding="utf-8").read()
    i = src.index("_TOPIC_GAP_SECONDS")
    j = src.index('@app.get("/api/chat/last-topic/{user_id}")')
    ns = {}
    exec(compile(src[i:j], "<last_topic>", "exec"), ns)
    return ns["_last_topic"], ns["_TOPIC_MAX_CHARS"]


@pytest.fixture(scope="module")
def topic():
    fn, _ = _load()
    return fn


def _m(role, text, ts):
    return {"role": role, "content": text, "created_at": ts}


def test_empty_history_gives_nothing(topic):
    """Разговоров не было — шапка покажет приглашение, а не пустую строку."""
    assert topic([]) == {}
    assert topic(None) == {}


def test_takes_first_user_line_of_last_session(topic):
    """Тема — то, с чем человек пришёл, а не чем закончил.

    Последняя реплика почти всегда «спасибо» или «понятно»: она называет
    вежливость, а не тему.
    """
    out = topic([
        _m("user", "давно не могу уснуть", "2026-09-10T20:00:00+00:00"),
        _m("assistant", "…", "2026-09-10T20:01:00+00:00"),
        _m("user", "почему меня задевает её молчание", "2026-09-14T21:00:00+00:00"),
        _m("assistant", "…", "2026-09-14T21:01:00+00:00"),
        _m("user", "спасибо", "2026-09-14T21:20:00+00:00"),
    ])
    assert out["topic"] == "почему меня задевает её молчание"
    assert out["messages"] == 3


def test_pause_longer_than_two_hours_starts_a_new_talk(topic):
    """Четырёхдневная пауза — это другой заход, и тема у него своя."""
    out = topic([
        _m("user", "старая тема", "2026-09-10T20:00:00+00:00"),
        _m("user", "новая тема", "2026-09-14T21:00:00+00:00"),
    ])
    assert out["topic"] == "новая тема"


def test_long_topic_is_cut_by_word(topic):
    """Обрыв посреди слова читается как поломка, а не как сокращение."""
    long_line = ("почему меня так задевает её молчание, я же понимаю, что она "
                 "устала и дело совершенно не во мне")
    out = topic([_m("user", long_line, "2026-09-14T21:00:00+00:00")])
    t = out["topic"]
    assert t.endswith("…")
    assert len(t) <= 62
    assert not t[:-1].endswith(" "), "перед многоточием не должно быть пробела"
    assert long_line.startswith(t[:-1].rstrip("…").rstrip()), "начало темы не должно искажаться"


def test_assistant_only_session_has_no_topic(topic):
    """Если человек не сказал ничего, возвращать в шапку нечего."""
    assert topic([_m("assistant", "Я Фреди…", "2026-09-14T21:00:00+00:00")]) == {}


def test_broken_timestamps_do_not_crash(topic):
    """Кривая дата не должна ронять шапку — она просто теряет «дней назад»."""
    out = topic([
        _m("user", "первая", "не дата"),
        _m("user", "вторая", None),
    ])
    assert out["topic"] in ("первая", "вторая")
    assert out["days_ago"] is None
