# -*- coding: utf-8 -*-
"""Сводка задержки первого слова: арифметика без БД.

25.09.2026. Тайминги хода писались в fredi_events с мая, но наружу их
никто не отдавал. Проверяется, что сводка считает медианы по отсечкам,
терпит строки-JSON и значения-строки (asyncpg отдаёт jsonb как текст),
пропускает ходы без first_delta_ms и поднимает флаг, когда медиана выше
порога при достаточном числе ходов.
"""
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import latency_stats as ls  # noqa: E402

BACKEND = os.path.join(os.path.dirname(__file__), "..")


def _row(first, prep=500, total=None, mode="basic", as_text=False, **extra):
    d = {"mode": mode, "prep_ms": prep, "first_delta_ms": first,
         "total_ms": total if total is not None else first + 3000, **extra}
    return {"event_data": json.dumps(d) if as_text else d,
            "created_at": datetime(2026, 9, 25, 12, 0, tzinfo=timezone.utc)}


def test_stages_and_modes():
    rows = [_row(1000), _row(3000, as_text=True), _row(9000, mode="coach", memory_ms="700"),
            {"event_data": {"mode": "basic", "message_length": 5}, "created_at": None}]
    out = ls.latency_summary(rows, limit=2)
    assert out["turns"] == 3, "ход без first_delta_ms не считается"
    assert out["stages"]["first_delta_ms"] == {"n": 3, "median": 3000, "p90": 9000, "max": 9000}
    assert out["stages"]["prep_ms"]["n"] == 3
    assert out["stages"]["memory_ms"] == {"n": 1, "median": 700, "p90": 700, "max": 700}
    assert set(out["by_mode"]) == {"basic", "coach"}
    assert out["by_mode"]["coach"]["median"] == 9000
    assert len(out["recent"]) == 2 and out["recent"][0]["first_delta_ms"] == 1000
    assert out["slow_share"] == round(1 / 3, 3)
    assert out["alert"] is False, "три хода — мало для тревоги"


def test_alert_when_median_is_slow_on_enough_turns():
    rows = [_row(6000)] * 5
    assert ls.latency_summary(rows)["alert"] is True
    rows = [_row(6000)] * 4
    assert ls.latency_summary(rows)["alert"] is False
    rows = [_row(3999)] * 10
    assert ls.latency_summary(rows)["alert"] is False


def test_empty_is_quiet():
    out = ls.latency_summary([])
    assert out["turns"] == 0 and out["alert"] is False and out["stages"] == {}


def test_route_is_admin_gated_and_reads_chat_events():
    src = open(os.path.join(BACKEND, "analytics_routes.py"), encoding="utf-8").read()
    i = src.index('"/api/analytics/latency"')
    body = src[i:i + 1800]
    assert "_check_admin(x_admin_token)" in body
    assert "event_type = 'chat'" in body and "fredi_events" in body
    assert "latency_summary(rows, lim)" in body
    assert "from latency_stats import latency_summary" in src
    assert "from __future__ import annotations" not in open(os.path.join(BACKEND, "latency_stats.py"),
                                                            encoding="utf-8").read()
