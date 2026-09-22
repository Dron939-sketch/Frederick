# -*- coding: utf-8 -*-
"""Цена и срок пробного тарифа — в одном месте.

15.09.2026 проба стала стоить 99 ₽ за три дня вместо 290 ₽ за неделю,
22.09.2026 цена снижена до 69 ₽
(решение владельца: «возможно, это дорого для кого-то»). Тариф правился
в шести файлах, и место, где срок был вписан числом мимо PLANS, уже
находилось: в /api/payment/plans стояло days=7 руками — при смене срока
фронт продолжал бы обещать неделю, пока оплаченный доступ кончался на
третий день.

Поэтому тест держит две вещи: сами значения тарифа и то, что срок в
ответе API берётся из PLANS, а не вписан рядом.
"""
import ast
import os
import re

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_PAYMENT = os.path.join(_ROOT, "payment.py")


def _plans():
    """PLANS из payment.py разбором исходника: импорт тянет БД и ЮKassa."""
    src = open(_PAYMENT, encoding="utf-8").read()
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") == "PLANS":
            return ast.literal_eval(
                ast.Expression(body=_resolve(node.value, src)), )
    raise AssertionError("PLANS в payment.py не найден")


def _resolve(node, src):
    """f-строки и имена внутри PLANS нам не нужны — обнуляем их до ''."""
    for sub in ast.walk(node):
        for field, value in list(ast.iter_fields(sub)):
            if isinstance(value, (ast.JoinedStr, ast.Name)):
                setattr(sub, field, ast.Constant(value=""))
            elif isinstance(value, list):
                setattr(sub, field, [
                    ast.Constant(value="") if isinstance(v, (ast.JoinedStr, ast.Name)) else v
                    for v in value
                ])
    return node


def test_trial_is_99_for_3_days():
    trial = _plans()["trial_week"]
    assert trial["amount"] == "69.00", "цена пробы задаётся здесь и нигде больше"
    assert trial["days"] == 3
    assert "69" in trial["title"] and "3 дня" in trial["title"], (
        "название тарифа уходит в чек ЮKassa — в нём должны стоять реальные "
        "цена и срок"
    )


def test_api_takes_trial_days_from_plans():
    """Срок в /api/payment/plans не вписывается числом рядом."""
    src = open(_PAYMENT, encoding="utf-8").read()
    i = src.index('"trial_week": {"amount": PLANS["trial_week"]["amount"]')
    block = src[i:i + 260]
    assert 'PLANS["trial_week"]["days"]' in block, (
        "days обязан браться из PLANS: вписанное рядом число разъезжается "
        "с реальным сроком оплаченного доступа"
    )
    assert not re.search(r'"days":\s*\d', block), "срок вписан числом мимо PLANS"


def test_trial_plan_key_kept():
    """Ключ тарифа не переименовывать: он лежит в БД и в ссылках."""
    src = open(_PAYMENT, encoding="utf-8").read()
    assert 'TRIAL_PLAN = "trial_week"' in src
