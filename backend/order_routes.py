"""
order_routes.py — продажа физического комплекта напрямую, мимо Ozon.

Один товар: комплект «Разговорный гипноз» (тренинг на QR-карточках с картой
активации, три книги, три игры «Вариатика») за 19 999 ₽ с доставкой СДЭК.
Доставка входит в цену, поэтому сумма всегда одна и в чеке одна позиция.

Порядок: человек заполняет ФИО, телефон, почту и адрес пункта выдачи →
создаётся заказ в shop_orders и платёж в ЮKassa → уходит на страницу оплаты →
после оплаты владельцу падают данные для отправки (Telegram и почта), а
покупателю — подтверждение с номером заказа.

Статус платежа НИКОГДА не берётся из тела вебхука: ЮKassa его не подписывает,
и подделать payment.succeeded может кто угодно, кто знает адрес. Поэтому и
вебхук, и возврат с формы оплаты ведут в одну функцию, которая перезапрашивает
платёж через API ЮKassa и верит только ответу API.
"""

import base64
import logging
import os
import random
import re
import string
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

YOOKASSA_API_URL = "https://api.yookassa.ru/v3"

BUNDLE_AMOUNT = "19999.00"
BUNDLE_CURRENCY = "RUB"
BUNDLE_TITLE = "Комплект «Разговорный гипноз»: тренинг, 3 книги, 3 игры"
BUNDLE_SLUG = "gipnoz-komplekt"

MAX_FIO = 200
MAX_PHONE = 32
MAX_EMAIL = 254
MAX_CITY = 200
MAX_PVZ = 500
MAX_COMMENT = 1000


def _shop_id() -> str:
    return (os.environ.get("YOOKASSA_SHOP_ID") or "").strip()


def _secret_key() -> str:
    return (os.environ.get("YOOKASSA_SECRET_KEY") or "").strip()


def _auth_header() -> str:
    raw = f"{_shop_id()}:{_secret_key()}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def _order_no() -> str:
    """M-20260901-K7QF9X — дата для глаза, хвост от совпадений.

    Номер уходит в ЮKassa как Idempotence-Key, поэтому совпадение двух
    номеров означало бы, что второму заказу вернут чужой платёж. Шесть
    знаков дают два миллиарда вариантов на день — этого достаточно.
    """
    alphabet = string.ascii_uppercase + string.digits
    tail = "".join(random.choice(alphabet) for _ in range(6))
    return "M-%s-%s" % (datetime.now(timezone.utc).strftime("%Y%m%d"), tail)


