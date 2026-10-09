# -*- coding: utf-8 -*-
"""Кризисная линия: какой номер, когда повторять, что считать планом.

Выгрузка 02–09.10.2026: 28 разговоров о желании умереть из 367. Школьник
(«в классе нет друзей», «буллинг», «завтра повешусь») получал взрослую
московскую линию МЧС — возраста в профиле у анонима нет, а номер
выбирался только по нему. Одна и та же кризисная реплика пришла ему
дважды за шестнадцать минут: флаг «уже сказано» жил в user_data, который
собирается заново на каждый запрос. На «завтра повешусь» он восемь раз
получал «звонить прямо сейчас никто не заставляет».
"""
import importlib.util
import os

_R = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "modes", "prompts",
                                  "psychologist", "router.py"))
_B = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "modes", "basic.py"))
_spec = importlib.util.spec_from_file_location("router_t", _R)
r = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(r)


def test_markers_from_real_dialogs():
    for t in ("а ещё я хочу завтра повесится", "Как убится",
              "выпить таблеток и уснуть навсегда никто даже и не будет переживать"):
        assert r.has_crisis_marker(t), t


def test_plan_needs_method_time_and_self():
    assert r.has_high_risk_plan("я хочу завтра повесится")
    assert r.has_high_risk_plan("завтра выпью все таблетки", ["хочу умереть"])
    assert not r.has_high_risk_plan("Хочу умереть")
    assert not r.has_high_risk_plan("Повесить полку на стену завтра")
    assert not r.has_high_risk_plan("Выпью таблетку от головы сегодня")


def test_line_by_age_and_words():
    assert "2000-122" in r.crisis_line(16, ["x"]) and "989" not in r.crisis_line(16, ["x"])
    assert "989" in r.crisis_line(40, ["я учитель"]) and "2000-122" not in r.crisis_line(40, ["я учитель"])
    kid = r.crisis_line(None, ["у меня в классе нет друзей"])
    assert kid.index("2000-122") < kid.index("989"), "школьнику детская линия первой"
    adult = r.crisis_line(None, ["муж ушёл"])
    assert adult.index("989") < adult.index("2000-122"), "без возраста — обе линии"


def test_not_repeated_by_history():
    hist = [{"role": "assistant", "content": "МЧС 8-495-989-50-50"}]
    assert r.crisis_already_given(hist)
    assert not r.crisis_already_given([{"role": "user", "content": "8-495-989-50-50"}])

    class M:
        pass
    m = M(); m.user_data = {}; m.history = hist; m.age = None
    assert r.crisis_reply(m, "хочу умереть") is None


def test_shared_notice_has_no_fixed_child_line():
    """Коуч и Тренер тоже выбирают номер, а не дают всем детскую линию."""
    assert "{line}" in r.CRISIS_NOTICE and "2000-122" not in r.CRISIS_NOTICE


def test_basic_text_is_gender_neutral_and_plan_is_urgent():
    src = open(_B, encoding="utf-8").read()
    i = src.index("if _high:")
    j = src.index("self.conversation_history.append", i)
    block = src[i:j]
    assert "что сказал" not in block, "род собеседника неизвестен"
    assert "HIGH_RISK_MARK" in block
    assert "никто не заставляет" in block.split("else:")[1], "мягкая форма — только без плана"
    assert "никто не заставляет" not in block.split("else:")[0]
