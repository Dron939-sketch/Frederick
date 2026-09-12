# -*- coding: utf-8 -*-
"""Автопродление повторяет неудачное списание, а не хоронит подписку.

До 12.09.2026 неудача с текстом «недостаточно средств» выключала
автопродление с первого раза, остальные ошибки не повторялись вовсе:
окно кандидатов было в сутки, планировщик тикает раз в сутки. Здесь
проверяется новая механика на подменной базе: попытка считается,
автопродление живёт до MAX_RENEWAL_ATTEMPTS, успех обнуляет счётчик,
ключ идемпотентности ЮKassa стабилен внутри суток.

Запуск: python3 backend/tests/test_renewal_retry.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("YOOKASSA_SHOP_ID", "test")
os.environ.setdefault("YOOKASSA_SECRET_KEY", "test")

import payment  # noqa: E402


class _Conn:
    def __init__(self, db):
        self.db = db

    async def fetch(self, sql, *args):
        self.db.log.append(("fetch", " ".join(sql.split()), args))
        return list(self.db.rows)

    async def fetchrow(self, sql, *args):
        self.db.log.append(("fetchrow", " ".join(sql.split()), args))
        return None

    async def execute(self, sql, *args):
        self.db.log.append(("execute", " ".join(sql.split()), args))
        return "OK"


class _Ctx:
    def __init__(self, db):
        self.db = db

    async def __aenter__(self):
        return _Conn(self.db)

    async def __aexit__(self, *exc):
        return False


class FakeDB:
    def __init__(self, rows):
        self.rows = rows
        self.log = []

    def get_connection(self):
        return _Ctx(self)

    def updates(self):
        return [e for e in self.log if e[0] == "execute" and "UPDATE fredi_subscriptions" in e[1]]


def _service(db, outcome):
    svc = payment.PaymentService(db)

    async def fake_charge(user_id, payment_method_id):
        return outcome

    svc.charge_recurring = fake_charge
    return svc


def test_first_failure_counts_and_keeps_auto_renew():
    db = FakeDB([{"user_id": 7, "payment_method_id": "pm", "renewal_attempts": 0}])
    svc = _service(db, {"success": False, "error": "Недостаточно средств на карте"})
    res = asyncio.run(svc.process_renewals())
    assert res == {"renewed": 0, "failed": 1, "disabled": 0}, res
    ups = db.updates()
    assert len(ups) == 1, ups
    _, sql, args = ups[0]
    assert "renewal_attempts = $2" in sql and "renewal_last_attempt_at = NOW()" in sql
    assert args[0] == 7 and args[1] == 1 and "Недостаточно" in args[2]
    assert args[3] is False, "после первой неудачи автопродление выключать нельзя"


def test_last_failure_disables_auto_renew():
    last = payment.MAX_RENEWAL_ATTEMPTS - 1
    db = FakeDB([{"user_id": 7, "payment_method_id": "pm", "renewal_attempts": last}])
    svc = _service(db, {"success": False, "error": "Срок действия карты истек"})
    res = asyncio.run(svc.process_renewals())
    assert res["disabled"] == 1 and res["failed"] == 1, res
    _, sql, args = db.updates()[0]
    assert args[1] == payment.MAX_RENEWAL_ATTEMPTS and args[3] is True


def test_success_touches_nothing_in_process_renewals():
    db = FakeDB([{"user_id": 7, "payment_method_id": "pm", "renewal_attempts": 2}])
    svc = _service(db, {"success": True, "payment_id": "x", "status": "succeeded"})
    res = asyncio.run(svc.process_renewals())
    assert res == {"renewed": 1, "failed": 0, "disabled": 0}, res
    assert db.updates() == []


def test_candidate_query_has_retry_window():
    db = FakeDB([])
    svc = _service(db, {"success": True})
    asyncio.run(svc.process_renewals())
    sql = [e for e in db.log if e[0] == "fetch"][0][1]
    assert f"renewal_attempts, 0) < {payment.MAX_RENEWAL_ATTEMPTS}" in sql
    assert f"INTERVAL '{payment.RENEWAL_RETRY_HOURS} hours'" in sql
    assert f"INTERVAL '{payment.MAX_RENEWAL_ATTEMPTS + 1} days'" in sql
    assert "INTERVAL '1 day'" in sql, "месяц по-прежнему продлевается за сутки до конца"


def test_extend_subscription_resets_attempts():
    db = FakeDB([])
    svc = payment.PaymentService(db)
    asyncio.run(svc._extend_subscription(7))
    sql = [e for e in db.log if e[0] == "execute"][0][1]
    assert "renewal_attempts = 0" in sql and "renewal_last_error = NULL" in sql


def test_renewal_idempotence_key_is_stable_within_a_day():
    svc = payment.PaymentService(FakeDB([]))
    a = svc._idempotence_key(7, op="renewal", bucket_seconds=86400)
    b = svc._idempotence_key(7, op="renewal", bucket_seconds=86400)
    c = svc._idempotence_key(8, op="renewal", bucket_seconds=86400)
    assert a == b and a != c
    assert svc._idempotence_key() != svc._idempotence_key()


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
