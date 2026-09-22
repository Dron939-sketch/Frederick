# -*- coding: utf-8 -*-
"""Письмо второго дня (d1) несёт тест по теме разговора (22.09.2026).

Выгрузка диалогов за 90 дней: у тех, кто пишет своими словами, треть
разговоров про отношения, дальше родители и дети, работа, тревога.
Владелец: в письме на следующий день — тест по интересам человека, с тем,
что он определяет и что дают рекомендации, и с пометкой, что разбор — по
подписке. Тест на сайте открыт, платный только разбор: письмо обязано
говорить именно это, а не «тест по подписке».
"""
import importlib.util
import os
import sys

import pytest

BACKEND = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, BACKEND)


def _load_offer():
    # services/__init__ тянет голосовой стек с numpy — грузим модуль по пути.
    spec = importlib.util.spec_from_file_location(
        "test_offer", os.path.join(BACKEND, "services", "test_offer.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.parametrize("text,key", [
    ("мы с парнем постоянно ссоримся, он меня не слышит", "umenie-lyubit"),
    ("муж общается с другой женщиной и хочет развестись", "umenie-lyubit"),
    ("ревную его к каждой, проверяю телефон", "umenie-lyubit"),  # отношения выше ревности: «его» — про пару
    ("мне тревожно последние недели, не могу уснуть", "gad7"),
    ("нет сил и ничего не хочется", "phq9"),
    ("мне страшно и одиноко", "gad7"),
    ("никому не нужна, нет друзей", "odinochestvo"),
    ("мама постоянно давит и решает за меня", "tip-lichnosti"),
    ("начальник унижает при коллегах, хочу уволиться", "vygoranie"),
    ("привет", "bolshoj"),
    ("", "bolshoj"),
])
def test_pick_test_by_topic(text, key):
    m = _load_offer()
    assert m.pick_test(text)["key"] == key


def test_every_test_has_page_and_texts():
    m = _load_offer()
    for t in m.TESTS + [m.DEFAULT]:
        assert t["url"].startswith("/") and t["url"].endswith("/")
        assert len(t["what"]) > 40 and len(t["gives"]) > 40, t["key"]
        assert "разбор" in t["gives"].lower(), "рекомендации — это разбор, за него и просят подписку"


def test_offer_text_is_honest_about_price_and_access():
    m = _load_offer()
    t = m.pick_test("муж меня не слышит")
    link = m.test_link(t, "d1_tomorrow")
    assert "utm_campaign=d1_tomorrow" in link and "utm_content=test_umenie-lyubit" in link
    assert link.startswith("https://meysternlp.ru/testy/test-na-umenie-lyubit/")
    txt = m.offer_text(t, link)
    assert "Сам тест открыт" in txt, "тест на сайте бесплатный — врать про подписку нельзя"
    assert "разбор результата с рекомендациями — с подпиской" in txt
    from payment import PLANS, TRIAL_PLAN
    amt = str(PLANS[TRIAL_PLAN]["amount"]).split(".")[0]
    assert f"за {amt} ₽" in txt, "цена пробы берётся из PLANS, не пишется руками"
    html = m.offer_html(t, link)
    assert "Пройти тест" in html and link in html and f"за {amt} ₽" in html


def test_d1_letter_wires_offer():
    src = open(os.path.join(BACKEND, "services", "reengagement.py"), encoding="utf-8").read()
    i = src.index("elif campaign == CAMPAIGN_D1:")
    block = src[i:i + 700]
    assert "pick_test(await _recent_user_text(db, user_id))" in block, "тема — из последних реплик, не только последней"
    assert "offer_text(_t, _l)" in block and "offer_html(_t, _l)" in block
    assert 'if campaign == CAMPAIGN_D1:\n        why_html = d1_html' in src, "кнопка теста уходит в HTML-письмо"
    # В HTML текстовая ссылка «Пройти тест: …» дублировала бы кнопку
    assert 'text.split("Есть тест по твоей теме")[0]' in src
