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


def test_admin_renewals_route_closed_by_token():
    """30.09.2026: причина несостоявшегося продления была видна только в
    базе. Ручка отдаёт попытки и ошибки, без почт, и закрыта токеном до
    первого запроса в базу."""
    import pathlib
    src = (pathlib.Path(__file__).resolve().parents[1] / "payment_routes.py").read_text(encoding="utf-8")
    i = src.index('@app.get("/api/admin/renewals")')
    body = src[i:src.index("@app.get", i + 10)]
    assert body.index("_check_admin(") < body.index("db.get_connection()")
    assert "email" not in body
    assert "renewal_last_error" in body and "subscription_recurring" in body


def test_canceled_renewal_keeps_yookassa_reason():
    """30.09.2026: продление пробы …9178 вернулось canceled без причины.
    Причина из cancellation_details попадает в renewal_last_error."""
    import pathlib
    src = (pathlib.Path(__file__).resolve().parents[1] / "payment.py").read_text(encoding="utf-8")
    i = src.index("async def charge_recurring(")
    body = src[i:src.index("async def _extend_subscription", i)]
    assert 'result.get("cancellation_details")' in body
    assert 'cd.get("reason")' in body and 'cd.get("party")' in body


def test_payment_applied_once_even_when_webhook_races_charge():
    """01.10.2026: продление …4673 за 690 ₽ дало 60 дней. Ответ ЮKassa на
    автосписание и её webhook пришли почти одновременно, оба прочитали
    «ещё не оплачен» и оба продлили. Теперь платёж захватывается одним
    INSERT ... ON CONFLICT ... WHERE status <> succeeded RETURNING, а
    успешное автосписание идёт через тот же _apply_succeeded_payment."""
    import pathlib
    src = (pathlib.Path(__file__).resolve().parents[1] / "payment.py").read_text(encoding="utf-8")
    i = src.index("async def _apply_succeeded_payment(")
    apply_body = src[i:src.index("async def _fetch_payment", i)]
    assert "WHERE fredi_payments.status IS DISTINCT FROM 'succeeded'" in apply_body
    assert "RETURNING 1" in apply_body
    assert 'already = None if claimed else "succeeded"' in apply_body
    # раздельного «прочитать, потом вставить» больше нет
    assert "SELECT status FROM fredi_payments WHERE yookassa_id" not in apply_body
    # автосписание после истёкшей пробы — продление, а не новая оплата
    assert "is_renewal = is_recurring" in apply_body

    j = src.index("async def charge_recurring(")
    charge = src[j:src.index("async def _extend_subscription", j)]
    assert "await self._apply_succeeded_payment(user_id, result)" in charge
    assert "self._extend_subscription(" not in charge


def test_admin_payment_details_closed_and_without_card_number():
    """01.10.2026: три отмены пробы подряд, причина была видна только в
    кабинете ЮKassa. Ручка закрыта токеном и не отдаёт номер карты."""
    import pathlib
    src = (pathlib.Path(__file__).resolve().parents[1] / "payment_routes.py").read_text(encoding="utf-8")
    i = src.index('@app.get("/api/admin/payment/{payment_id}")')
    body = src[i:src.index("@app.get", i + 10)]
    assert body.index("_check_admin(") < body.index("_fetch_payment(")
    assert "cancellation_details" in body
    for leak in ("first6", "last4", "email", "phone"):
        assert leak not in body, leak
