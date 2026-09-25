# -*- coding: utf-8 -*-
"""Напоминания без почты: d1 / d3 / d7 по push и в мессенджер, догон
через час после SOS.

Проверяются чистые части: окно отправки по Москве, тема из реплики,
тексты каждой кампании (разные, не «как прошло?» три раза), ссылки
возврата с метками и то, что запросы кандидатов держат все ограничения —
каждое закрывает конкретную ошибку: двойное напоминание, письмо и push
в один день, ночной push, два напоминания подряд из разных кампаний.
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services import return_nudge as rn  # noqa: E402


def _utc(h):
    return datetime(2026, 9, 25, h, 30, tzinfo=timezone.utc)


def test_send_window_is_daytime_moscow():
    assert rn.in_send_window(_utc(7))
    assert not rn.in_send_window(_utc(6))
    assert rn.in_send_window(_utc(17))
    assert not rn.in_send_window(_utc(18))
    assert not rn.in_send_window(_utc(23))
    assert not rn.in_send_window(_utc(1))


def test_topic_is_one_short_line_cut_on_a_word():
    assert rn.topic_short("  муж   опять\nне слушает ") == "муж опять не слушает"
    long = "я не знаю как сказать начальнику что больше не могу брать на себя чужую работу и молчать"
    t = rn.topic_short(long, limit=40)
    assert t.endswith("…") and len(t) <= 42
    assert " " not in t[-2:]
    assert rn.topic_short("") == ""


def test_campaign_windows_do_not_overlap():
    spans = sorted(rn.CAMPAIGNS.values())
    assert spans[0] == (20, 40)
    for (a1, b1), (a2, b2) in zip(spans, spans[1:]):
        assert b1 < a2, "окна кампаний пересекаются — два напоминания в один день"
    assert rn.CAMPAIGN == "d1_push"


def test_each_campaign_has_its_own_text():
    texts = {c: rn.push_body("Аня", "муж не слушает", c) for c in list(rn.CAMPAIGNS) + [rn.SOS_CAMPAIGN]}
    assert len(set(texts.values())) == 4, "тексты кампаний должны различаться"
    assert texts["d1_push"] == "Аня, вчера вы остановились на «муж не слушает». Продолжим с того же места?"
    assert "три дня назад" in texts["d3_push"] and "упражнение" in texts["d3_push"]
    assert "неделю назад" in texts["d7_push"] and "в силе" in texts["d7_push"]
    assert "112" in texts[rn.SOS_CAMPAIGN] and "Как вы сейчас" in texts[rn.SOS_CAMPAIGN]
    # Без имени и темы тоже читается.
    assert rn.push_body("", "") == "вчера мы не договорили. Продолжим с того же места?"
    assert rn.push_body("", "", "d7_push").startswith("прошла неделя")
    for t in texts.values():
        assert "!" not in t and len(t) <= 200


def test_return_link_carries_ref_and_utm_per_campaign():
    link = rn.return_link("tok123")
    assert link.startswith(rn.APP_BASE_URL + "?")
    for part in ("ref=push-d1", "cid=tok123", "utm_source=fredi_push",
                 "utm_medium=push", "utm_campaign=d1_push"):
        assert part in link
    assert "ref=push-d3" in rn.return_link("t", "d3_push") and "utm_campaign=d3_push" in rn.return_link("t", "d3_push")
    assert "ref=push-d7" in rn.return_link("t", "d7_push")
    assert "ref=push-sos" in rn.return_link("t", rn.SOS_CAMPAIGN)


def test_messenger_text_has_link_and_stop_word():
    for c in list(rn.CAMPAIGNS) + [rn.SOS_CAMPAIGN]:
        t = rn.messenger_text("Пётр", "работа", "https://x/y", c)
        assert "https://x/y" in t and "стоп" in t and "Пётр" in t, c


def test_candidates_sql_keeps_every_guard():
    sql = rn.CANDIDATES_SQL
    assert "u.email IS NULL" in sql, "у кого есть почта — письмо, а не второе напоминание"
    assert "($2 || ' hours')::interval" in sql and "($3 || ' hours')::interval" in sql, "окно — параметр кампании"
    assert "last_morning_sent_at" in sql, "утреннее сообщение уже было — не дублировать"
    assert "fredi_push_subscriptions" in sql and "fredi_messenger_links" in sql, "канал должен быть"
    assert "l.campaign = $1" in sql, "дедуп по кампании"
    assert "opted_out_at IS NOT NULL" in sql, "отписка глушит и push"
    assert "m.role = 'user'" in sql, "напоминаем тому, кто сам писал, а не открыл и ушёл"


def test_sos_candidates_sql_guards():
    sql = rn.SOS_CANDIDATES_SQL
    assert "a.data->>'feature' = 'sos'" in sql and "feature_opened" in sql
    assert "INTERVAL '60 minutes'" in sql and "INTERVAL '180 minutes'" in sql, "час-три после SOS"
    assert "l.campaign = $1" in sql and "opted_out_at IS NOT NULL" in sql
    assert "fredi_push_subscriptions" in sql and "fredi_messenger_links" in sql
    assert "u.email" not in sql, "после SOS догоняем и тех, у кого есть почта: письма такого нет"


def test_scan_sends_sos_outside_window_and_others_inside():
    import inspect
    body = inspect.getsource(rn.scan_and_send)
    i_sos = body.index("SOS_CANDIDATES_SQL")
    i_win = body.index("in_send_window(now)")
    assert i_sos < i_win, "догон после SOS идёт до проверки дневного окна"
    assert "for campaign, (h_from, h_to) in CAMPAIGNS.items()" in body


def test_scheduler_passes_push_service_and_calls_nudge():
    src = open(os.path.join(os.path.dirname(__file__), "..", "services", "reengagement.py"),
               encoding="utf-8").read()
    assert "push_service_getter" in src
    assert "return_nudge import scan_and_send" in src
    main = open(os.path.join(os.path.dirname(__file__), "..", "main.py"), encoding="utf-8").read()
    assert "reengagement_scheduler(db, lambda: email_service, lambda: push_service)" in main
