# -*- coding: utf-8 -*-
"""Возраст при регистрации, и ребёнку подписку не продаём.

Выгрузка диалогов 11–17.09.2026: из 60 человек с известным возрастом
16 младше 18. Среди них 12-летняя с аккаунтом, дважды получившая
шаблон кризиса, и 13-летние на пороге стены оплаты. Возраст спрашивать
не начинали, и счётчик о нём не знал: цену видели все одинаково.

Теперь: регистрация спрашивает возраст (одно число), он лежит в
fredi_user_contexts.age; статус счётчика отдаёт is_minor; три стены
(дневная, общая, апселл) вместо цены показывают честное «минуты
вернутся завтра», опрос «что остановило» ребёнку не задаётся.

Тексты и AST — как в остальных тестах на main.py: поднимать FastAPI и
базу ради четырёх условий незачем.
"""
import ast
import pathlib
import re

BACKEND = pathlib.Path(__file__).resolve().parents[1]
AUTH = (BACKEND / "auth_routes.py").read_text(encoding="utf-8")
METER_PY = (BACKEND / "subscription_meter.py").read_text(encoding="utf-8")
SITE = BACKEND.parent.parent / "dron939-sketch.github.io" / "fredi"


def _cls(source, name):
    for n in ast.walk(ast.parse(source)):
        if isinstance(n, ast.ClassDef) and n.name == name:
            return n
    raise AssertionError(f"класс {name} не найден")


def _func(source, name):
    for n in ast.walk(ast.parse(source)):
        if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef)) and n.name == name:
            return n
    raise AssertionError(f"функция {name} не найдена")


# ───────────── регистрация ─────────────

def test_register_model_accepts_optional_age():
    cls = _cls(AUTH, "RegisterIn")
    ann = {n.target.id: n for n in cls.body if isinstance(n, ast.AnnAssign)}
    assert "age" in ann, "RegisterIn не принимает возраст"
    src = ast.get_source_segment(AUTH, ann["age"])
    assert "Optional[int]" in src and "default=None" in src, (
        "возраст обязан быть необязательным — старые клиенты его не шлют"
    )
    assert "ge=6" in src and "le=120" in src


def test_register_writes_age_into_context_without_erasing_known():
    body = ast.get_source_segment(AUTH, _func(AUTH, "register"))
    assert "fredi_user_contexts (user_id, name, age, updated_at)" in body
    assert "COALESCE(EXCLUDED.age, fredi_user_contexts.age)" in body, (
        "регистрация без возраста не должна затирать уже известный"
    )
    assert "body.age" in body


# ───────────── статус счётчика ─────────────

def test_status_reads_age_from_context():
    body = ast.get_source_segment(METER_PY, _func(METER_PY, "get_user_status"))
    assert "LEFT JOIN fredi_user_contexts" in body and "c.age" in body
    assert "age=row[\"age\"]" in body


def test_status_exposes_is_minor_in_both_branches():
    status_fn = ast.get_source_segment(METER_PY, _func(METER_PY, "get_user_status"))
    compose = ast.get_source_segment(METER_PY, _func(METER_PY, "_compose_status"))
    assert '"is_minor": False' in status_fn, "премиум-ветка без is_minor — фронт получит undefined"
    assert '"is_minor": bool(isinstance(age, int) and age < 18)' in compose
    assert '"age": age' in compose


def test_unknown_age_is_not_a_minor():
    """Старые аккаунты без возраста — взрослые: цену им не прячем."""
    compose = ast.get_source_segment(METER_PY, _func(METER_PY, "_compose_status"))
    assert "isinstance(age, int)" in compose, "None < 18 упал бы или считался ребёнком"


# ───────────── стены на клиенте ─────────────

def test_client_walls_hide_price_for_minors():
    js_path = SITE / "meter.js"
    if not js_path.exists():
        return  # сайт лежит в другом репозитории
    js = js_path.read_text(encoding="utf-8")
    assert "function _minor(check)" in js
    assert "MINOR_NOTE" in js and "Подписка — для взрослых" in js
    # три стены: дневная, общая, апселл
    assert js.count("_minor(data) ? MINOR_NOTE") == 2, "дневная и общая стены"
    assert js.count("_minor(check) ? MINOR_NOTE") == 1, "апселл до блокировки"
    # кнопки могут отсутствовать — обработчики обязаны это пережить
    for var in ("_sbDaily", "_sbWall", "_sbUp"):
        assert re.search(rf"if \({var}\) {var}\.onclick", js), f"обработчик {var} без проверки на null"
    # опрос «что остановило» ребёнку не задаём
    i = js.index("function askWhyNot(source)")
    assert "_minor(_lastCheck)" in js[i:i + 600]


def test_register_form_asks_age():
    js_path = SITE / "login.js"
    if not js_path.exists():
        return
    js = js_path.read_text(encoding="utf-8")
    assert 'id="faAge"' in js and 'min="6"' in js and 'max="120"' in js
    assert "faErrAge" in js and "Возраст — число от 6 до 120" in js
    assert re.search(r"age:\s*\(age >= 6 && age <= 120\) \? age : null", js), (
        "возраст не уходит на сервер"
    )
