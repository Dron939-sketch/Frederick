"""Каждое соединение с ЮKassa — с повтором при обрыве соединения.

21.10.2026 люди жаловались, что оплата не работает: из девяти проверок
/api/payment/diag три упали по ConnectTimeout через 20 секунд, а платёж
создавался одной попыткой. Повтор транспорта (retries) срабатывает только
когда соединение не установилось, то есть запрос до кассы не ушёл, —
двойного платежа он не создаёт.
"""
import pathlib
import re

import httpx

BACKEND = pathlib.Path(__file__).resolve().parents[1]


def test_no_bare_clients_to_yookassa():
    for name in ("payment.py", "order_routes.py", "payment_routes.py"):
        src = (BACKEND / name).read_text(encoding="utf-8")
        bare = re.findall(r"httpx\.AsyncClient\(timeout=\d+\)", src)
        assert not bare, f"{name}: клиент без повтора соединения: {bare}"


def test_helper_retries_connect_only():
    import importlib.util
    spec = importlib.util.spec_from_file_location("payment_probe", BACKEND / "payment.py")
    src = (BACKEND / "payment.py").read_text(encoding="utf-8")
    assert "AsyncHTTPTransport(retries=3)" in src and "connect=6.0" in src
    # у httpx повтор транспорта — это повтор соединения, не запроса
    t = httpx.AsyncHTTPTransport(retries=3)
    assert t._pool._retries == 3
