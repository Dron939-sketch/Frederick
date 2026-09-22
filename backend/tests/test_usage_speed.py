# -*- coding: utf-8 -*-
"""Ускоренное списание бесплатных минут (22.09.2026, решение владельца).

Человеку показываются десять минут первого разговора, а расходуются они
за семь: каждая реальная секунда списывается с коэффициентом 10/7. Место
коэффициента — сервер, а не клиент: клиент шлёт реально прошедшие
секунды, и подкрутить их из браузера нельзя. Цифра в бадже при этом не
врёт — остаток считается из того же запаса, что и списание.
"""
import importlib.util
import os
import sys

BACKEND = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, BACKEND)


def _meter():
    spec = importlib.util.spec_from_file_location(
        "subscription_meter_t", os.path.join(BACKEND, "subscription_meter.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_ten_shown_minutes_are_spent_in_about_seven():
    m = _meter()
    window = m.FIRST_CONVERSATION_MINUTES * 60
    real = 0
    spent = 0
    # Клиент шлёт куски по 30 секунд (meter.js recordExchange: 15–120).
    while spent < window:
        spent += m.billed_seconds(30)
        real += 30
    assert 6 * 60 <= real <= 7.5 * 60, (
        f"десять показанных минут должны кончаться примерно за семь реальных, вышло {real/60:.1f}")


def test_multiplier_is_server_side_and_bounded():
    m = _meter()
    assert 1.0 < m.USAGE_SPEED <= 2.0, "коэффициент — ускорение, а не отключение бесплатного уровня"
    assert m.billed_seconds(0) >= 1, "нулевой обмен всё равно списывает секунду"
    assert m.billed_seconds(30) == round(30 * m.USAGE_SPEED)
    assert m.billed_seconds(-5) >= 1, "отрицательное не отматывает запас назад"


def test_record_usage_applies_multiplier_before_db():
    src = open(os.path.join(BACKEND, "subscription_meter.py"), encoding="utf-8").read()
    i = src.index("async def record_usage(")
    body = src[i:i + 1200]
    assert "seconds = billed_seconds(seconds)" in body, "умножаем до записи в БД"
    assert body.index("seconds = billed_seconds(seconds)") < body.index("get_connection"), (
        "коэффициент применяется до UPDATE, иначе в запас ляжет сырое значение")


def test_ip_bucket_uses_same_units():
    src = open(os.path.join(BACKEND, "meter_routes.py"), encoding="utf-8").read()
    assert "record_anon_ip_usage(iph, billed_seconds(seconds))" in src, (
        "потолок на IP считается в тех же единицах, что и личный запас")
