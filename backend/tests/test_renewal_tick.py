# -*- coding: utf-8 -*-
"""Проверка продлений — не раз в сутки."""

def test_renewal_tick_not_daily():
    """29.09.2026: тик раз в сутки от старта сервера продлевал пробу почти
    через сутки после её конца — человек оставался без Premium."""
    import pathlib, re
    src = (pathlib.Path(__file__).resolve().parents[1] / "payment_routes.py").read_text(encoding="utf-8")
    m = re.search(r"^RENEWAL_TICK_SECONDS = (\d+)", src, re.M)
    assert m and int(m.group(1)) <= 3600
    assert "await asyncio.sleep(RENEWAL_TICK_SECONDS)" in src
    assert "await asyncio.sleep(86400)" not in src.split("async def subscription_renewal_scheduler")[1].split("async def ")[0]
