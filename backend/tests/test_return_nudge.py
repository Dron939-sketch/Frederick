# -*- coding: utf-8 -*-
"""«Напомнить завтра, на чём остановились» — push и мессенджер для тех,
у кого нет почты.

Проверяются чистые части: окно отправки по Москве, тема из реплики,
тексты, ссылка возврата с метками и то, что запрос кандидатов держит
все свои ограничения — каждое из них закрывает конкретную ошибку:
двойное напоминание, письмо и push в один день, ночной push.
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services import return_nudge as rn  # noqa: E402


def _utc(h):
    return datetime(2026, 9, 25, h, 30, tzinfo=timezone.utc)


def test_send_window_is_daytime_moscow():
    # 07:30 UTC = 10:30 МСК — открыто; 06:30 UTC = 09:30 — ещё нет.
    assert rn.in_send_window(_utc(7))
    assert not rn.in_send_window(_utc(6))
    # 17:30 UTC = 20:30 МСК — последний час; 18:30 UTC = 21:30 — закрыто.
    assert rn.in_send_window(_utc(17))
    assert not rn.in_send_window(_utc(18))
    # Ночь по Москве.
    assert not rn.in_send_window(_utc(23))
    assert not rn.in_send_window(_utc(1))


def test_topic_is_one_short_line_cut_on_a_word():
    assert rn.topic_short("  муж   опять\nне слушает ") == "муж опять не слушает"
    long = "я не знаю как сказать начальнику что больше не могу брать на себя чужую работу и молчать"
    t = rn.topic_short(long, limit=40)
    assert t.endswith("…") and len(t) <= 42
    assert " " not in t[-2:]  # обрезано по слову, не посреди
    assert rn.topic_short("") == ""


def test_push_body_with_and_without_topic_and_name():
    assert rn.push_body("Аня", "муж не слушает") == \
        "Аня, вчера вы остановились на «муж не слушает». Продолжим с того же места?"
    assert rn.push_body("", "") == "вчера мы не договорили. Продолжим с того же места?"


def test_return_link_carries_ref_and_utm():
    link = rn.return_link("tok123")
    assert link.startswith(rn.APP_BASE_URL + "?")
    for part in ("ref=push-d1", "cid=tok123", "utm_source=fredi_push",
                 "utm_medium=push", "utm_campaign=d1_push"):
        assert part in link


def test_messenger_text_has_link_and_stop_word():
    t = rn.messenger_text("Пётр", "работа", "https://x/y")
    assert "https://x/y" in t and "стоп" in t and "Пётр" in t


def test_candidates_sql_keeps_every_guard():
    sql = rn.CANDIDATES_SQL
    assert "u.email IS NULL" in sql, "у кого есть почта — письмо d1, а не второе напоминание"
    assert "INTERVAL '20 hours'" in sql and "INTERVAL '40 hours'" in sql, "ровно вчера"
    assert "last_morning_sent_at" in sql, "утреннее сообщение уже было — не дублировать"
    assert "fredi_push_subscriptions" in sql and "fredi_messenger_links" in sql, "канал должен быть"
    assert "l.campaign = $1" in sql, "дедуп по кампании"
    assert "opted_out_at IS NOT NULL" in sql, "отписка глушит и push"
    assert "m.role = 'user'" in sql, "напоминаем тому, кто сам писал, а не открыл и ушёл"


def test_scheduler_passes_push_service_and_calls_nudge():
    src = open(os.path.join(os.path.dirname(__file__), "..", "services", "reengagement.py"),
               encoding="utf-8").read()
    assert "push_service_getter" in src
    assert "return_nudge import scan_and_send" in src
    main = open(os.path.join(os.path.dirname(__file__), "..", "main.py"), encoding="utf-8").read()
    assert "reengagement_scheduler(db, lambda: email_service, lambda: push_service)" in main
