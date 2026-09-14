# -*- coding: utf-8 -*-
"""Каталог своего: блок собирается только при профиле и не врёт названиями."""
import importlib.util
import os
import re

_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location(
    "arsenal", os.path.join(_HERE, "modes", "prompts", "arsenal.py"))
arsenal = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(arsenal)


def test_no_profile_no_block():
    """Без теста рекомендовать по векторам нечего — каталог не подмешивается."""
    assert arsenal.arsenal_block() == ""


def test_weak_vector_goes_first():
    b = arsenal.arsenal_block("ЧВ", 5, None)
    first = b.index("ЧВ — отношения")
    for other in ("СБ — реакция", "ТФ — добыча", "УБ — понимание"):
        assert first < b.index(other), other


def test_all_four_vectors_present():
    b = arsenal.arsenal_block("СБ", 5, None)
    for v in ("СБ — реакция", "ТФ — добыча", "УБ — понимание", "ЧВ — отношения"):
        assert v in b


def test_level_buckets():
    assert arsenal._level_key(1) == "low"
    assert arsenal._level_key(3) == "low"
    assert arsenal._level_key(4) == "mid"
    assert arsenal._level_key(6) == "mid"
    assert arsenal._level_key(7) == "high"
    assert arsenal._level_key(None) == "mid"
    assert arsenal._level_key("не число") == "mid"


def test_perception_hint_matches_once():
    b = arsenal.arsenal_block("ЧВ", 3, "СТАТУСНО-ОРИЕНТИРОВАННЫЙ")
    assert "Статусно-ориентированному" in b
    assert "Логически ориентированному" not in b


def test_rules_limit_recommendations():
    """Правило «максимум две позиции» — то, ради чего каталог вообще безопасен."""
    b = arsenal.arsenal_block("ТФ", 5, None)
    assert "Максимум две позиции за раз" in b
    assert "Ничего не выдумывай" in b


def test_books_only_on_match():
    b = arsenal.arsenal_block("УБ", 8, None)
    assert "только когда тема прямо совпала" in b


def test_unknown_vector_does_not_crash():
    b = arsenal.arsenal_block("ХХ", 5, None)
    assert "СБ — реакция" in b and "ЧВ — отношения" in b
