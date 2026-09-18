# -*- coding: utf-8 -*-
"""Три дефекта у тех, кто готов платить (выгрузка диалогов 11–17.09.2026).

За неделю 381 диалог, 18 человек с аккаунтом — и именно у них, у самых
глубоких разговоров, чаще всего ломалось:

1. Заглушка «технический сбой» — 18 ответов, 13 в режиме коуча, пять на
   ПЕРВОМ ответе человеку. DeepSeek был жив: у других в ту же минуту всё
   работало. Причина — generate_response_streaming (путь коуча, психолога,
   тренера) не выключал размышление модели; оно съедало max_tokens в
   невидимой части, content приходил пустым при коде 200, а цикл повтора
   считал такой поток удачей и не повторял.
2. Замок коуча глотал вопрос: «Посоветуй книгу» — замок, «ничего не
   поняла, что мне делать» — тот же замок трижды. И называл цену
   «первая неделя 290 ₽», которой нет с 15.09.
3. «Вопрос интересный. Расскажите подробнее, пожалуйста.» — заглушка под
   видом ответа из BaseMode.process_question_full. main.py её не узнавал:
   списывал минуты и не извинялся. Получила её женщина с самым длинным
   разговором недели (43 сообщения) и ушла со словами «пустой разговор».

Тесты текстовые там, где поднимать FastAPI и БД незачем, и живые там,
где ломается поведение цикла.
"""
import ast
import asyncio
import importlib.util
import os
import pathlib
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DEEPSEEK_API_KEY", "test")

BACKEND = pathlib.Path(__file__).resolve().parents[1]
MAIN = (BACKEND / "main.py").read_text(encoding="utf-8")
BASE_MODE = (BACKEND / "modes" / "base_mode.py").read_text(encoding="utf-8")
VOICE = (BACKEND / "services" / "voice_service.py").read_text(encoding="utf-8")

_spec = importlib.util.spec_from_file_location(
    "ai_service_probe2", str(BACKEND / "services" / "ai_service.py"))
ai = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ai)

import premium_gate as pg  # noqa: E402


def _func(source: str, name: str):
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"функция {name} не найдена")


# ───────────────────────── 1. размышление и пустой поток ─────────────────────────

def test_streaming_path_disables_thinking():
    """Коуч/психолог/тренер идут через generate_response_streaming —
    там обязан стоять _apply_thinking(data, False), как у basic."""
    fn = _func((BACKEND / "services" / "ai_service.py").read_text(encoding="utf-8"),
               "generate_response_streaming")
    calls = [n for n in ast.walk(fn)
             if isinstance(n, ast.Call) and getattr(n.func, "id", "") == "_apply_thinking"]
    assert calls, "размышление в потоковом пути не выключено — бюджет коуча уйдёт в невидимую часть"
    assert any(isinstance(c.args[1], ast.Constant) and c.args[1].value is False for c in calls), (
        "_apply_thinking вызван, но не с False"
    )


class _Resp:
    def __init__(self, status, lines):
        self.status = status
        self.content = self._gen(lines)

    async def _gen(self, lines):
        for l in lines:
            yield l

    async def text(self):
        return "err"


class _Ctx:
    def __init__(self, resp=None, exc=None):
        self.resp, self.exc = resp, exc

    async def __aenter__(self):
        if self.exc:
            raise self.exc
        return self.resp

    async def __aexit__(self, *a):
        return False


class _Session:
    def __init__(self, plan):
        self.plan = list(plan)
        self.calls = 0

    def post(self, *a, **k):
        self.calls += 1
        return _Ctx(**self.plan.pop(0))


def _service(plan):
    svc = ai.AIService.__new__(ai.AIService)
    for _attr in ("spare_call",):
        svc.__dict__.pop(_attr, None)
    svc.api_key = "test"
    svc.base_url = "http://deepseek.invalid"
    svc.cache = None
    sess = _Session(plan)

    async def get_session():
        return sess

    svc._get_session = get_session
    svc._build_user_facts_block = lambda c, p: ""
    svc._get_user_prompt = lambda m, c, p, mode: m
    return svc, sess


async def _collect(svc):
    out = []
    async for d in svc.generate_response_streaming(message="Привет", context={}, profile={},
                                                   mode="coach", system_prompt="s"):
        out.append(d)
    return out


# Поток с кодом 200, в котором нет ни одной дельты content — ровно так
# выглядит бюджет, съеденный размышлением.
EMPTY_200 = [s.encode("utf-8") for s in (
    'data: {"choices":[{"delta":{"reasoning_content":"думаю..."}}]}\n',
    'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n',
    "data: [DONE]\n")]
OK_LINES = [s.encode("utf-8") for s in (
    'data: {"choices":[{"delta":{"content":"Здравствуй"}}]}\n',
    "data: [DONE]\n")]


