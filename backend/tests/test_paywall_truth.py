# -*- coding: utf-8 -*-
"""Что Фреди говорит о бесплатном времени и Лектории — только правда.

Выгрузка 02–09.10.2026 (367 разговоров): 73 анонима из 355 остановились
ровно на стене, и предупреждение о ней прозвучало дважды за неделю —
окно в 2 минуты перепрыгивалось за один ход. Анониму обещали «завтра
продолжишь с этого места», а со второго дня у него 0 минут. Лекторий в 50
ответах назван бесплатным, хотя у 42 курсов лекции 2–10 по подписке.
"""
import ast
import json
import os

HERE = os.path.dirname(__file__)
BASIC = os.path.abspath(os.path.join(HERE, "..", "modes", "basic.py"))
PRODUCTS = os.path.abspath(os.path.join(HERE, "..", "modes", "prompts", "products.py"))
ARSENAL = os.path.abspath(os.path.join(HERE, "..", "modes", "prompts", "arsenal.py"))
CATALOG = os.path.abspath(os.path.join(HERE, "..", "data", "lektorij_catalog.json"))


def _func(path, name):
    src = open(path, encoding="utf-8").read()
    for n in ast.walk(ast.parse(src)):
        if isinstance(n, ast.FunctionDef) and n.name == name:
            return ast.get_source_segment(src, n)
    raise AssertionError(name)


def test_horizon_is_wider_than_one_turn():
    src = open(BASIC, encoding="utf-8").read()
    line = next(l for l in src.splitlines() if l.strip().startswith("HORIZON_MINUTES ="))
    assert float(line.split("=")[1]) >= 4.0, "окно предупреждения должно быть шире одного хода"


def test_anon_is_not_promised_free_tomorrow():
    for name in ("_build_horizon_block", "_build_closing_block"):
        body = _func(BASIC, name)
        assert "без аккаунта завтра бесплатного" in body.replace('"\n', "").replace('                "', ""), name
    pricing = _func(BASIC, "_build_pricing_block")
    code = "\n".join(l for l in pricing.splitlines() if not l.strip().startswith("#"))
    assert "первые минуты каждый день" not in code


def test_lektorij_not_called_free_entirely():
    assert "бесплатен целиком" not in open(ARSENAL, encoding="utf-8").read()
    prod = open(PRODUCTS, encoding="utf-8").read()
    assert "бесплатных курсов лекций" not in prod
    assert "по подписке" in prod


def test_catalog_marks_premium_courses():
    c = json.load(open(CATALOG, encoding="utf-8"))["courses"]
    assert all("premium" in v for v in c.values())
    assert any(v["premium"] for v in c.values()) and not all(v["premium"] for v in c.values())
