# -*- coding: utf-8 -*-
"""Аноним с идущим планом «Семь дней по теме» получает минуты на шаг дня.

29.09.2026: человек на втором дне плана, не потративший ни минуты,
встретил стену с порога (FREE_DAILY_MINUTES_ANON = 0) и четыре раза
перезагрузил страницу. План зовёт вернуться — сервер не пускал.
"""
import asyncio
import pathlib
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import subscription_meter as sm  # noqa: E402


class _Conn:
    def __init__(self, row=None, exc=None):
        self.row, self.exc = row, exc

    async def fetchrow(self, *a, **k):
        if self.exc:
            raise self.exc
        return self.row


class _Ctx:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *a):
        return False


class _DB:
    def __init__(self, conn):
        self.conn = conn

    def get_connection(self):
        return _Ctx(self.conn)


NOW = datetime(2026, 9, 29, 7, 40, tzinfo=timezone.utc)


def _meter(row=None, exc=None):
    return sm.SubscriptionMeter(_DB(_Conn(row, exc)))


def _active(row=None, exc=None):
    return asyncio.run(_meter(row, exc)._has_active_week_plan(1, NOW))


def test_anon_second_day_without_plan_stays_zero():
    st = _meter()._compose_status(used_seconds=0, free_days_used=1,
                                  total_seconds=1200, registered=False)
    assert st["limit_minutes"] == sm.FREE_DAILY_MINUTES_ANON == 0
    assert st["can_send"] is False


def test_anon_second_day_with_plan_gets_minutes():
    st = _meter()._compose_status(used_seconds=0, free_days_used=1,
                                  total_seconds=1200, registered=False,
                                  week_plan=True)
    assert st["limit_minutes"] == sm.WEEK_PLAN_DAILY_MINUTES > 0
    assert st["can_send"] is True


def test_plan_does_not_cut_first_day():
    st = _meter()._compose_status(used_seconds=60, free_days_used=0,
                                  total_seconds=60, registered=False,
                                  week_plan=True)
    assert st["limit_minutes"] == sm.FIRST_CONVERSATION_MINUTES


def test_plan_spent_minutes_block_again():
    st = _meter()._compose_status(used_seconds=sm.WEEK_PLAN_DAILY_MINUTES * 60,
                                  free_days_used=1, total_seconds=3000,
                                  registered=False, week_plan=True)
    assert st["can_send"] is False


def test_active_plan_detection():
    started = NOW - timedelta(days=1)
    assert _active({"kind": "week_topic", "started_at": started, "done": 1}) is True
    # 21-дневный навык — не этот план
    assert _active({"kind": None, "started_at": started, "done": 1}) is False
    # старше семи суток
    assert _active({"kind": "week_topic", "started_at": NOW - timedelta(days=8), "done": 3}) is False
    # выполнен целиком
    assert _active({"kind": "week_topic", "started_at": started, "done": 7}) is False
    # нет строки / нет таблицы — плана нет, счётчик не падает
    assert _active(None) is False
    assert _active(exc=RuntimeError("relation does not exist")) is False
