# -*- coding: utf-8 -*-
"""Почта приходит там, где человек её и так оставляет.

15.09.2026 (решения владельца):
  • надбавка за регистрацию в первый день убрана — минуты перестали быть
    платой за почту;
  • разбор теста уходит письмом с PDF на адрес, названный на знакомстве;
  • подписка встаёт на аккаунт, а аккаунт заводится самой покупкой.

Импортировать main.py нельзя (БД, Redis, ключи), поэтому эндпоинт
проверяется разбором исходника — как в соседних тестах.
"""
import ast
import os

import pytest

_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_MAIN = os.path.join(_BACKEND, "main.py")
_MAIL = os.path.join(_BACKEND, "email_service.py")


def _src(path):
    return open(path, encoding="utf-8").read()


def test_email_service_can_attach_files():
    """Без вложения письмо бессмысленно: человек ждёт файл, а не ссылку."""
    tree = ast.parse(_src(_MAIL))
    send = None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "send":
            send = node
    assert send is not None, "EmailService.send не найден"
    names = [a.arg for a in send.args.args + send.args.kwonlyargs]
    assert "attachments" in names
    assert "add_attachment" in _src(_MAIL), "вложение не прикладывается к письму"


def test_email_pdf_endpoint_exists_and_falls_back_to_context():
    """Адрес берётся из тела, из контекста или из аккаунта — в этом порядке.

    Человек называет почту на знакомстве, а письмо уходит через пятнадцать
    минут, уже с другого экрана: если бы адрес искался только в теле
    запроса, письмо не ушло бы ни разу.
    """
    src = _src(_MAIN)
    i = src.index('@app.post("/api/test/email-pdf")')
    block = src[i:i + 3400]
    assert "context_repo.get(uid)" in block, "контекст не спрашивается"
    assert "FROM fredi_users WHERE user_id" in block, "аккаунт не спрашивается"
    assert "_build_test_pdf_for_user(uid)" in block
    assert "attachments=[" in block, "файл не прикладывается"
    assert "_issue_pdf_token(uid)" in block, "ссылки-запасного варианта нет"
    # Порядок: тело → контекст → аккаунт.
    assert block.index("data.email") < block.index("context_repo.get(uid)") < \
        block.index("FROM fredi_users WHERE user_id")


def test_no_registration_bonus_on_first_day():
    """Первый день одинаков для всех: регистрация больше не продаётся минутами."""
    import sys
    sys.path.insert(0, _BACKEND)
    import subscription_meter as sm
    anon = sm.daily_limit_minutes(False, first_day=True)
    reg = sm.daily_limit_minutes(True, first_day=True)
    reg_today = sm.daily_limit_minutes(True, first_day=True, registered_today=True)
    assert anon == reg == reg_today == sm.FIRST_CONVERSATION_MINUTES, (anon, reg, reg_today)
