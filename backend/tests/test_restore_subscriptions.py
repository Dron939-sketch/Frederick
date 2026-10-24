"""Подписки собираются заново из платежей кассы после потери базы (24.10.2026).

База Фреди слетела вместе с подписками. В ЮKassa каждый платёж подписки
лежит с user_id, типом и тарифом в metadata — по ним plan_restore считает,
какие подписки должны быть в базе. Срок — от дат оплат, а не от сегодня.
"""

import asyncio
import sys
import pathlib
import types
from datetime import datetime, timedelta, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import payment as pay  # noqa: E402

NOW = datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc)


def _p(pid, uid, kind, plan, when, amount, saved=False):
    return {"id": pid, "status": "succeeded", "captured_at": when,
            "amount": {"value": amount, "currency": "RUB"},
            "metadata": {"user_id": str(uid), "type": kind, "plan": plan},
            "payment_method": {"id": "pm_" + pid, "saved": saved, "card": {"last4": "4242", "card_type": "Visa"}}}


def test_monthly_counts_from_payment_date_not_today():
    plan = pay.plan_restore([_p("a", 1761213000000, "subscription_first", "monthly",
                                "2026-10-23T10:51:00.000Z", "690.00", saved=True)], NOW)
    s = plan["subscriptions"][0]
    assert s["user_id"] == 1761213000000
    assert s["expires_at"] == datetime(2026, 11, 22, 10, 51, tzinfo=timezone.utc)
    assert s["active"] and s["card"]["payment_method_id"] == "pm_a"


def test_renewal_extends_from_end_of_previous_period():
    plan = pay.plan_restore([
        _p("r", 7, "subscription_recurring", "monthly", "2026-10-01T09:00:00.000Z", "690.00"),
        _p("f", 7, "subscription_first", "monthly", "2026-09-02T09:00:00.000Z", "690.00", saved=True),
    ], NOW)
    s = plan["subscriptions"][0]
    # 02.09 + 30 = 02.10; продление 01.10 добавляет 30 дней к 02.10
    assert s["expires_at"] == datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
    assert s["started_at"] == datetime(2026, 9, 2, 9, 0, tzinfo=timezone.utc)
    assert len(s["payments"]) == 2 and s["total"] == 1380.0


def test_lapsed_trial_is_inactive_unless_downtime_is_added():
    pays = [_p("t", 9, "subscription_first", "trial_week", "2026-10-20T08:00:00.000Z", "69.00")]
    assert pay.plan_restore(pays, NOW)["subscriptions"][0]["active"] is False
    s = pay.plan_restore(pays, NOW, extend_days=2)["subscriptions"][0]
    assert s["active"] and s["expires_at"] == datetime(2026, 10, 25, 8, 0, tzinfo=timezone.utc)


def test_tokens_listed_and_orders_skipped():
    plan = pay.plan_restore([
        _p("k", 5, "tokens", "pack_s", "2026-10-10T08:00:00.000Z", "69.00"),
        {"id": "o", "metadata": {"type": "shop_order", "order_id": "12"}, "amount": {"value": "5900.00"}},
        {"id": "x", "metadata": {"user_id": "temp_123", "type": "subscription_first"}},
    ], NOW)
    assert plan["subscriptions"] == []
    assert [t["yookassa_id"] for t in plan["tokens"]] == ["k"]
    assert plan["skipped"] == 2


def test_list_succeeded_payments_follows_cursor(monkeypatch):
    pages = [{"items": [{"id": "1"}], "next_cursor": "c2"}, {"items": [{"id": "2"}]}]
    seen = []

    class _Resp:
        status_code = 200
        text = ""

        def __init__(self, data):
            self._d = data

        def json(self):
            return self._d

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, params=None, headers=None):
            seen.append(dict(params))
            return _Resp(pages[len(seen) - 1])

    monkeypatch.setattr(pay, "yookassa_client", lambda read=30: _Client())
    svc = pay.PaymentService.__new__(pay.PaymentService)
    svc.shop_id, svc.secret_key = "s", "k"
    out = asyncio.run(svc.list_succeeded_payments(datetime(2026, 8, 1, tzinfo=timezone.utc)))
    assert [p["id"] for p in out] == ["1", "2"]
    assert seen[0]["status"] == "succeeded" and seen[0]["created_at.gte"] == "2026-08-01T00:00:00.000Z"
    assert seen[1]["cursor"] == "c2"
