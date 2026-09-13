# -*- coding: utf-8 -*-
"""Потоковый ответ коуча и психолога переживает таймаут и отказ провайдера.

Выгрузка диалогов за 05–12.09.2026: у режима «психолог» 11.09 обрезаны
10 ответов из 33 (человек написал «твои сообщения приходят не полностью»),
у режима «коуч» 14 ответов из 29 — заглушка «технический сбой». Причина —
generate_response_streaming с общим таймаутом 30 с на весь поток, без
повтора, тогда как basic ходит через _call_deepseek_streaming с повтором.
Запасной модели у проекта нет: после повтора — дополнительный вызов
DeepSeek без потока (spare_call).

Запуск: python3 backend/tests/test_streaming_retry.py
"""
import asyncio
import importlib.util
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DEEPSEEK_API_KEY", "test")

_spec = importlib.util.spec_from_file_location(
    "ai_service_probe",
    os.path.join(os.path.dirname(__file__), "..", "services", "ai_service.py"))
ai = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ai)


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
        step = self.plan.pop(0)
        return _Ctx(**step)


def _service(plan):
    svc = ai.AIService.__new__(ai.AIService)
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


async def _collect(svc, **kw):
    out = []
    async for d in svc.generate_response_streaming(message="Привет", context={}, profile={},
                                                   mode="coach", system_prompt="s", **kw):
        out.append(d)
    return out


OK_LINES = [s.encode("utf-8") for s in (
    'data: {"choices":[{"delta":{"content":"Здравствуй"}}]}\n',
    'data: {"choices":[{"delta":{"content":", я здесь."}}]}\n',
    "data: [DONE]\n")]


def test_timeout_then_success_gives_real_answer():
    svc, sess = _service([{"exc": asyncio.TimeoutError()}, {"resp": _Resp(200, OK_LINES)}])
    out = asyncio.run(_collect(svc))
    assert sess.calls == 2, sess.calls
    assert "".join(out).startswith("Здравствуй"), out
    assert "технический сбой" not in "".join(out)


def test_two_failures_use_spare_call():
    """Запасной модели нет (владелец, 13.09.2026): после двух пустых
    потоков — дополнительный вызов DeepSeek без потока."""
    called = {}

    async def fake_spare(system_prompt, user_prompt, max_tokens, temperature, status=None):
        called["yes"] = (system_prompt, user_prompt)
        return "Ответ дополнительного вызова."

    svc, sess = _service([{"resp": _Resp(500, [])}, {"exc": asyncio.TimeoutError()}])
    svc.spare_call = fake_spare
    out = asyncio.run(_collect(svc))
    assert sess.calls == 2
    assert out == ["Ответ дополнительного вызова."], out
    assert called["yes"][1] == "Привет"


def test_spare_call_skips_balance_and_key_errors():
    svc, _ = _service([])
    assert asyncio.run(svc.spare_call("s", "u", 10, 0.5, status=402)) is None
    assert asyncio.run(svc.spare_call("s", "u", 10, 0.5, status=401)) is None
    svc.api_key = ""
    assert asyncio.run(svc.spare_call("s", "u", 10, 0.5)) is None


def test_spare_call_silent_gives_stub_not_crash():
    async def none_spare(*a, **k):
        return None

    svc, sess = _service([{"exc": RuntimeError("boom")}, {"exc": RuntimeError("boom")}])
    svc.spare_call = none_spare
    out = asyncio.run(_collect(svc))
    assert out == [ai.AIService._get_fallback_response(svc, "coach")], out


def test_partial_stream_then_timeout_keeps_text_no_retry():
    class _Cut(_Resp):
        async def _gen(self, lines):
            yield lines[0]
            raise asyncio.TimeoutError()

    svc, sess = _service([{"resp": _Cut(200, OK_LINES)}, {"resp": _Resp(200, OK_LINES)}])
    out = asyncio.run(_collect(svc))
    assert sess.calls == 1, "после полученных дельт повторять нельзя: ответ бы задвоился"
    assert out == ["Здравствуй"], out


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
