# -*- coding: utf-8 -*-
"""Свой заказ товара мимо Ozon: каталог и сумма в ЮKassa.

20.10.2026 к комплекту добавился пакет «Стандартный» за 4 900 ₽. Главное, что
здесь проверяется, — сумма: старый адрес /api/shop/order всегда берёт 19 999 ₽,
поэтому новый товар ходит через /api/shop/checkout, и сумма в платеже и в чеке
должна быть ценой именно этого товара.

Запуск: python3 -m pytest -q backend/tests/test_shop_checkout.py
"""
import asyncio
import contextlib
import importlib.util
import sys
import types
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


def _load():
    # feedback_routes тянет за собой весь бэкенд; заказу нужны два канала связи.
    fb = types.ModuleType("feedback_routes")
    sent = []

    async def _send_to_owner(text):
        sent.append(text)
        return True

    async def _send_email_to_owner(subject, text):
        sent.append(text)
        return True

    fb._send_to_owner = _send_to_owner
    fb._send_email_to_owner = _send_email_to_owner
    sys.modules["feedback_routes"] = fb
    spec = importlib.util.spec_from_file_location("order_routes_probe", BACKEND / "order_routes.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod, sent


class _Conn:
    def __init__(self, rows):
        self.rows = rows

    async def execute(self, sql, *args):
        if sql.strip().startswith("INSERT"):
            self.rows.append({"order_no": args[0], "product": args[1], "amount": args[2]})

    async def fetchrow(self, *a):
        return None


class _DB:
    def __init__(self):
        self.rows = []

    @contextlib.asynccontextmanager
    async def get_connection(self):
        yield _Conn(self.rows)


class _Limiter:
    def limit(self, *_a, **_k):
        return lambda f: f


class _App:
    def __init__(self):
        self.routes = {}
        self.state = types.SimpleNamespace()

    def post(self, path):
        def deco(f):
            self.routes[path] = f
            return f
        return deco


class _Req:
    def __init__(self, body):
        self.body = body

    async def json(self):
        return self.body


def _run(monkeypatch, path, body):
    mod, _ = _load()
    monkeypatch.setenv("YOOKASSA_SHOP_ID", "1")
    monkeypatch.setenv("YOOKASSA_SECRET_KEY", "k")
    sent = {}

    class _Resp:
        status_code = 200

        def json(self):
            return {"id": "pay-1", "confirmation": {"confirmation_url": "https://yoomoney.ru/pay"}}

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, json=None, headers=None):
            sent["payment"] = json
            return _Resp()

    monkeypatch.setattr(mod.httpx, "AsyncClient", _Client)
    app, db = _App(), _DB()
    mod.register_order_routes(app, db, _Limiter())
    res = asyncio.run(app.routes[path](_Req(body)))
    return res, sent.get("payment"), db.rows


FORM = {"fio": "Иванов Иван Иванович", "phone": "8 900 123-45-67", "email": "a@b.ru",
        "city": "Ростов-на-Дону", "pvz": "ул. Большая Садовая, 15, ПВЗ СДЭК"}


def test_standart_goes_for_4900(monkeypatch):
    res, pay, rows = _run(monkeypatch, "/api/shop/checkout", dict(FORM, product="standart"))
    assert res["success"] and res["confirmation_url"]
    assert pay["amount"]["value"] == "4900.00"
    assert pay["receipt"]["items"][0]["amount"]["value"] == "4900.00"
    assert "Стандартный" in pay["receipt"]["items"][0]["description"]
    assert pay["metadata"]["product"] == "standart"
    assert pay["confirmation"]["return_url"].startswith("https://meysternlp.ru/razgovornyj-gipnoz/standart/spasibo/")
    assert rows and rows[0]["product"] == "standart" and rows[0]["amount"] == 4900.0


def test_old_address_still_sells_bundle_only(monkeypatch):
    # Поле product на старом адресе не читается: комплект и только он.
    res, pay, rows = _run(monkeypatch, "/api/shop/order", dict(FORM, product="standart"))
    assert res["success"]
    assert pay["amount"]["value"] == "19999.00"
    assert rows[0]["product"] == "gipnoz-komplekt"


def test_unknown_product_is_refused(monkeypatch):
    res, pay, rows = _run(monkeypatch, "/api/shop/checkout", dict(FORM, product="nichego"))
    assert not res["success"] and pay is None and not rows
