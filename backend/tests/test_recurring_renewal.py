# -*- coding: utf-8 -*-
"""Автопродление: деньги списаны — подписка включена и человек об этом знает.

23.09.2026 пришло обращение: «сегодня должна была продлиться подписка,
пришёл чек в банке, но на сайте продления не произошло». Разбор показал
три места, где такое возможно, и все три закрыты здесь.

Проверки идут по тексту модуля, а не по живой базе: у списания с карты
нет ни фикстуры, ни тестовой кассы, а ошибиться можно ровно в тех
строках, которые тест и читает.
"""
import os
import re

BACKEND = os.path.join(os.path.dirname(__file__), "..")
SRC = open(os.path.join(BACKEND, "payment.py"), encoding="utf-8").read()


def _body(name: str, size: int = 2500) -> str:
    i = SRC.index(f"async def {name}(")
    return SRC[i:i + size]


def test_recurring_row_updates_status_instead_of_doing_nothing():
    b = _body("charge_recurring", 6000)
    i = b.index("INSERT INTO fredi_payments")
    insert = b[i:i + 500]
    assert "DO UPDATE" in insert, (
        "ключ идемпотентности стабилен на сутки: повтор в тот же день возвращает "
        "тот же платёж уже succeeded, и при DO NOTHING строка навсегда осталась бы pending"
    )
    assert "DO NOTHING" not in insert


def test_recurring_metadata_carries_plan():
    b = _body("charge_recurring", 4000)
    i = b.index('"metadata"')
    meta = b[i:i + 200]
    assert '"plan"' in meta, "тариф читается из метаданных, когда платёж возвращается через webhook или поллер"


def test_renewal_notifies_the_person():
    b = _body("_extend_subscription", 3000)
    assert "notify_subscription_activated" in b, (
        "автопродление молчало: человек видел только чек из банка и не знал, "
        "что подписка продлена"
    )
    assert "is_renewal=True" in b


def test_poller_does_not_abandon_old_pending_rows():
    b = _body("poll_pending_payments", 3000)
    assert "<=" in b and "INTERVAL" in b, (
        "строки старше окна должны разбираться хвостом, а не оставаться pending навсегда"
    )
    # Свежие по-прежнему идут первыми и большим куском.
    assert "LIMIT 100" in b and "LIMIT 20" in b


def test_stuck_payments_reach_the_owner_once():
    b = _body("_alert_stuck_payments", 3000)
    assert "stuck_alert_sent_at IS NULL" in b, "сигнал уходит один раз на платёж"
    assert "UPDATE fredi_payments SET stuck_alert_sent_at" in b
    assert "_send_to_owner" in b and "_send_email_to_owner" in b


def test_stuck_alert_column_is_migrated():
    routes = open(os.path.join(BACKEND, "payment_routes.py"), encoding="utf-8").read()
    assert re.search(r"ADD COLUMN IF NOT EXISTS stuck_alert_sent_at", routes), (
        "без миграции запрос сигнала падал бы на каждой базе, где колонки ещё нет"
    )
