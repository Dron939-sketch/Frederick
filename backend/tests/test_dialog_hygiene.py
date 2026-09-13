# -*- coding: utf-8 -*-
"""Правки по выгрузке диалогов 06–13.09.2026 (815 разговоров, 133 живых).

1. Текущая реплика попадала в промпт дважды — в «Историю» и как вопрос, —
   и модель отвечала «ты второй раз пишешь одно и то же» людям, которые
   написали один раз.
2. Заглушка любого режима — честное «технический сбой», а не «Я с вами.
   Расскажите подробнее» под видом ответа.
3. Заглушки не считаются бесплатными ответами коуча и тренера.
4. В пресете базового режима больше нет списка обязательных открывашек
   («Так стоп», «О, ловлю тебя», «Спорим»): они были в каждом
   четвёртом ответе недели.
5. Кризисный текст без «сказал(а)».

Запуск: python3 backend/tests/test_dialog_hygiene.py
"""
import asyncio
import importlib.util
import os
import sys
import types

BACKEND = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, BACKEND)
os.environ.setdefault("DEEPSEEK_API_KEY", "test")


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(BACKEND, rel))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# services/__init__ тянет голосовой стек (numpy). Подменяем пакет пустым и
# грузим только ai_service — как в test_streaming_retry.
_services = types.ModuleType("services")
_services.__path__ = [os.path.join(BACKEND, "services")]
sys.modules["services"] = _services
ai = _load("services.ai_service", "services/ai_service.py")

_modes = types.ModuleType("modes")
_modes.__path__ = [os.path.join(BACKEND, "modes")]
sys.modules["modes"] = _modes

import premium_gate as pg  # noqa: E402
from modes.basic import BasicMode  # noqa: E402
from modes.prompts.basic_presets import get_preset_text  # noqa: E402


def _basic():
    b = BasicMode.__new__(BasicMode)
    b.conversation_history = []
    return b


def test_current_question_is_not_in_history_block():
    b = _basic()
    b.conversation_history = ["Пользователь: а где список", "Фреди: вот список",
                              "Пользователь: да"]
    assert b._session_lines("да") == ["Пользователь: а где список", "Фреди: вот список"]
    # Реплика, которой в сессии нет, ничего не срезает.
    assert b._session_lines("нет") == b.conversation_history
    # Пусто — пусто.
    assert _basic()._session_lines("да") == []


def test_fallback_of_every_mode_is_an_honest_tech_fail():
    svc = ai.AIService.__new__(ai.AIService)
    for mode in ("basic", "coach", "psychologist", "trainer", "unknown"):
        t = svc._get_fallback_response(mode)
        assert ai.is_tech_fail(t), (mode, t)
        assert "Расскажите подробнее" not in t


class FakeDB:
    def __init__(self, n=0):
        self.n, self.calls = n, []

    async def fetchrow(self, sql, *args):
        self.calls.append((" ".join(sql.split()), args))
        return {"n": self.n}


def test_tech_fails_do_not_count_as_free_answers():
    db = FakeDB(n=1)
    used = asyncio.run(pg.free_answers_used(db, 7))
    assert used == 1
    sql, args = db.calls[0]
    assert "NOT (btrim(content) = ANY($4::text[]))" in sql
    fails = args[3]
    assert ai.TECH_FAIL_REPLY.strip() in fails
    assert ai.TECH_FAIL_AGAIN.strip() in fails
    assert ai.TECH_FAIL_LONG.strip() in fails
    assert args[2] == pg.LOCK_PREFIX + "%"


def test_preset_has_no_mandatory_openers():
    p = get_preset_text("current")
    assert "Начинай с: «Спорим»" not in p
    for opener in ("Так стоп", "О, ловлю тебя", "Спорим"):
        assert opener in p, "открывашка должна быть названа как запрещённая"
    assert "ПРЯМОЙ ВОПРОС — ПРЯМОЙ ОТВЕТ" in p
    assert "КОРОТКОЕ «ДА», «ОК», «ДАВАЙ»" in p
    assert "Запомни одно. Прямо сейчас.»" in p and "Начни с:\n  «Запомни одно" not in p


def test_crisis_text_is_not_gendered_with_brackets():
    src = open(os.path.join(BACKEND, "modes", "basic.py"), encoding="utf-8").read()
    assert "сказал(а)" not in src


def test_user_block_agrees_gender_and_limits_name():
    b = _basic()
    b.user_name, b.gender, b.age = "Елена", "female", 52
    block = b._build_user_block()
    assert "женским родом" in block and "ты сама" in block
    assert "каждом третьем-четвёртом" in block
    b.gender = "male"
    assert "мужским родом" in b._build_user_block()
    b.gender = None
    assert "родом" not in b._build_user_block()


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
