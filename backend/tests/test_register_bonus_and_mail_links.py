# -*- coding: utf-8 -*-
"""Аккаунт, заведённый сегодня, добавляет минуты, а не заменяет их;
ссылки из писем несут utm для Метрики.

Аудит клиентуры 12.09.2026: аноним второго дня упирался в стену на
трёх минутах, регистрировался — и получал лимит 5 при потраченных 3,
то есть две минуты; стена при этом обещала «+2». Теперь день
регистрации — анонимные минуты плюс FREE_DAILY_MINUTES, а стена
считает разницу по тому, что человек получит на самом деле.

Запуск: python3 backend/tests/test_register_bonus_and_mail_links.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import importlib.util  # noqa: E402

import subscription_meter as sm  # noqa: E402

# services/__init__ тянет за собой голосовой стек (numpy, aiohttp) —
# модуль писем грузим напрямую, ему из этого ничего не нужно.
_spec = importlib.util.spec_from_file_location(
    "reengagement_probe",
    os.path.join(os.path.dirname(__file__), "..", "services", "reengagement.py"))
re_ = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(re_)


def test_registration_day_adds_minutes_on_top():
    anon = sm.daily_limit_minutes(False)
    reg_today = sm.daily_limit_minutes(True, registered_today=True)
    reg_old = sm.daily_limit_minutes(True)
    assert reg_today == anon + sm.FREE_DAILY_MINUTES, (anon, reg_today)
    assert reg_today > reg_old, "в день регистрации минут больше, чем в обычный день аккаунта"


def test_first_day_formula_unchanged():
    assert sm.daily_limit_minutes(False, first_day=True) == sm.FIRST_CONVERSATION_MINUTES
    assert sm.daily_limit_minutes(True, first_day=True) == \
        sm.FIRST_CONVERSATION_MINUTES + sm.FREE_DAILY_MINUTES
    assert sm.daily_limit_minutes(True, first_day=True, registered_today=True) == \
        sm.FIRST_CONVERSATION_MINUTES + sm.FREE_DAILY_MINUTES


def test_wall_numbers_promise_what_registration_really_gives():
    meter = sm.SubscriptionMeter.__new__(sm.SubscriptionMeter)
    meter.db = None
    # Аноним второго дня, выговорил свои 3 минуты.
    used = sm.FREE_DAILY_MINUTES_ANON * 60
    st = meter._compose_status(used_seconds=used, free_days_used=1,
                               total_seconds=used + 3600, registered=False)
    assert st["can_send"] is False
    gain = st["registered_limit_minutes"] - st["anon_limit_minutes"]
    assert gain == sm.FREE_DAILY_MINUTES, st
    # Тот же человек сразу после регистрации: минуты появились.
    st2 = meter._compose_status(used_seconds=used, free_days_used=1,
                                total_seconds=used + 3600, registered=True,
                                registered_today=True)
    assert st2["can_send"] is True
    assert round(st2["remaining_today_minutes"]) == sm.FREE_DAILY_MINUTES, st2
    # Старый аккаунт — обычный дневной лимит, без бонуса.
    st3 = meter._compose_status(used_seconds=0, free_days_used=5,
                                total_seconds=7200, registered=True)
    assert st3["limit_minutes"] == sm.FREE_DAILY_MINUTES


def test_mail_links_carry_utm_and_keep_ref():
    for camp in (re_.CAMPAIGN_D1, re_.CAMPAIGN_D3, re_.CAMPAIGN_TRIAL):
        link = re_.build_return_link(camp, "tok123")
        assert link.startswith(re_.APP_BASE_URL + "?ref=")
        assert "cid=tok123" in link
        assert "utm_source=fredi_mail" in link and "utm_medium=email" in link
        assert f"utm_campaign={camp}" in link
    assert "ref=reeng-d1" in re_.build_return_link(re_.CAMPAIGN_D1, "t")


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
