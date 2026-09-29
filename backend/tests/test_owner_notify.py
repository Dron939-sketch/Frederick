# -*- coding: utf-8 -*-
"""Оплата → сообщение владельцу в MAX (29.09.2026, просьба владельца)."""
import asyncio
import pathlib
import sys
import types
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import owner_notify as on  # noqa: E402


def test_bind_needs_admin_token(monkeypatch):
    monkeypatch.delenv("ADMIN_TOKEN", raising=False)
    assert on.bind_code() == "" and on.bind_link() == ""
    assert on.is_bind_payload("owner_") is False


def test_bind_payload_matches_only_own_code(monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret-a")
    link = on.bind_link()
    assert link.startswith("https://max.ru/id502238728185_1_bot?start=owner_")
    payload = link.split("start=", 1)[1]
    assert on.is_bind_payload(payload)
    assert not on.is_bind_payload("owner_0000000000000000")
    assert not on.is_bind_payload("web_123")
    # код не совпадает с самим токеном и меняется вместе с ним
    assert "secret-a" not in link
    monkeypatch.setenv("ADMIN_TOKEN", "secret-b")
    assert not on.is_bind_payload(payload)


def test_payment_text():
    now = datetime(2026, 9, 29, 14, 40, tzinfo=timezone.utc)
    t = on.payment_text("trial_week", 69.0, False, 1790584603291629,
                        "без аккаунта, первое сообщение вчера (28.09)", now=now)
    assert t.splitlines()[0] == "Оплата 69 ₽ — проба на 3 дня, новая оплата"
    assert "29.09 17:40 МСК, человек …1629" in t
    assert "без аккаунта" in t
    r = on.payment_text("monthly", "690.00", True, 42, now=now)
    assert r.startswith("Оплата 690 ₽ — месяц, продление")
    assert on.payment_text("quarter", 1490, False, 42, now=now).startswith("Оплата 1490 ₽ — три месяца")


class _Conn:
    def __init__(self, store):
        self.store = store

    async def execute(self, sql, *a):
        if sql.lstrip().startswith("INSERT INTO fredi_owner_chats"):
            self.store[(a[0], a[1])] = {"platform": a[0], "chat_id": a[1], "name": a[2],
                                        "bound_at": datetime.now(timezone.utc)}

    async def fetch(self, sql, *a):
        return list(self.store.values())

    async def fetchrow(self, sql, *a):
        return {"acc": False, "turns": 12,
                "first_seen": datetime.now(timezone.utc) - timedelta(days=1)}


class _Ctx:
    def __init__(self, c):
        self.c = c

    async def __aenter__(self):
        return self.c

    async def __aexit__(self, *a):
        return False


class _DB:
    def __init__(self):
        self.store = {}

    def get_connection(self):
        return _Ctx(_Conn(self.store))


def test_bound_chat_gets_payment(monkeypatch):
    sent = []

    async def fake_send(chat_id, text):
        sent.append((chat_id, text))
        return True

    fake = types.ModuleType("services.subscription_notify")
    fake._send_max = fake_send
    monkeypatch.setitem(sys.modules, "services.subscription_notify", fake)
    db = _DB()
    # чата нет — никому не ушло, и оплата не падает
    assert asyncio.run(on.notify_payment(db, 1629, "trial_week", 69.0, False)) == 0
    asyncio.run(on.bind_chat(db, "max", "777", "владелец"))
    assert asyncio.run(on.notify_payment(db, 1629, "trial_week", 69.0, False)) == 1
    chat, text = sent[-1]
    assert chat == "777"
    assert "Оплата 69 ₽" in text and "реплик в разговорах 12" in text


def test_wired_into_payment_bot_and_startup():
    pay = (ROOT / "payment.py").read_text(encoding="utf-8")
    assert pay.count("from owner_notify import notify_payment") == 2
    bot = (ROOT / "services" / "bot_service.py").read_text(encoding="utf-8")
    assert bot.count("is_bind_payload(payload)") == 2
    main = (ROOT / "main.py").read_text(encoding="utf-8")
    assert "register_owner_notify_routes(app, db)" in main
