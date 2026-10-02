# -*- coding: utf-8 -*-
"""Фреди знает все наши продукты в любом разговоре, не только после теста.

29.09.2026, владелец: «Фреди должен знать о всех наших продуктах — игры,
книги, курсы в Лектории, тренинги — чтобы при необходимости посоветовать».
Каталог своего (arsenal.py) до этого попадал в промпт только после
большого теста.
"""
import importlib.util
import json
import pathlib

BACKEND = pathlib.Path(__file__).resolve().parents[1]
BASIC = (BACKEND / "modes" / "basic.py").read_text(encoding="utf-8")


def _mod():
    spec = importlib.util.spec_from_file_location("products_probe", BACKEND / "modes" / "prompts" / "products.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def _data(name):
    return json.loads((BACKEND / "data" / name).read_text(encoding="utf-8"))


def test_static_block_lists_everything_from_catalogs():
    block = _mod().static_block()
    prod = _data("products_catalog.json")
    lek = _data("lektorij_catalog.json")["courses"]
    assert len(prod["games"]) >= 30 and prod["books"] and prod["trainings"]
    for g in prod["games"]:
        assert g["name"].replace("«", "„").replace("»", "“") in block, g["name"]
    for b in prod["books"]:
        assert b["title"].split(".")[0] in block
    for t in prod["trainings"]:
        assert t["title"].split(".")[0] in block
    for c in list(lek.values())[:10]:
        assert c["title"] in block
    assert "по подписке" in block and "КАК СОВЕТОВАТЬ НАШЕ" in block


def test_no_nested_guillemets():
    block = _mod().static_block()
    assert "««" not in block and "»»" not in block


def test_topic_block_picks_real_course(monkeypatch):
    import sys
    sys.path.insert(0, str(BACKEND))
    m = _mod()
    tb = m.topic_block("муж меня не слышит, ссоримся каждый вечер")
    titles = {v["title"] for v in _data("lektorij_catalog.json")["courses"].values()}
    assert tb and any(f"«{t}»" in tb for t in titles)
    assert m.topic_block("") == ""


def test_wired_into_basic_mode():
    assert "from .prompts.products import static_block" in BASIC
    assert "from .prompts.products import topic_block" in BASIC


def test_catalog_has_no_second_creator():
    text = (BACKEND / "data" / "products_catalog.json").read_text(encoding="utf-8")
    assert "Соколов" not in text


def test_topic_hint_not_before_sixth_reply():
    """02.10.2026: подсказка «по теме подходит курс» шла с первого хода, и
    65 из 112 советов за три дня пришлись на первые четыре реплики."""
    assert "PRODUCT_HINT_MIN_TURNS = 6" in BASIC
    i = BASIC.index("from .prompts.products import topic_block")
    assert "self._human_turns() >= PRODUCT_HINT_MIN_TURNS" in BASIC[i:i + 400]
    assert "не раньше шестой его реплики" in _mod().RULES
