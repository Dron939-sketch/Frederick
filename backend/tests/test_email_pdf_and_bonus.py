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
    block = src[i:i + 7200]
    assert "context_repo.get(uid)" in block, "контекст не спрашивается"
    assert "FROM fredi_users WHERE user_id" in block, "аккаунт не спрашивается"
    assert "_build_test_pdf_for_user(uid)" in block
    assert "attachments=[" in block, "файл не прикладывается"
    assert "_issue_pdf_token(uid)" in block, "ссылки-запасного варианта нет"
    # Порядок: тело → контекст → аккаунт.
    assert block.index("data.email") < block.index("context_repo.get(uid)") < \
        block.index("FROM fredi_users WHERE user_id")


def test_contact_email_is_saved_but_never_overwrites_the_login():
    """Адрес из теста ложится в contact_email, а не в email.

    email — логин аккаунта: он уникален и идёт в паре с password_hash.
    Запись адреса туда без пароля закрыла бы человеку регистрацию — на
    свою же почту он получил бы «email уже занят». А сохранить адрес надо:
    письмо третьего дня иначе не дойдёт ни до кого, кто прошёл тест и ушёл
    без аккаунта, то есть до большинства.
    """
    src = _src(_MAIN)
    i = src.index('@app.post("/api/test/email-pdf")')
    block = src[i:i + 7200]
    assert "SET contact_email = $2" in block
    assert "UPDATE fredi_users SET email" not in block
    assert "ADD COLUMN IF NOT EXISTS contact_email TEXT" in src, "колонки нет в миграциях"


def test_day3_letter_reaches_people_without_an_account():
    """Письмо третьего дня ищет адрес и в contact_email тоже."""
    path = os.path.join(_BACKEND, "services", "reengagement.py")
    src = _src(path)
    assert "COALESCE(u.email, u.contact_email) AS email" in src, "адрес письма берётся только из аккаунта"
    assert "COALESCE(u.email, u.contact_email) IS NOT NULL" in src, "отбор кандидатов d3 не видит contact_email"


def test_no_registration_bonus_on_first_day():
    """Первый день одинаков для всех: регистрация больше не продаётся минутами."""
    import sys
    sys.path.insert(0, _BACKEND)
    import subscription_meter as sm
    anon = sm.daily_limit_minutes(False, first_day=True)
    reg = sm.daily_limit_minutes(True, first_day=True)
    reg_today = sm.daily_limit_minutes(True, first_day=True, registered_today=True)
    assert anon == reg == reg_today == sm.FIRST_CONVERSATION_MINUTES, (anon, reg, reg_today)


def test_letter_invites_to_the_recommended_course():
    """В письме — курс из тех же рекомендаций, что человек видел на экране.

    Названия и адреса курсов не выдумываются: по придуманному имени человек
    ничего не найдёт. Берём первую рекомендацию типа course, а при пустом
    кэше — rule-based запасной набор, чтобы письмо не оставалось без
    приглашения из-за сбоя модели.
    """
    src = _src(_MAIN)
    i = src.index('@app.post("/api/test/email-pdf")')
    block = src[i:i + 7200]
    assert 'it.get("type") == "course"' in block, "курс не выбирается из рекомендаций"
    assert "_get_recommendations_fallback(prof)" in block, "при пустом кэше письмо останется без курса"
    assert "аудиоверсия" in block and "бесплатно, без регистрации" in block
    assert "course_html" in block and "course_text" in block
    # Адрес курса должен стать абсолютным: относительный в письме не кликается.
    assert 'SITE + course["url"]' in block
