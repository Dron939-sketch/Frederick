# -*- coding: utf-8 -*-
"""Свой заказ товара мимо Ozon: каталог и сумма в ЮKassa.

20.10.2026 к комплекту добавился пакет «Стандартный» за 5 900 ₽. Главное, что
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
            self.rows.append({"order_no": args[0], "product": args[1], "amount": args[2],
                              "status": "payment_failed" if "'payment_failed'" in sql else "pending"})

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


def _run(monkeypatch, path, body, fail=False):
    mod, alerts = _load()
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
            if fail:
                raise mod.httpx.ReadTimeout("timeout")
            return _Resp()

    monkeypatch.setattr(mod.httpx, "AsyncClient", _Client)
    app, db = _App(), _DB()
    mod.register_order_routes(app, db, _Limiter())
    res = asyncio.run(app.routes[path](_Req(body)))
    if fail:
        return res, alerts, db.rows
    return res, sent.get("payment"), db.rows


FORM = {"fio": "Иванов Иван Иванович", "phone": "8 900 123-45-67", "email": "a@b.ru",
        "city": "Ростов-на-Дону", "pvz": "ул. Большая Садовая, 15, ПВЗ СДЭК"}


def test_standart_goes_for_5900_with_vat_22(monkeypatch):
    res, pay, rows = _run(monkeypatch, "/api/shop/checkout", dict(FORM, product="standart"))
    assert res["success"] and res["confirmation_url"]
    assert pay["amount"]["value"] == "5900.00"
    assert pay["receipt"]["items"][0]["amount"]["value"] == "5900.00"
    assert "Стандартный" in pay["receipt"]["items"][0]["description"]
    assert pay["receipt"]["items"][0]["vat_code"] == 11  # НДС 22 %
    assert pay["metadata"]["product"] == "standart"
    assert pay["confirmation"]["return_url"].startswith("https://meysternlp.ru/razgovornyj-gipnoz/standart/spasibo/")
    assert rows and rows[0]["product"] == "standart" and rows[0]["amount"] == 5900.0


def test_old_address_still_sells_bundle_only(monkeypatch):
    # Поле product на старом адресе не читается: комплект и только он.
    res, pay, rows = _run(monkeypatch, "/api/shop/order", dict(FORM, product="standart"))
    assert res["success"]
    assert pay["amount"]["value"] == "19999.00"
    assert pay["receipt"]["items"][0]["vat_code"] == 11  # НДС 22 % и у комплекта
    assert rows[0]["product"] == "gipnoz-komplekt"


def test_unknown_product_is_refused(monkeypatch):
    res, pay, rows = _run(monkeypatch, "/api/shop/checkout", dict(FORM, product="nichego"))
    assert not res["success"] and pay is None and not rows


def test_failed_payment_keeps_order_and_tells_owner_contacts(monkeypatch):
    # Из Майами создание платежа в ЮKassa обрывается таймаутом. Заказ не
    # теряется, владельцу уходят телефон и почта, странице — «свяжусь с вами».
    res, alerts, rows = _run(monkeypatch, "/api/shop/checkout", dict(FORM, product="standart"), fail=True)
    assert res["success"] and res.get("manual") and res["order_no"].startswith("M-")
    assert "confirmation_url" not in res
    assert rows and rows[0]["status"] == "payment_failed" and rows[0]["amount"] == 5900.0
    assert alerts, "владельцу ничего не пришло"
    text = alerts[-1]
    assert "+79001234567" in text and "a@b.ru" in text and "Иванов Иван Иванович" in text
    assert "ПВЗ СДЭК: ул. Большая Садовая, 15" in text and "оплата не прошла" in text


# --- Цифровой товар: запись «Ключей» (25.10.2026) ---------------------------

LINK = "https://disk.yandex.ru/d/TEST-LINK"


def test_klyuchi_needs_only_email_and_goes_for_690(monkeypatch):
    res, pay, rows = _run(monkeypatch, "/api/shop/checkout",
                          {"product": "klyuchi-01", "email": "a@b.ru", "fio": "Иван"})
    assert res["success"] and res["confirmation_url"]
    assert pay["amount"]["value"] == "690.00"
    item = pay["receipt"]["items"][0]
    assert item["amount"]["value"] == "690.00" and item["vat_code"] == 11
    assert item["payment_subject"] == "service"
    assert pay["receipt"]["customer"] == {"email": "a@b.ru"}
    assert pay["confirmation"]["return_url"].startswith("https://meysternlp.ru/magazin/klyuchi/spasibo/")
    assert rows and rows[0]["product"] == "klyuchi-01" and rows[0]["amount"] == 690.0


def test_klyuchi_refuses_bad_email(monkeypatch):
    res, pay, rows = _run(monkeypatch, "/api/shop/checkout", {"product": "klyuchi-01", "email": "нет"})
    assert not res["success"] and pay is None and not rows


def test_klyuchi_link_is_not_in_code():
    # Репозиторий публичный: ссылка на Диск — только из окружения.
    src = (BACKEND / "order_routes.py").read_text(encoding="utf-8")
    assert "disk.yandex" not in src


class _PaidConn:
    def __init__(self, product, status="paid"):
        self.product, self.status = product, status

    async def fetchrow(self, sql, *args):
        if "UPDATE" in sql:
            return {"id": 1}
        return {"id": 1, "order_no": "M-20261025-ABC123", "product": self.product,
                "amount": 690.0, "fio": "Иван", "phone": "", "email": "a@b.ru",
                "city": None, "pvz": "—", "comment": None, "status": self.status,
                "notified": False, "yookassa_id": "pay-1"}

    async def execute(self, *a):
        pass


def _paid(monkeypatch, product, link):
    mod, owner = _load()
    monkeypatch.setenv("YOOKASSA_SHOP_ID", "1")
    monkeypatch.setenv("YOOKASSA_SECRET_KEY", "k")
    if link:
        monkeypatch.setenv("KLYUCHI_LINK_01", link)
    else:
        monkeypatch.delenv("KLYUCHI_LINK_01", raising=False)
    mails = []

    class _Mail:
        enabled = True

        async def send(self, to, subject, body):
            mails.append((to, subject, body))

    main = types.ModuleType("main")
    main.email_service = _Mail()
    monkeypatch.setitem(sys.modules, "main", main)

    class _DBp:
        @contextlib.asynccontextmanager
        async def get_connection(self):
            yield _PaidConn(product)

    app = _App()
    mod.register_order_routes(app, _DBp(), _Limiter())

    async def _fetch(*a, **k):
        return {"status": "succeeded"}

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            class R:
                status_code = 200

                def json(self):
                    return {"status": "succeeded"}
            return R()

    monkeypatch.setattr(mod.httpx, "AsyncClient", _Client)
    res = asyncio.run(app.state.shop_order_webhook("pay-1"))
    verify = asyncio.run(app.routes["/api/shop/verify"](_Req({"order_no": "M-20261025-ABC123"})))
    return res, verify, mails, owner


def test_paid_klyuchi_gets_link_in_mail_and_on_page(monkeypatch):
    res, verify, mails, owner = _paid(monkeypatch, "klyuchi-01", LINK)
    assert res["paid"] and res["link"] == LINK
    assert verify["paid"] and verify["link"] == LINK
    assert mails and mails[0][0] == "a@b.ru" and LINK in mails[0][2]
    assert owner and "Продана" in owner[-1] and "a@b.ru" in owner[-1]


def test_paid_klyuchi_without_link_warns_owner(monkeypatch):
    res, verify, mails, owner = _paid(monkeypatch, "klyuchi-01", "")
    assert res["paid"] and res["link"] == ""
    assert mails and "в течение дня" in mails[0][2]
    assert "KLYUCHI_LINK_01" in owner[-1]


def test_paid_physical_order_gets_no_link(monkeypatch):
    res, verify, mails, owner = _paid(monkeypatch, "standart", LINK)
    assert res["paid"] and "link" not in res and "link" not in verify


def test_books_and_games_sold_here_with_owner_prices(monkeypatch):
    # 25.10.2026: «в магазине не нужно ссылок на Ozon, теперь мы сами продаём».
    for product, amount in (("kniga-tm", "990.00"), ("kniga-var", "990.00"), ("kniga-konc", "990.00"),
                            ("marketolog", "1200.00"), ("var-basic", "3800.00"),
                            ("var-progressive", "3800.00"), ("samostoyatelnyy", "3200.00")):
        res, pay, rows = _run(monkeypatch, "/api/shop/checkout", dict(FORM, product=product))
        assert res["success"], product
        assert pay["amount"]["value"] == amount and pay["receipt"]["items"][0]["amount"]["value"] == amount
        assert pay["receipt"]["items"][0]["payment_subject"] == "commodity"
        assert pay["confirmation"]["return_url"].startswith("https://meysternlp.ru/magazin/spasibo/")


def test_physical_goods_still_need_pickup_point(monkeypatch):
    res, pay, rows = _run(monkeypatch, "/api/shop/checkout", dict(FORM, product="marketolog", pvz=""))
    assert not res["success"] and pay is None


def test_pdf_books_go_for_690_and_send_link(monkeypatch):
    res, pay, rows = _run(monkeypatch, "/api/shop/checkout", {"product": "kniga-konc-pdf", "email": "a@b.ru"})
    assert res["success"] and pay["amount"]["value"] == "690.00"
    assert pay["receipt"]["items"][0]["payment_subject"] == "service"
    mod, _ = _load()
    for slug in ("kniga-tm-pdf", "kniga-var-pdf", "kniga-konc-pdf"):
        assert mod.PRODUCTS[slug]["digital"] and mod.PRODUCTS[slug]["amount"] == "690.00"


def test_pdf_mail_says_open_book_not_listen(monkeypatch):
    monkeypatch.setenv("KNIGA_TM_PDF_LINK", LINK)
    res, verify, mails, owner = _paid(monkeypatch, "kniga-tm-pdf", "")
    assert "Открыть книгу: " + LINK in mails[0][2] and "наушник" not in mails[0][2]


def test_deputy_book_is_pdf_preorder_for_1490(monkeypatch):
    # 25.10.2026: «Настольная книга депутата» — только PDF, предзаказ, 1 490 ₽.
    mod, _ = _load()
    assert "kniga-dep" not in mod.PRODUCTS
    assert mod.PRODUCTS["kniga-dep-pdf"]["amount"] == "1490.00"
    monkeypatch.delenv("KNIGA_DEP_PDF_LINK", raising=False)
    res, verify, mails, owner = _paid(monkeypatch, "kniga-dep-pdf", "")
    assert res["paid"] and res["link"] == "" and res["preorder"] and verify["preorder"]
    assert "предзаказ" in mails[0][2] and "в течение дня" not in mails[0][2]
    assert "предзаказ" in owner[-1] and "⚠️" not in owner[-1]
