# -*- coding: utf-8 -*-
"""«Семь дней по теме»: подбор курса, промпт, разбор плана, счёт дней.

Проверяется чистая часть week_plan.py: каталог читается и в нём нет
курсов без лекций; правила подбора те же, что на сайте; разбор ответа
модели отбрасывает неполный план целиком (шесть дней — не план), адреса
лекций берутся из каталога, а не из ответа; день плана не убегает
вперёд невыполненного.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import week_plan as wp  # noqa: E402

NOW = datetime(2026, 9, 25, 12, 0, tzinfo=timezone.utc)


def test_catalog_is_real_and_complete():
    c = wp.catalog()
    assert len(c["courses"]) >= 90 and len(c["rules"]) >= 80
    for slug, course in c["courses"].items():
        assert course["lectures"], slug
        assert course["url"] == f"/blog/lektorij/{slug}/"
        for l in course["lectures"]:
            assert l["url"].startswith("/blog/lekciya-") and l["title"]
    assert "lichnye-granicy" in c["courses"] and "trevoga" in c["courses"]


def test_rules_pick_same_course_as_site():
    assert wp.pick_course_by_rules("тревога на работе, начальник орёт") == "trevoga"
    assert wp.pick_course_by_rules("низкая самооценка") == "samoocenka"
    assert wp.pick_course_by_rules("ребёнок не слушается") in ("razvitie-rebenka", "roditelstvo",
                                                                "stimulnyj-kontrol-dlya-roditelej")
    assert wp.pick_course_by_rules("") is None
    assert wp.pick_course_by_rules("абракадабра без темы") is None


def test_choose_course_prompt_lists_only_real_slugs():
    system, user = wp.choose_course_prompt("измена")
    assert "JSON" in system and "измена" in user
    for line in user.split("\n")[3:]:
        slug = line.split(" — ")[0]
        assert slug in wp.catalog()["courses"], line
    assert wp.parse_course_choice('{"slug": "trevoga"}') == "trevoga"
    assert wp.parse_course_choice('{"slug": "vydumannyj-kurs"}') is None
    assert wp.parse_course_choice('{"slug": null}') is None
    assert wp.parse_course_choice("не json") is None


def test_plan_prompt_grounds_on_lectures():
    system, user = wp.plan_prompt("не могу отказать маме", "lichnye-granicy", "Аня")
    assert "JSON" in system and "ровно 7" in system and "три минуты" in system
    assert "Личные границы" in user and "Имя: Аня" in user
    assert "https://meysternlp.ru/blog/lekciya-granicy-1-chto-takoe.html" in user


def _model_answer(n=7, lecture=1):
    return json.dumps({
        "title": "Неделя границ",
        "days": [{"day": i, "title": f"День {i}", "action": "Скажите одну фразу маме вечером: «я перезвоню завтра».",
                  "lecture": lecture} for i in range(1, n + 1)],
    }, ensure_ascii=False)


def test_parse_plan_takes_urls_from_catalog():
    plan = wp.parse_plan("вот план:\n" + _model_answer(), "lichnye-granicy")
    assert plan and len(plan["days"]) == 7
    assert plan["course_url"] == "https://meysternlp.ru/blog/lektorij/lichnye-granicy/"
    d = plan["days"][0]
    assert d["lecture_url"] == "https://meysternlp.ru/blog/lekciya-granicy-1-chto-takoe.html"
    assert d["lecture_title"] == "Что такое личные границы и зачем они нужны"
    assert plan["days"][6]["day"] == 7


def test_parse_plan_rejects_partial_or_broken():
    assert wp.parse_plan(_model_answer(6), "lichnye-granicy") is None
    assert wp.parse_plan("{", "lichnye-granicy") is None
    assert wp.parse_plan(_model_answer(), "net-takogo-kursa") is None
    # Номер лекции, которого нет, — шаг остаётся, ссылки нет.
    plan = wp.parse_plan(_model_answer(lecture=99), "lichnye-granicy")
    assert plan and plan["days"][0]["lecture_url"] is None
    short = json.loads(_model_answer())
    short["days"][2]["action"] = "ок"
    assert wp.parse_plan(json.dumps(short, ensure_ascii=False), "lichnye-granicy") is None


def test_current_day_waits_for_undone_day():
    start = NOW - timedelta(days=3)
    assert wp.current_day(start, NOW, {}) == 1, "ничего не сделано — всё ещё первый день"
    assert wp.current_day(start, NOW, {"1": True, "2": True, "3": True}) == 4
    assert wp.current_day(start, NOW, {"1": True, "2": True, "3": True, "4": True}) == 4, "вперёд календаря не уходит"
    assert wp.current_day(NOW - timedelta(days=30), NOW, {str(i): True for i in range(1, 8)}) == 7
    assert wp.current_day(NOW, NOW, {}) == 1


def test_public_view_shape():
    plan = wp.parse_plan(_model_answer(), "lichnye-granicy")
    v = wp.public_view(plan, NOW - timedelta(days=1), NOW, {"1": True})
    assert v["day"] == 2 and v["days_total"] == 7 and v["done_days"] == [1]
    assert v["today"]["day"] == 2 and v["finished"] is False and v["active"] is True
