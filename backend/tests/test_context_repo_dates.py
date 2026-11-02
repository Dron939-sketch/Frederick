# -*- coding: utf-8 -*-
"""Контекст: даты из кэша не должны ломать сохранение.

Прод, 28–29.10.2026: 28 падений
«invalid input for query argument $9: '2026-10-28 06:01:00.317122+00:00'
(expected a datetime.date or datetime.datetime instance, got 'str')».

Контекст сериализуется в Redis как JSON, оттуда даты возвращаются строками,
а asyncpg строку в TIMESTAMP WITH TIME ZONE не принимает — save() падал
целиком, и контекст пользователя переставал обновляться.

Запуск: python -m pytest backend/tests/test_context_repo_dates.py -q
"""
import asyncio
import os
import sys
from datetime import date, datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from repositories.context_repo import (  # noqa: E402
    ContextRepository,
    _as_date,
    _as_ts,
    _normalize,
)


class FakeDB:
    """Запоминает, что реально ушло в SQL."""

    def __init__(self):
        self.calls = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))

    async def fetchrow(self, sql, *args):
        return None


def test_iso_string_becomes_datetime():
    dt = _as_ts("2026-10-28 06:01:00.317122+00:00")
    assert isinstance(dt, datetime)
    assert dt.tzinfo is not None


def test_iso_string_with_z_suffix():
    dt = _as_ts("2026-10-28T06:01:00Z")
    assert isinstance(dt, datetime)
    assert dt.utcoffset().total_seconds() == 0


def test_passthrough_and_garbage():
    now = datetime.now(timezone.utc)
    assert _as_ts(now) is now
    assert _as_ts("не дата") is None
    assert _as_date("1990-05-01") == date(1990, 5, 1)
    assert _as_date(datetime(1990, 5, 1, 12, 0)) == date(1990, 5, 1)
    assert _as_date("мусор") is None


def test_normalize_restores_types():
    out = _normalize({
        "last_context_update": "2026-10-28T06:01:00+00:00",
        "weather_cache_time": "2026-10-28T07:00:00+00:00",
        "birth_date": "1990-05-01",
        "name": "Аня",
    })
    assert isinstance(out["last_context_update"], datetime)
    assert isinstance(out["weather_cache_time"], datetime)
    assert out["birth_date"] == date(1990, 5, 1)
    assert out["name"] == "Аня"
    # исходный словарь не мутируем
    assert isinstance(_normalize({"name": "Аня"}).get("name"), str)


def test_save_binds_datetime_not_string():
    """Регрессия: строка из кэша не должна доходить до asyncpg."""
    db = FakeDB()
    repo = ContextRepository(db, cache=None)

    ok = asyncio.run(repo.save(1, {
        "name": "Аня",
        "last_context_update": "2026-10-28 06:01:00.317122+00:00",
        "weather_cache_time": "2026-10-28T07:00:00+00:00",
        "birth_date": "1990-05-01",
    }))

    assert ok is True
    sql, args = db.calls[-1]
    assert "fredi_user_contexts" in sql
    assert not any(isinstance(a, str) and a.startswith("2026-10-28") for a in args), \
        f"в SQL ушла строка вместо datetime: {args}"
    assert any(isinstance(a, datetime) for a in args)
    assert any(isinstance(a, date) and not isinstance(a, datetime) for a in args)


def test_save_skips_unparsable_date_but_keeps_the_rest():
    """Мусор в дате не должен ронять сохранение остальных полей."""
    db = FakeDB()
    repo = ContextRepository(db, cache=None)

    ok = asyncio.run(repo.save(1, {
        "name": "Аня",
        "last_context_update": "позавчера",
    }))

    assert ok is True
    sql, args = db.calls[-1]
    assert "Аня" in args
    assert "last_context_update" not in sql
