# -*- coding: utf-8 -*-
"""Тариф «три месяца» (25.09.2026): якорь рядом с месяцем.

Одна цена сравнивать не с чем. Проверяется, что квартал в тарифах,
что он выгоднее месяца в пересчёте на день (иначе якорь врёт), и что
автопродление берёт тариф из подписки, а не из константы месяца:
человек, купивший три месяца, не должен через 90 дней получить
списание за месяц и месяц доступа.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

BACKEND = os.path.join(os.path.dirname(__file__), "..")
SRC = open(os.path.join(BACKEND, "payment.py"), encoding="utf-8").read()


def _plans():
    import payment
    return payment.PLANS, payment.plan_price


def test_quarter_plan_exists_and_is_cheaper_per_day():
    plans, plan_price = _plans()
    assert "quarter" in plans
    q, m = plans["quarter"], plans["monthly"]
    assert int(q["days"]) == 90
    per_day_q = float(q["amount"]) / int(q["days"])
    per_day_m = float(m["amount"]) / int(m["days"])
    assert per_day_q < per_day_m, "три месяца обязаны быть дешевле месяца в день, иначе якорь — обман"
    assert plan_price("quarter") == 1490


def test_quarter_saving_is_what_the_screen_promises():
    """Экран подписки пишет «выгоднее на N%» и «M ₽/мес», считая из
    PLAN_PRICE. Здесь та же арифметика от PLANS — чтобы два места не
    разошлись, если цену тронут только с одной стороны."""
    plans, _ = _plans()
    q = float(plans["quarter"]["amount"]); m = float(plans["monthly"]["amount"])
    assert round(q / 3) == 497
    assert round((1 - q / (m * 3)) * 100) == 28


def _body(name: str, size: int = 4000) -> str:
    i = SRC.index(f"async def {name}(")
    return SRC[i:i + size]


def test_recurring_charge_takes_plan_from_subscription():
    b = _body("charge_recurring", 7000)
    assert "SELECT plan FROM fredi_subscriptions" in b, "тариф продления читается из подписки"
    assert 'renew_plan = "quarter" if cur_plan == "quarter" else "monthly"' in b
    assert '"plan": renew_plan' in b, "в метаданных платежа — тариф продления, не «monthly» руками"
    assert "renew_amount" in b and 'float(renew_amount)' in b
    assert "SUBSCRIPTION_AMOUNT" not in b.split("payment_data = {")[1].split("try:")[0], \
        "сумма списания — из тарифа, не из месячной константы"


def test_extend_subscription_uses_plan_days():
    b = _body("_extend_subscription", 2500)
    assert 'plan: str = "monthly"' in b
    assert 'period_days = int(PLANS[plan]["days"])' in b
    assert "SUBSCRIPTION_PERIOD_DAYS" not in b, "срок продления — по тарифу"
    assert "plan = $4" in b, "тариф подписки после продления — тот, которым продлили"


def test_status_exposes_quarter():
    b = _body("get_subscription_status", 3000)
    assert '"quarter": {"amount": PLANS["quarter"]["amount"]' in b