def test_empty_200_stream_is_retried_not_stubbed():
    """Пустой «успешный» поток — повод повторить, а не отдать заглушку."""
    svc, sess = _service([{"resp": _Resp(200, EMPTY_200)}, {"resp": _Resp(200, OK_LINES)}])
    out = asyncio.run(_collect(svc))
    assert sess.calls == 2, "пустой поток с кодом 200 не повторён"
    assert "".join(out) == "Здравствуй", out


def test_two_empty_200_streams_go_to_spare_call():
    called = {}

    async def fake_spare(system_prompt, user_prompt, max_tokens, temperature, status=None):
        called["yes"] = True
        return "Ответ дополнительного вызова."

    svc, sess = _service([{"resp": _Resp(200, EMPTY_200)}, {"resp": _Resp(200, EMPTY_200)}])
    svc.spare_call = fake_spare
    out = asyncio.run(_collect(svc))
    assert sess.calls == 2
    assert called.get("yes"), "после двух пустых потоков дополнительный вызов не сделан"
    assert out == ["Ответ дополнительного вызова."], out


# ───────────────────────── 2. замок коуча ─────────────────────────

class _FakeBasic:
    """Обычный Фреди: отвечает на вопрос по делу."""
    def __init__(self):
        self.asked = []

    async def process_question_streaming(self, q):
        self.asked.append(q)
        yield "Книга — "
        yield "«Психология влияния»."


def test_lock_price_is_the_real_one():
    t = pg.lock_text("coach")
    assert "99 ₽" in t and "990" in t
    assert "290" not in t, "в замке снова цена, которой нет в payment.py"
    assert "Пока отвечу" in t, "замок обязан обещать ответ, а не только продавать"


def test_locked_mode_answers_the_question_through_fallback():
    fb = _FakeBasic()
    m = pg.LockedMode("coach", fallback=fb)

    async def collect():
        return [c async for c in m.process_question_streaming("Посоветуй книгу")]

    chunks = asyncio.run(collect())
    text = "".join(chunks)
    assert text.startswith(pg.LOCK_PREFIX), "реплика должна начинаться с замка — по префиксу её не считает счётчик"
    assert pg.is_lock_text(text)
    assert "Психология влияния" in text, "вопрос проглочен — ответа обычного Фреди нет"
    assert fb.asked == ["Посоветуй книгу"]
    assert asyncio.run(m.process_question_full("Посоветуй книгу")).endswith("влияния».")


def test_locked_mode_without_fallback_is_text_only():
    m = pg.LockedMode("trainer")

    async def collect():
        return [c async for c in m.process_question_streaming("ещё")]

    assert asyncio.run(collect()) == [pg.lock_text("trainer")]


def test_locked_mode_survives_broken_fallback():
    class _Broken:
        async def process_question_streaming(self, q):
            raise RuntimeError("boom")
            yield  # noqa

    m = pg.LockedMode("coach", fallback=_Broken())

    async def collect():
        return [c async for c in m.process_question_streaming("q")]

    out = asyncio.run(collect())
    assert out[0] == pg.lock_text("coach"), "сломанный фолбэк не должен ронять замок"


def test_gate_accepts_factory_and_chat_turn_passes_it():
    """Текстовый чат обязан передавать фабрику BasicMode в замок."""
    gate = _func(MAIN, "_premium_gate_instance")
    names = [a.arg for a in gate.args.args + gate.args.kwonlyargs]
    assert "fallback_factory" in names
    prep = ast.get_source_segment(MAIN, _func(MAIN, "_prepare_chat_turn"))
    assert "fallback_factory=" in prep, "_prepare_chat_turn не передаёт фолбэк — замок снова глотает вопрос"
    assert 'get_mode(' in prep and '"basic"' in prep


def test_lock_reply_is_not_counted_as_free_answer():
    """Замок + ответ фолбэка начинается с LOCK_PREFIX → SQL его исключает."""
    fb = _FakeBasic()
    m = pg.LockedMode("coach", fallback=fb)
    text = asyncio.run(m.process_question_full("q"))
    assert text.startswith(pg.LOCK_PREFIX)
    # free_answers_used фильтрует `content NOT LIKE 'Режим «%'` — см. test_premium_gate


# ───────────────────────── 3. заглушка под видом ответа ─────────────────────────

def test_no_answer_shaped_stub_anywhere():
    for src, where in ((BASE_MODE, "base_mode.py"), (VOICE, "voice_service.py")):
        code = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
        assert "Вопрос интересный" not in code, (
            f"{where}: заглушка под видом ответа вернулась — main.py её не узнает"
        )


def test_base_mode_empty_answer_becomes_recognisable_tech_fail():
    fn = ast.get_source_segment(BASE_MODE, _func(BASE_MODE, "process_question_full"))
    assert "tech_fail_reply" in fn, "пустой ответ должен превращаться в узнаваемую заглушку"
