# -*- coding: utf-8 -*-
"""Стена оплаты анонимному: одна почта, а не три поля и пин-код.

Выгрузка диалогов 11–17.09.2026: 28 разговоров оборвались на 8–11
минуте — стена по бесплатным минутам, — и все 28 без аккаунта. Из 179
увидевших стену за 30 дней нажали «подписаться» 13. Ровно на этом
экране человеку предлагалось ввести имя, почту, придумать четыре цифры,
зарегистрироваться и уйти в ЮKassa — в момент, когда он только что
дописал «Выбор сохранять ли семью».

Теперь: одна почта. Пин-код придумывает сервер и присылает письмом
вместе со ссылкой «задать свой», имя Фреди спросит в разговоре.

auth_routes тянет FastAPI, argon2 и email_validator — здесь разбираем
исходник, как в остальных тестах на main.py.
"""
import ast
import pathlib
import re

BACKEND = pathlib.Path(__file__).resolve().parents[1]
AUTH = (BACKEND / "auth_routes.py").read_text(encoding="utf-8")
SITE = BACKEND.parent.parent / "dron939-sketch.github.io" / "fredi" / "subscription.js"


def _func(source: str, name: str):
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"функция {name} не найдена")


def _src(name: str) -> str:
    return ast.get_source_segment(AUTH, _func(AUTH, name))


def test_endpoint_exists_with_email_only_model():
    assert re.search(r'@router\.post\("/register-email"\)', AUTH)
    cls = next(n for n in ast.walk(ast.parse(AUTH))
               if isinstance(n, ast.ClassDef) and n.name == "RegisterEmailIn")
    fields = {n.target.id for n in cls.body if isinstance(n, ast.AnnAssign)}
    assert "email" in fields
    assert "name" not in fields and "password" not in fields, (
        "модель одной почты снова просит имя или пин"
    )


def test_pin_is_generated_server_side_and_hashed():
    body = _src("register_email")
    assert "secrets.choice" in body and 'range(4)' in body, "пин не генерируется сервером"
    assert "_hasher.hash(pin)" in body, "пин пишется в базу не хешем"


def test_pin_goes_to_the_person_by_mail_not_to_the_log():
    body = _src("register_email")
    assert "email_service.send(" in body
    assert "Ваш пин-код" in body
    # В строках логирования пина быть не должно — только факт и ссылка.
    for line in body.splitlines():
        if "logger." in line:
            assert "{pin}" not in line, "пин-код попал в лог"


def test_session_is_set_like_regular_register():
    body = _src("register_email")
    assert "_create_session(" in body and "_set_session_cookie(" in body
    assert "email_exists" in body and "409" in body


def test_anonymous_conversation_is_merged_not_lost():
    body = _src("register_email")
    assert "ANON_COOKIE_NAME" in body and "anon_merged" in body, (
        "аноним при регистрации должен сохранить свой разговор"
    )


def test_reset_link_for_own_pin():
    body = _src("register_email")
    assert "fredi_password_resets" in body and "reset_pin=" in body


def test_client_wall_asks_for_email_only():
    if not SITE.exists():
        return  # сайт лежит в другом репозитории; проверка только когда он рядом
    js = SITE.read_text(encoding="utf-8")
    i = js.index("function _accountFieldsHtml")
    j = js.index("async function _ensureAccount")
    block = js[i:j]
    assert 'id="subNameInput"' not in block and 'id="subPinInput"' not in block, (
        "на стене оплаты снова три поля"
    )
    ens = js[j:js.index("function _cardTypeIcon")]
    assert "/api/auth/register-email" in ens
    assert "subPinInput" not in ens
