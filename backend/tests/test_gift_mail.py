# -*- coding: utf-8 -*-
"""Подарок подписчикам — сборники «Три пути» письмом (25.09.2026).

Проверяется то, что ломается молча: письмо без вложений, второе письмо
тому же человеку, рассылка не подписчикам, автозапуск без руки владельца.
"""
import os
import pathlib
import re
import sys

BACKEND = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import gift_mail as gm  # noqa: E402

MAIN = (BACKEND / "main.py").read_text(encoding="utf-8")


def test_both_booklets_exist_and_are_pdf():
    atts = gm.load_attachments()
    assert [a[0] for a in atts] == [n for n, _ in gm.ATTACHMENTS]
    assert len(atts) == 3, "три сборника: курсант, курсантка и курсант 30+"
    for name, payload, subtype in atts:
        assert payload[:5] == b"%PDF-", f"{name}: не PDF"
        assert subtype == "pdf"
        assert 500_000 < len(payload) < 5_000_000, f"{name}: странный размер {len(payload)}"
    assert "курсант" in atts[0][0] and "курсантка" in atts[1][0]


def test_letter_text_is_in_house_voice():
    text = gm.plain_text("Анна")
    assert text.startswith("Анна, здравствуйте.")
    assert gm.plain_text("").startswith("Здравствуйте.")
    for bad in ("изменить жизнь", "дорогие", "ни для кого не секрет", "!!", "**", "<b>"):
        assert bad not in text, f"в письме: {bad!r}"
    assert "три обходных" in text and "инструктор" in text.lower()
    assert "курсанта" in text and "курсантки" in text
    assert gm.LINK_GAME in text and gm.LINK_LECTURE in text
    assert "[game]" not in text


def test_html_escapes_and_keeps_bold_and_links():
    h = gm.html_body("Иван")
    assert "<b>Какой навык это ставит.</b>" in h
    assert f'href="{gm.LINK_GAME}"' in h and f'href="{gm.LINK_LECTURE}"' in h
    assert "[game]" not in h and "&lt;b&gt;" not in h
    # Ёлочки и тире не должны превратиться в сущности так, чтобы сломать чтение.
    assert "«Три пути»" in h


def test_recipients_are_active_subscribers_with_email_and_consent():
    sql = gm.RECIPIENTS_SQL
    assert "s.status = 'active'" in sql and "s.expires_at > NOW()" in sql
    assert "u.email IS NOT NULL" in sql
    assert "email_opted_in" in sql, "отказавшимся от писем не шлём"
    assert "fredi_mail_campaign_log" in sql and "NOT EXISTS" in sql, "второй раз тому же — нельзя"


def test_log_row_claimed_before_sending():
    import inspect
    body = inspect.getsource(gm.send_to_all)
    i = body.index("INSERT INTO fredi_mail_campaign_log")
    j = body.index("email_service.send(")
    assert i < j, "строка лога должна ставиться ДО отправки — иначе повтор при сбое"
    assert "ON CONFLICT DO NOTHING RETURNING" in body
    assert "attachments=attachments" in body, "письмо уходит с вложениями"


def test_routes_are_admin_only_and_manual():
    import inspect
    body = inspect.getsource(gm.register_gift_mail_routes)
    assert body.count("_check_admin(x_admin_token)") == 2
    assert '@app.get("/api/analytics/gift/tri-puti")' in body
    assert '@app.post("/api/analytics/gift/tri-puti")' in body
    assert "test_to" in body, "пробное письмо себе до рассылки"
    # Никакого планировщика: только ручной запуск.
    src = (BACKEND / "gift_mail.py").read_text(encoding="utf-8")
    assert "asyncio.create_task" not in src and "scheduler" not in src.lower()


def test_wired_in_main():
    assert "register_gift_mail_routes(app, db, lambda: email_service)" in MAIN
