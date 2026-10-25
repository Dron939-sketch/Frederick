"""
order_routes.py — продажа товаров напрямую, мимо Ozon: физических (СДЭК) и
цифровых (аудиозаписи «Ключей» — ссылка после оплаты).

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

# Каталог (20.10.2026). Владелец: «по „Стандартному“ не вести на Ozon,
# брать оплату у себя и отправлять СДЭКом до ближайшего ПВЗ — так мы узнаем
# всё, что нам надо». Ozon не отдаёт, кто купил после перехода с сайта; свой
# заказ показывает всю воронку и даёт почту покупателя. Цена 5 900 ₽ с НДС 22 %
# (владелец 20.10.2026, как товар в «Счетах» ЮKassa), без доставки: доставку
# получатель оплачивает в пункте выдачи по тарифу СДЭК. Сумма в чеке — только
# товар. vat_code — по справочнику ЮKassa: 1 — без НДС, 11 — НДС 22 %.
# С 20.10.2026 у всех товаров НДС 22 % (решение владельца).
PRODUCTS = {
    BUNDLE_SLUG: {
        "amount": BUNDLE_AMOUNT,
        "title": BUNDLE_TITLE,
        "short": "комплекта",
        "letter_name": "Комплект «Разговорный гипноз»: тренинг на QR-карточках с картой "
                       "активации, три книги и три игры «Вариатика».",
        "delivery": "доставка входит в цену",
        "return_url": "https://meysternlp.ru/komplekt/spasibo/",
        "vat_code": 11,
    },
    "standart": {
        "amount": "5900.00",
        "title": "Разговорный гипноз. Пакет «Стандартный»",
        "short": "пакета «Стандартный»",
        "letter_name": "Разговорный гипноз, пакет «Стандартный»: книга «Матчасть» и две схемы, "
                       "доступ к 38 видео на 12 месяцев, блокнот с заданиями, колода игры "
                       "«Маркетолог» и закрытый канал с разбором ваших ситуаций.",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/razgovornyj-gipnoz/standart/spasibo/",
        "vat_code": 11,
    },
    # Книги и игры (25.10.2026). Владелец: «в магазине не нужно ссылок на
    # Ozon, теперь мы сами продаём». Книги по 990 ₽, «Вариатика» по 3 800 ₽,
    # «Маркетолог» 1 200 ₽, «Самостоятельный» 3 200 ₽. Как у «Стандартного»:
    # СДЭК до пункта выдачи, доставку оплачивает получатель, НДС 22 %.
    "kniga-tm": {
        "amount": "990.00",
        "title": "Книга «Теория манипуляции. Разговорный гипноз»",
        "short": "книги «Теория манипуляции»",
        "letter_name": "Книга Андрея Мейстера «Теория манипуляции. Разговорный гипноз».",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
    },
    "kniga-var": {
        "amount": "990.00",
        "title": "Книга «Вариатика. Библиотека человеческих паттернов»",
        "short": "книги «Вариатика»",
        "letter_name": "Книга Андрея Мейстера «Вариатика. Библиотека человеческих паттернов».",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
    },
    "kniga-konc": {
        "amount": "990.00",
        "title": "Книга «Концептикон. Семь линз для ясного мышления»",
        "short": "книги «Концептикон»",
        "letter_name": "Книга Андрея Мейстера «Концептикон. Семь линз для ясного мышления».",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
    },
    "kniga-dep": {
        "amount": "990.00",
        "title": "«Настольная книга депутата»",
        "short": "«Настольной книги депутата»",
        "letter_name": "«Настольная книга депутата», Андрей Мейстер.",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
    },
    "marketolog": {
        "amount": "1200.00",
        "title": "Настольная игра «Маркетолог»",
        "short": "игры «Маркетолог»",
        "letter_name": "Настольная карточная игра «Маркетолог»: три колоды, 2–3 игрока, 16+.",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
    },
    "var-basic": {
        "amount": "3800.00",
        "title": "Настольная игра «Вариатика — Basic»",
        "short": "игры «Вариатика — Basic»",
        "letter_name": "Настольная игра «Вариатика — Basic».",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
    },
    "var-intensive": {
        "amount": "3800.00",
        "title": "Настольная игра «Вариатика — Intensive»",
        "short": "игры «Вариатика — Intensive»",
        "letter_name": "Настольная игра «Вариатика — Intensive».",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
    },
    "var-progressive": {
        "amount": "3800.00",
        "title": "Настольная игра «Вариатика — Progressive»",
        "short": "игры «Вариатика — Progressive»",
        "letter_name": "Настольная игра «Вариатика — Progressive».",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
    },
    "samostoyatelnyy": {
        "amount": "3200.00",
        "title": "Разговорный гипноз. Пакет «Самостоятельный»",
        "short": "пакета «Самостоятельный»",
        "letter_name": "Разговорный гипноз, пакет «Самостоятельный»: 38 видео с приёмами речевого воздействия, без печатного комплекта и разбора.",
        "delivery": "доставку СДЭК вы оплачиваете при получении в пункте выдачи",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
    },
    # Аудиосерия «Ключи» (25.10.2026): 690 ₽ за запись, владелец. Товар
    # цифровой — ни телефона, ни пункта выдачи не нужно, только почта для
    # чека и ссылки. Ссылка на Яндекс Диск выдаётся только после оплаты:
    # репозиторий публичный, поэтому в коде её нет — она в переменной
    # окружения link_env. Нет переменной — покупателю «пришлю в течение дня»,
    # владельцу тревога, деньги не теряются.
    "klyuchi-01": {
        "amount": "690.00",
        "title": "«Ключи». Запись 0.1 «Ум-объяснитель»",
        "short": "записи «Ум-объяснитель»",
        "letter_name": "Аудиосерия «Ключи», запись 0.1 «Ум-объяснитель» — 21 минута.",
        "delivery": "электронная запись",
        "return_url": "https://meysternlp.ru/magazin/klyuchi/spasibo/",
        "vat_code": 11,
        "digital": True,
        "link_env": "KLYUCHI_LINK_01",
        "link_label": "Слушать",
        "care": "Слушайте в наушниках, в спокойной обстановке, не за рулём.",
    },
    # PDF-версии книг (25.10.2026): 690 ₽, владелец — «книги можно купить как
    # в печатном виде, так и в PDF». Ссылки — в переменных окружения, как у «Ключей».
    "kniga-tm-pdf": {
        "amount": "690.00",
        "title": "Книга «Теория манипуляции. Разговорный гипноз» — PDF",
        "short": "PDF книги «Теория манипуляции»",
        "letter_name": "Книга «Теория манипуляции. Разговорный гипноз» — электронная версия в PDF.",
        "delivery": "электронная книга",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
        "digital": True,
        "link_env": "KNIGA_TM_PDF_LINK",
        "link_label": "Открыть книгу",
    },
    "kniga-var-pdf": {
        "amount": "690.00",
        "title": "Книга «Вариатика. Библиотека человеческих паттернов» — PDF",
        "short": "PDF книги «Вариатика»",
        "letter_name": "Книга «Вариатика. Библиотека человеческих паттернов» — электронная версия в PDF.",
        "delivery": "электронная книга",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
        "digital": True,
        "link_env": "KNIGA_VAR_PDF_LINK",
        "link_label": "Открыть книгу",
    },
    "kniga-konc-pdf": {
        "amount": "690.00",
        "title": "Книга «Концептикон. Семь линз для ясного мышления» — PDF",
        "short": "PDF книги «Концептикон»",
        "letter_name": "Книга «Концептикон. Семь линз для ясного мышления» — электронная версия в PDF.",
        "delivery": "электронная книга",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
        "digital": True,
        "link_env": "KNIGA_KONC_PDF_LINK",
        "link_label": "Открыть книгу",
    },
    "kniga-dep-pdf": {
        "amount": "690.00",
        "title": "«Настольная книга депутата» — PDF",
        "short": "PDF «Настольной книги депутата»",
        "letter_name": "«Настольная книга депутата» — электронная версия в PDF.",
        "delivery": "электронная книга",
        "return_url": "https://meysternlp.ru/magazin/spasibo/",
        "vat_code": 11,
        "digital": True,
        "link_env": "KNIGA_DEP_PDF_LINK",
        "link_label": "Открыть книгу",
    },
}


def _digital_link(prod: dict) -> str:
    """Ссылка на цифровой товар — только из окружения и только https."""
    link = (os.environ.get(prod.get("link_env") or "") or "").strip()
    return link if link.startswith("https://") else ""

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
            async with httpx.AsyncClient(timeout=httpx.Timeout(30, connect=6.0),
                                         transport=httpx.AsyncHTTPTransport(retries=3)) as client:
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

    async def _notify_digital(order: dict, prod: dict) -> None:
        """Цифровой товар: покупателю — ссылка, владельцу — факт продажи."""
        link = _digital_link(prod)
        name = (order.get("fio") or "").strip()
        text = (
            f"🎧 Продана {prod['short']}\n\n"
            f"Номер: {order['order_no']}\n"
            f"Сумма: {order['amount']} ₽\n"
            f"Имя: {name or '—'}\n"
            f"Почта: {order['email']}"
        )
        if not link:
            text += (f"\n\n⚠️ Ссылка не задана (переменная {prod.get('link_env')}) — "
                     f"покупатель её не получил, пришлите вручную.")
        if not await _send_to_owner(text):
            await _send_email_to_owner(f"Заказ {order['order_no']} оплачен", text)

        service = _email_service()
        if service is not None and getattr(service, "enabled", False):
            hello = f"{name}, спасибо за покупку." if name else "Спасибо за покупку."
            if link:
                got = (f"{prod.get('link_label', 'Ссылка')}: {link}\n\n"
                       f"Ссылка личная — пожалуйста, не пересылайте её."
                       + (f" {prod['care']}" if prod.get("care") else ""))
            else:
                got = "Ссылку на запись пришлю отдельным письмом в течение дня."
            body = (
                f"{hello}\n\n"
                f"Номер заказа: {order['order_no']}\n"
                f"{prod['letter_name']}\n"
                f"Оплачено: {order['amount']} ₽.\n\n"
                f"{got}\n\n"
                f"Если ссылка не открывается — ответьте на это письмо.\n\n"
                f"Андрей Мейстер\nmeysternlp.ru"
            )
            await service.send(order["email"],
                               f"Заказ {order['order_no']} — {prod['title']}", body)

    async def _notify(order: dict) -> None:
        """Владельцу — данные для отправки, покупателю — подтверждение."""
        prod = PRODUCTS.get(order.get("product") or "", PRODUCTS[BUNDLE_SLUG])
        if prod.get("digital"):
            return await _notify_digital(order, prod)
        text = (
            f"📦 Заказ {prod['short']} оплачен\n\n"
            f"Номер: {order['order_no']}\n"
            f"Сумма: {order['amount']} ₽ ({prod['delivery'].replace('вы оплачиваете', 'оплачивает получатель')})\n\n"
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
                f"{prod['letter_name']}\n"
                f"Оплачено: {order['amount']} ₽, {prod['delivery']}.\n\n"
                f"Пункт выдачи: {order['pvz']}\n\n"
                f"Отправлю посылку СДЭК и пришлю трек-номер этим же письмом. "
                f"Если нужно что-то поправить в адресе — ответьте на это письмо.\n\n"
                f"Андрей Мейстер\nmeysternlp.ru"
            )
            await service.send(order["email"],
                               f"Заказ {order['order_no']} принят — {prod['title']}",
                               body)

    async def _alert_unpaid(order: dict, reason: str) -> None:
        """Оплата не прошла — владельцу контакты, чтобы связаться самому.

        Владелец 20.10.2026: «сделай так, чтобы мне приходило сообщение с
        номером телефона и почтой: если оплата не пройдёт, я смогу связаться
        с человеком». Причин две: платёж не создался (из Майами ЮKassa на
        создании платежа отвечает таймаутом) или банк/человек его отменил.
        Канал тот же, что у оплаченного заказа: Telegram, без него — почта.
        В MAX уходит только сигнал без персональных данных (owner_notify)."""
        prod = PRODUCTS.get(order.get("product") or "", PRODUCTS[BUNDLE_SLUG])
        text = (
            f"⚠️ Заказ {prod['short']}: оплата не прошла — свяжитесь с человеком\n\n"
            f"Причина: {reason}\n"
            f"Номер: {order['order_no']}\n"
            f"Сумма: {order['amount']} ₽\n\n"
            f"ФИО: {order['fio']}\n"
            f"Телефон: {order['phone']}\n"
            f"Почта: {order['email']}\n"
            f"Город: {order.get('city') or '—'}\n"
            f"ПВЗ СДЭК: {order['pvz']}\n"
            f"Комментарий: {order.get('comment') or '—'}"
        )
        try:
            if not await _send_to_owner(text):
                await _send_email_to_owner(f"Заказ {order['order_no']}: оплата не прошла", text)
        except Exception as e:
            logger.error(f"shop: unpaid alert failed for {order['order_no']}: {e}")
        try:
            import owner_notify
            await owner_notify.send_to_owner(
                db, f"⚠️ Заказ {order['order_no']} ({prod['short']}): оплата не прошла. "
                    f"Контакты покупателя — в Telegram или на почте.")
        except Exception as e:
            logger.debug(f"shop: MAX ping skipped: {e}")

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
                alert = False
                if status == "canceled" and order["status"] != "paid":
                    # Сообщение владельцу — один раз: вебхук и опрос со
                    # страницы «спасибо» могут прийти оба.
                    changed = await conn.fetchrow(
                        "UPDATE shop_orders SET status = 'canceled' "
                        "WHERE id = $1 AND status NOT IN ('canceled', 'paid') RETURNING id",
                        order["id"])
                    alert = bool(changed)
                if alert:
                    reason = ((payment.get("cancellation_details") or {}).get("reason")
                              or "платёж отменён")
                    await _alert_unpaid(order, f"ЮKassa отменила платёж ({reason})")
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
        res = {"success": True, "paid": True, "status": "succeeded",
               "order_no": order["order_no"]}
        res.update(_digital_payload(order.get("product")))
        return res

    def _digital_payload(product) -> dict:
        """Странице «спасибо» — ссылка на оплаченную запись.

        Отдаётся только по оплаченному заказу; номер заказа — случайный
        хвост из шести знаков, подобрать чужой нельзя."""
        prod = PRODUCTS.get(product or "") or {}
        if not prod.get("digital"):
            return {}
        link = _digital_link(prod)
        return {"digital": True, "link": link} if link else {"digital": True, "link": ""}

    # Вебхук ЮKassa один на весь проект и живёт в payment_routes. Чтобы он умел
    # отличать заказ от подписки, кладём обработчик в app.state.
    app.state.shop_order_webhook = _mark_paid

    @app.post("/api/shop/order")
    @limiter.limit("10/minute")
    async def create_order(request: Request):
        """Старый адрес — только комплект, поле product не читается.

        Страница комплекта ходит сюда с 2026-09; новые товары идут через
        /api/shop/checkout. Новый адрес, а не поле в старом, нарочно: страница
        «Стандартного» на бэкенде без каталога получит 404, а не платёж на
        19 999 ₽ вместо 5 900."""
        try:
            data = await request.json()
        except Exception:
            return {"success": False, "error": "invalid JSON"}
        return await _create(data, BUNDLE_SLUG)

    @app.post("/api/shop/checkout")
    @limiter.limit("10/minute")
    async def create_checkout(request: Request):
        try:
            data = await request.json()
        except Exception:
            return {"success": False, "error": "invalid JSON"}
        product = (data.get("product") or "").strip()
        if product not in PRODUCTS:
            return {"success": False, "error": "unknown product"}
        return await _create(data, product)

    async def _create(data: dict, product: str):
        prod = PRODUCTS[product]

        # Honeypot — поле скрыто от людей, его заполняют только боты.
        if (data.get("website") or "").strip():
            return {"success": True, "order_no": "M-0000",
                    "confirmation_url": prod["return_url"].rsplit("spasibo/", 1)[0]}

        fio = (data.get("fio") or "").strip()[:MAX_FIO]
        phone = _clean_phone((data.get("phone") or "")[:MAX_PHONE])
        email = (data.get("email") or "").strip().lower()[:MAX_EMAIL]
        city = (data.get("city") or "").strip()[:MAX_CITY]
        pvz = (data.get("pvz") or "").strip()[:MAX_PVZ]
        comment = (data.get("comment") or "").strip()[:MAX_COMMENT]

        digital = bool(prod.get("digital"))
        if digital:
            # Цифровой товар: нужна только почта — на неё чек и ссылка.
            if not _valid_email(email):
                return {"success": False, "error": "Проверьте адрес почты — на него придут чек и ссылка"}
            city, pvz = "", "—"
        else:
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
        return_url = (data.get("return_url") or prod["return_url"])
        if not return_url.startswith("https://meysternlp.ru/"):
            return_url = prod["return_url"]
        return_url = f"{return_url}?order={order_no}"

        payment_data = {
            "amount": {"value": prod["amount"], "currency": BUNDLE_CURRENCY},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": return_url},
            "description": f"{prod['title']}. Заказ {order_no}",
            "metadata": {"type": "shop_order", "order_no": order_no,
                         "product": product},
            "receipt": {
                "customer": ({"email": email, "phone": phone} if phone else {"email": email}),
                "items": [{
                    "description": prod["title"][:128],
                    "quantity": "1.00",
                    "amount": {"value": prod["amount"], "currency": BUNDLE_CURRENCY},
                    "vat_code": prod["vat_code"],
                    "payment_mode": "full_payment",
                    "payment_subject": "service" if digital else "commodity",
                }],
            },
        }

        try:
            # 20 с, а не 30: из Майами создание платежа то отвечает за секунду,
            # то не отвечает вовсе — держать человека полминуты незачем, его
            # заказ всё равно не потеряется (_payment_failed).
            async with httpx.AsyncClient(timeout=httpx.Timeout(20, connect=6.0),
                                         transport=httpx.AsyncHTTPTransport(retries=3)) as client:
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
                return await _payment_failed(order_no, product, prod, fio, phone, email,
                                             city, pvz, comment, f"ЮKassa ответила {r.status_code}")
            payment = r.json()
        except Exception as e:
            logger.error(f"shop: create payment error: {type(e).__name__}: {e}")
            return await _payment_failed(order_no, product, prod, fio, phone, email,
                                         city, pvz, comment,
                                         f"нет ответа от ЮKassa ({type(e).__name__})")

        confirmation_url = (payment.get("confirmation") or {}).get("confirmation_url")
        try:
            async with db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO shop_orders
                        (order_no, product, amount, fio, phone, email, city, pvz,
                         comment, status, yookassa_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)
                """, order_no, product, float(prod["amount"]), fio, phone, email,
                     city or None, pvz, comment or None, payment.get("id"))
        except Exception as e:
            # Платёж уже создан. Терять заказ нельзя — отдаём ссылку на оплату
            # и кричим в лог: данные для отправки придут владельцу из чека.
            logger.error(f"shop: DB insert failed for {order_no}: {e}")

        logger.info(f"shop: order {order_no} created, payment {payment.get('id')}")
        return {"success": True, "order_no": order_no,
                "confirmation_url": confirmation_url}

    async def _payment_failed(order_no, product, prod, fio, phone, email, city, pvz,
                              comment, reason):
        """Платёж не создался. Заказ не теряем: пишем в базу, владельцу —
        контакты, странице — «заказ принят, с вами свяжутся»."""
        order = {"order_no": order_no, "product": product, "amount": float(prod["amount"]),
                 "fio": fio, "phone": phone, "email": email, "city": city,
                 "pvz": pvz, "comment": comment}
        try:
            async with db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO shop_orders
                        (order_no, product, amount, fio, phone, email, city, pvz,
                         comment, status, yookassa_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'payment_failed',NULL)
                """, order_no, product, float(prod["amount"]), fio, phone, email,
                     city or None, pvz, comment or None)
        except Exception as e:
            logger.error(f"shop: DB insert (payment_failed) for {order_no}: {e}")
        await _alert_unpaid(order, reason)
        return {"success": True, "manual": True, "order_no": order_no,
                "message": "Заказ принят, но оплата сейчас не открылась. "
                           "Я свяжусь с вами по телефону или почте и помогу оплатить."}

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
                "SELECT status, yookassa_id, product FROM shop_orders WHERE order_no = $1",
                order_no)
        if not row:
            return {"success": False, "error": "order not found"}
        if row["status"] == "paid":
            res = {"success": True, "paid": True, "status": "paid"}
            res.update(_digital_payload(row["product"]))
            return res
        if not row["yookassa_id"]:
            return {"success": True, "paid": False, "status": row["status"]}
        return await _mark_paid(row["yookassa_id"])

    return init_orders_table