def _clean_phone(raw: str) -> str:
    """Приводим к +7XXXXXXXXXX. ЮKassa принимает только цифры со знаком."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    if len(digits) == 10:
        digits = "7" + digits
    return "+" + digits if len(digits) == 11 else ""


def _valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$", email or ""))


def register_order_routes(app, db, limiter):
    from fastapi import Request

    # Доставка обращений уже решена в форме связи — переиспользуем оба канала,
    # чтобы заказ не потерялся, если Telegram не настроен.
    from feedback_routes import _send_email_to_owner, _send_to_owner

    async def init_orders_table():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS shop_orders (
                    id BIGSERIAL PRIMARY KEY,
                    order_no TEXT UNIQUE NOT NULL,
                    product TEXT NOT NULL,
                    amount NUMERIC(10,2) NOT NULL,
                    fio TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT NOT NULL,
                    city TEXT,
                    pvz TEXT NOT NULL,
                    comment TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    yookassa_id TEXT,
                    notified BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    paid_at TIMESTAMPTZ
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS shop_orders_yk_idx ON shop_orders (yookassa_id)")
        logger.info("Shop orders table ready")

    async def _fetch_payment(yookassa_id: str):
        if not _shop_id() or not _secret_key():
            return None
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(
                    f"{YOOKASSA_API_URL}/payments/{yookassa_id}",
                    headers={"Authorization": _auth_header()},
                )
            if r.status_code == 200:
                return r.json()
            logger.error(f"shop: fetch payment {yookassa_id} -> {r.status_code}")
        except Exception as e:
            logger.error(f"shop: fetch payment error: {e}")
        return None

    async def _notify(order: dict) -> None:
        """Владельцу — данные для отправки, покупателю — подтверждение."""
        text = (
            "📦 Заказ комплекта оплачен\n\n"
            f"Номер: {order['order_no']}\n"
            f"Сумма: {order['amount']} ₽\n\n"
            f"ФИО: {order['fio']}\n"
            f"Телефон: {order['phone']}\n"
            f"Почта: {order['email']}\n"
            f"Город: {order.get('city') or '—'}\n"
            f"ПВЗ СДЭК: {order['pvz']}\n"
            f"Комментарий: {order.get('comment') or '—'}"
        )
        if not await _send_to_owner(text):
            await _send_email_to_owner(f"Заказ {order['order_no']} оплачен", text)

        service = _email_service()
        if service is not None and getattr(service, "enabled", False):
            body = (
                f"{order['fio']}, спасибо за заказ.\n\n"
                f"Номер заказа: {order['order_no']}\n"
                f"Комплект «Разговорный гипноз»: тренинг на QR-карточках с картой "
                f"активации, три книги и три игры «Вариатика».\n"
                f"Оплачено: {order['amount']} ₽, доставка входит в цену.\n\n"
                f"Пункт выдачи: {order['pvz']}\n\n"
                f"Отправлю посылку СДЭК и пришлю трек-номер этим же письмом. "
                f"Если нужно что-то поправить в адресе — ответьте на это письмо.\n\n"
                f"Андрей Мейстер\nmeysternlp.ru"
            )
            await service.send(order["email"],
                               f"Заказ {order['order_no']} принят — комплект «Разговорный гипноз»",
                               body)

    def _email_service():
        import sys
        main_mod = sys.modules.get("main") or sys.modules.get("__main__")
        service = getattr(main_mod, "email_service", None)
        if service is None:
            try:
                from email_service import EmailService
                service = EmailService()
            except Exception:
                return None
        return service

    async def _mark_paid(yookassa_id: str) -> dict:
        """Единственное место, где заказ становится оплаченным.

        Вызывается и вебхуком, и проверкой со страницы «спасибо». Статус
        берётся из API ЮKassa, а не из того, что пришло в запросе.
        """
        payment = await _fetch_payment(yookassa_id)
        if not payment:
            return {"success": False, "error": "payment not found"}
        status = payment.get("status", "")
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM shop_orders WHERE yookassa_id = $1", yookassa_id)
            if not row:
                return {"success": False, "error": "order not found"}
            order = dict(row)
            if status != "succeeded":
                if status == "canceled" and order["status"] != "paid":
                    await conn.execute(
                        "UPDATE shop_orders SET status = 'canceled' WHERE id = $1",
                        order["id"])
                return {"success": True, "paid": False, "status": status,
                        "order_no": order["order_no"]}
            # succeeded. Уведомляем ровно один раз — флаг ставим тем же
            # запросом, что и статус, чтобы параллельный вебхук и опрос со
            # страницы «спасибо» не прислали владельцу два одинаковых заказа.
            updated = await conn.fetchrow("""
                UPDATE shop_orders
                   SET status = 'paid',
                       paid_at = COALESCE(paid_at, NOW()),
                       notified = TRUE
                 WHERE id = $1 AND notified = FALSE
             RETURNING id
            """, order["id"])
        if updated:
            order["status"] = "paid"
            try:
                await _notify(order)
            except Exception as e:
                logger.error(f"shop: notify failed for {order['order_no']}: {e}")
        return {"success": True, "paid": True, "status": "succeeded",
                "order_no": order["order_no"]}

    # Вебхук ЮKassa один на весь проект и живёт в payment_routes. Чтобы он умел
    # отличать заказ от подписки, кладём обработчик в app.state.
    app.state.shop_order_webhook = _mark_paid

    @app.post("/api/shop/order")
    @limiter.limit("10/minute")
    async def create_order(request: Request):
        try:
            data = await request.json()
        except Exception:
            return {"success": False, "error": "invalid JSON"}

        # Honeypot — поле скрыто от людей, его заполняют только боты.
        if (data.get("website") or "").strip():
            return {"success": True, "order_no": "M-0000", "confirmation_url": "/komplekt/"}

        fio = (data.get("fio") or "").strip()[:MAX_FIO]
        phone = _clean_phone((data.get("phone") or "")[:MAX_PHONE])
        email = (data.get("email") or "").strip().lower()[:MAX_EMAIL]
        city = (data.get("city") or "").strip()[:MAX_CITY]
        pvz = (data.get("pvz") or "").strip()[:MAX_PVZ]
        comment = (data.get("comment") or "").strip()[:MAX_COMMENT]

        if len(fio.split()) < 2 or len(fio) < 5:
            return {"success": False, "error": "Укажите фамилию, имя и отчество"}
        if not phone:
            return {"success": False, "error": "Телефон должен быть российским, 11 цифр"}
        if not _valid_email(email):
            return {"success": False, "error": "Проверьте адрес почты — на него придёт чек"}
        if len(pvz) < 8:
            return {"success": False, "error": "Укажите адрес пункта выдачи СДЭК"}

        if not _shop_id() or not _secret_key():
            logger.error("shop: YooKassa credentials not configured")
            return {"success": False, "error": "Оплата временно недоступна, напишите нам"}

        order_no = _order_no()
        return_url = (data.get("return_url")
                      or "https://meysternlp.ru/komplekt/spasibo/")
        if not return_url.startswith("https://meysternlp.ru/"):
            return_url = "https://meysternlp.ru/komplekt/spasibo/"
        return_url = f"{return_url}?order={order_no}"

        payment_data = {
            "amount": {"value": BUNDLE_AMOUNT, "currency": BUNDLE_CURRENCY},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": return_url},
            "description": f"{BUNDLE_TITLE}. Заказ {order_no}",
            "metadata": {"type": "shop_order", "order_no": order_no,
                         "product": BUNDLE_SLUG},
            "receipt": {
                "customer": {"email": email, "phone": phone},
                "items": [{
                    "description": BUNDLE_TITLE[:128],
                    "quantity": "1.00",
                    "amount": {"value": BUNDLE_AMOUNT, "currency": BUNDLE_CURRENCY},
                    "vat_code": 1,
                    "payment_mode": "full_payment",
                    "payment_subject": "commodity",
                }],
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{YOOKASSA_API_URL}/payments",
                    json=payment_data,
                    headers={
                        "Authorization": _auth_header(),
                        # Ключ уникален на заказ: повторная отправка формы
                        # создаёт новый заказ, дубля платежа не будет.
                        "Idempotence-Key": order_no,
                        "Content-Type": "application/json",
                    },
                )
            if r.status_code not in (200, 201):
                logger.error(f"shop: YooKassa {r.status_code} {r.text[:300]}")
                return {"success": False, "error": "Не удалось создать платёж, попробуйте ещё раз"}
            payment = r.json()
        except Exception as e:
            logger.error(f"shop: create payment error: {e}")
            return {"success": False, "error": "Не удалось создать платёж, попробуйте ещё раз"}

        confirmation_url = (payment.get("confirmation") or {}).get("confirmation_url")
        try:
            async with db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO shop_orders
                        (order_no, product, amount, fio, phone, email, city, pvz,
                         comment, status, yookassa_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)
                """, order_no, BUNDLE_SLUG, float(BUNDLE_AMOUNT), fio, phone, email,
                     city or None, pvz, comment or None, payment.get("id"))
        except Exception as e:
            # Платёж уже создан. Терять заказ нельзя — отдаём ссылку на оплату
            # и кричим в лог: данные для отправки придут владельцу из чека.
            logger.error(f"shop: DB insert failed for {order_no}: {e}")

        logger.info(f"shop: order {order_no} created, payment {payment.get('id')}")
        return {"success": True, "order_no": order_no,
                "confirmation_url": confirmation_url}

    @app.post("/api/shop/verify")
    @limiter.limit("30/minute")
    async def verify_order(request: Request):
        """Страница «спасибо» спрашивает статус, пока вебхук не дошёл."""
        try:
            data = await request.json()
        except Exception:
            return {"success": False, "error": "invalid JSON"}
        order_no = (data.get("order_no") or "").strip()[:32]
        if not re.match(r"^M-\d{8}-[A-Z0-9]{4,8}$", order_no):
            return {"success": False, "error": "invalid order_no"}
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT status, yookassa_id FROM shop_orders WHERE order_no = $1",
                order_no)
        if not row:
            return {"success": False, "error": "order not found"}
        if row["status"] == "paid":
            return {"success": True, "paid": True, "status": "paid"}
        if not row["yookassa_id"]:
            return {"success": True, "paid": False, "status": row["status"]}
        return await _mark_paid(row["yookassa_id"])

    return init_orders_table
