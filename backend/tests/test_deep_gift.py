# -*- coding: utf-8 -*-
"""Первый разбор — в подарок, и ровно один раз.

Зачем тест. Подарок держится на трёх кусках, разнесённых по файлам, и
любой из них молча ломает всю затею:

1. count_deep_analyses считает ВСЕ строки, а не активные. Если считать
   активные, человек, получивший подарок и открывший разбор второй раз
   (save_deep_analysis гасит прошлую строку), получит его снова — и
   платный раздел раздаётся бесплатно всем и навсегда.
2. Исключение в meter_guard_middleware. Без него подарок невыдаваем по
   построению: обещаем его на стене оплаты, то есть человеку с нулём
   минут, а /api/deep-analysis стоит в _METER_AI_REGEX и рубится тем же
   счётчиком. Человек нажимает «получить подарок» и видит стену второй
   раз подряд.
3. Исключение закрывается само. Оно висит на _deep_gift_available, и
   после первой генерации строка в fredi_deep_analyses появляется —
   второй раз этим путём не пройти. Если кто-то заменит проверку на
   что-нибудь вроде «не премиум», дыра откроется навсегда.

Тест текстовый: поднимать FastAPI, БД и Redis ради трёх условий незачем,
а именно эти три строки и ломаются.
"""

import ast
import os
import pathlib
import re

BACKEND = pathlib.Path(__file__).resolve().parents[1]
MAIN = (BACKEND / "main.py").read_text(encoding="utf-8")
REPO = (BACKEND / "repositories" / "user_repo.py").read_text(encoding="utf-8")


def _func(source: str, name: str) -> str:
    """Тело функции по имени — без соседей и без комментариев файла."""
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == name:
            return ast.get_source_segment(source, node) or ""
    raise AssertionError(f"функция {name} не найдена")


def test_gift_counts_every_analysis_not_just_active():
    """Считаем все строки: по is_active подарок выдавался бы повторно."""
    body = _func(REPO, "count_deep_analyses")
    assert "COUNT(*)" in body
    assert "is_active" not in body, (
        "count_deep_analyses смотрит на is_active — подарок будет "
        "выдаваться каждый раз после save_deep_analysis"
    )


def test_gift_available_means_never_had_one():
    """Право на подарок = разборов не было ни разу."""
    body = _func(MAIN, "_deep_gift_available")
    assert "count_deep_analyses" in body
    assert "== 0" in body


def test_gift_failure_does_not_grant():
    """Ошибка подсчёта — это «подарка нет», а не «подарок есть»."""
    repo_body = _func(REPO, "count_deep_analyses")
    # В репозитории при ошибке возвращаем 1 («разборы были»), в main —
    # False. Оба варианта означают «не дарить».
    assert re.search(r"except[\s\S]*return 1", repo_body), (
        "count_deep_analyses при ошибке должен вернуть ненулевое число"
    )
    main_body = _func(MAIN, "_deep_gift_available")
    assert re.search(r"except[\s\S]*return False", main_body)


def test_deep_access_is_premium_or_gift():
    """Доступ к разбору: подписка ИЛИ подарок."""
    body = _func(MAIN, "_deep_access")
    assert "_is_premium_user" in body
    assert "_deep_gift_available" in body


def test_generation_uses_deep_access_not_premium_only():
    """POST /api/deep-analysis пускает и подарочников."""
    body = _func(MAIN, "deep_analysis")
    assert "_deep_access" in body, (
        "генерация снова заперта только на подписку — подарок не выдастся"
    )


def test_saved_analysis_readable_without_subscription():
    """Подаренный разбор читается и после того, как подписки нет.

    Отбирать подаренное нечестно, а сгенерированный текст уже лежит в
    базе и повторное чтение ничего не стоит. Проверяем, что проверка
    доступа стоит ПОСЛЕ чтения сохранённого, а не до него.
    """
    body = _func(MAIN, "get_saved_deep_analysis")
    assert body.index("get_last_deep_analysis") < body.index("_deep_access"), (
        "замок снова стоит раньше чтения — подаренный разбор отберут"
    )


def test_meter_lets_the_gift_through_once():
    """В middleware есть исключение, и оно висит на праве на подарок."""
    body = _func(MAIN, "meter_guard_middleware")
    assert "/api/deep-analysis" in body, (
        "исключения для подарка нет — стена срубит генерацию, которую "
        "мы на этой же стене и пообещали"
    )
    assert "_deep_gift_available" in body, (
        "исключение держится не на праве на подарок — дыра останется "
        "открытой после первой генерации"
    )


def test_gift_status_endpoint_exists():
    """Стене нужна дешёвая ручка статуса, а не вызов генерации."""
    assert re.search(r'@app\.get\("/api/deep-analysis/\{user_id\}/gift"\)', MAIN)
    body = _func(MAIN, "deep_analysis_gift_status")
    for field in ("gift_available", "has_profile", "is_premium"):
        assert field in body, f"ручка статуса не отдаёт {field}"


def test_deep_analysis_still_metered():
    """Путь остаётся платным: исключение точечное, а не снятие счётчика."""
    assert "deep-analysis" in MAIN.split("_METER_AI_REGEX")[1][:1200], (
        "/api/deep-analysis выпал из _METER_AI_REGEX — теперь разбор "
        "бесплатен всем и всегда, а не один раз"
    )


def test_no_strikethrough_price_anywhere():
    """Перечёркнутых цен в продукте нет и быть не должно.

    Владелец 17.09.2026 предложил показать «69 ₽» рядом с зачёркнутыми
    «290 ₽». В продукте 990 ₽ за 30 дней и 69 ₽ за 3 дня — это 33 ₽ в
    день и там, и там: скидки нет, и зачёркнутая цена была бы
    недостоверной рекламой (ст. 5 ФЗ «О рекламе»). Подарок решает ту же
    задачу честно, поэтому фиксируем: цены 290 в коде нет.
    """
    payment = (BACKEND / "payment.py").read_text(encoding="utf-8")
    assert '"990.00"' in payment or "990" in payment
    assert "290" not in re.sub(r"#.*", "", payment), (
        "в тарифах появилась цена 290 — её в продукте не было"
    )
