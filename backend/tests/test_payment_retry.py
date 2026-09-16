"""Мёртвый платёж из кассы не уходит человеку под видом живого.

16.09.2026 в Метрике: с 14 сентября пять платежей создано, все пятеро
вернулись из платёжной системы, ноль активаций. Ключ идемпотентности
стабилен внутри десятиминутного окна — защита от тройного списания при
дабл-клике. Но человек, у которого на банковской странице не прошло,
возвращается и жмёт «Оформить» снова в пределах тех же десяти минут, и
ЮKassa по тому же ключу отдаёт ТОТ ЖЕ, уже отменённый платёж. Его
confirmation_url уходил на фронт как ни в чём не бывало, и второй попытки
у человека не было.
"""

import asyncio
import sys
import pathlib
import types

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import payment as pay  # noqa: E402


class _Resp:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status
        self.text = str(payload)

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code != 200:
            raise RuntimeError(f"status {self.status_code}")


class _Client:
    """Отдаёт заготовленные ответы по очереди и запоминает ключи."""

    def __init__(self, responses, seen):
        self._responses = list(responses)
        self._seen = seen

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None, headers=None):
        self._seen.append({"key": (headers or {}).get("Idempotence-Key"), "body": json})
        return self._responses.pop(0)


def _service(monkeypatch, responses, seen):
    monkeypatch.setattr(pay, "httpx", types.SimpleNamespace(
        AsyncClient=lambda **kw: _Client(responses, seen),
        HTTPStatusError=Exception,
    ))
    svc = pay.PaymentService(db=None)
    svc.shop_id = "shop"
    svc.secret_key = "secret"
    return svc


class _NoDb:
    """Запись в fredi_payments в этих тестах не проверяется."""

    def get_connection(self):
        class _C:
            async def __aenter__(self_inner):
                class _Conn:
                    async def execute(self_c, *a, **kw):
                        return None
                return _Conn()

            async def __aexit__(self_inner, *a):
                return False
        return _C()


def _live(pid="pay-live"):
    return {"id": pid, "status": "pending",
            "confirmation": {"confirmation_url": "https://kassa/" + pid}}


def _dead(pid="pay-dead"):
    return {"id": pid, "status": "canceled", "confirmation": {}}


def test_canceled_payment_is_not_handed_to_user(monkeypatch):
    """Касса вернула отменённый платёж — просим новый со свежим ключом."""
    seen = []
    svc = _service(monkeypatch, [_Resp(_dead()), _Resp(_live())], seen)
    svc.db = _NoDb()
    out = asyncio.run(svc.create_subscription_payment(
        user_id=1, return_url="https://meysternlp.ru/fredi/",
        customer_email="a@b.ru", plan="trial_week"))
    assert out["success"] is True
    assert out["payment_id"] == "pay-live"
    assert "pay-dead" not in out["confirmation_url"]
    assert len(seen) == 2, "повтор не ушёл"
    assert seen[0]["key"] != seen[1]["key"], "повтор ушёл с тем же ключом"


def test_live_payment_goes_through_without_retry(monkeypatch):
    """Обычный случай не трогаем: один запрос, один платёж."""
    seen = []
    svc = _service(monkeypatch, [_Resp(_live())], seen)
    svc.db = _NoDb()
    out = asyncio.run(svc.create_subscription_payment(
        user_id=1, return_url="https://meysternlp.ru/fredi/",
        customer_email="a@b.ru", plan="monthly"))
    assert out["success"] is True and len(seen) == 1


def test_payment_without_url_is_refused_not_crashed(monkeypatch):
    """Ссылки нет и на второй раз — человек получает внятный текст."""
    seen = []
    svc = _service(monkeypatch, [_Resp(_dead()), _Resp(_dead("pay-dead-2"))], seen)
    svc.db = _NoDb()
    out = asyncio.run(svc.create_subscription_payment(
        user_id=1, return_url="https://meysternlp.ru/fredi/",
        customer_email="a@b.ru", plan="trial_week"))
    assert out["success"] is False
    assert "ссылку на оплату" in out["error"]


def test_retry_keeps_the_body_that_was_accepted(monkeypatch):
    """Если автоплатежи выключены и карта не сохраняется — повтор идёт
    таким же телом, иначе он снова упрётся в «recurring not enabled»."""
    seen = []
    forbidden = _Resp({"code": "forbidden",
                       "description": "This store can't make recurring payments"}, status=403)
    svc = _service(monkeypatch, [forbidden, _Resp(_dead()), _Resp(_live())], seen)
    svc.db = _NoDb()
    out = asyncio.run(svc.create_subscription_payment(
        user_id=1, return_url="https://meysternlp.ru/fredi/",
        customer_email="a@b.ru", plan="trial_week"))
    assert out["success"] is True
    assert "save_payment_method" not in seen[-1]["body"], \
        "повтор вернул сохранение карты, которое магазин не принимает"
