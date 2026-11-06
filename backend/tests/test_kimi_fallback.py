# -*- coding: utf-8 -*-
"""Kimi — запасная модель Фреди.

Три обещания, которые проверяются:
1. без MOONSHOT_API_KEY сервис выключен, а поведение прежнее (None или заглушка);
2. с ключом Kimi отвечает из тупиков DeepSeek: нет ключа, 401, пустой spare_call;
3. тело запроса и разбор ответа корректны (модель, system-сообщение, пустой ответ).

Сеть не нужна: _post и ask подменяются заглушками.

Запуск: python3 backend/tests/test_kimi_fallback.py
"""
import asyncio
import importlib.util
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DEEPSEEK_API_KEY", "test")

_spec = importlib.util.spec_from_file_location(
    "ai_service_kimi_probe",
    os.path.join(os.path.dirname(__file__), "..", "services", "ai_service.py"))
ai = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ai)

kimi = ai.kimi_service

_ORIG = {
    "is_enabled": kimi.is_enabled,
    "api_key": kimi.api_key,
    "ask": kimi.ask,
    "_post": kimi._post,
}


def _enable():
    kimi.is_enabled = lambda: True
    kimi.api_key = lambda: "test-key"


def _disable():
    kimi.is_enabled = lambda: False
    kimi.api_key = lambda: ""


def _restore():
    for name, fn in _ORIG.items():
        setattr(kimi, name, fn)


def _service(api_key="test"):
    # object.__new__ вместо ai.AIService.__new__: синглтон не трогаем, иначе
    # заглушки одного теста переезжают в соседний (это уже случалось).
    ai.LAST_AI_FAIL.update({"reason": "", "detail": "", "ts": 0, "count": 0})
    svc = object.__new__(ai.AIService)
    svc.api_key = api_key
    svc.base_url = "http://deepseek.invalid"
    svc.cache = None
    svc.last_error = ""
    svc.last_provider = "deepseek"
    svc._deepseek_ok_ts = 0.0
    return svc


class _Resp:
    def __init__(self, status):
        self.status = status

    async def text(self):
        return "unauthorized"

    async def json(self):
        return {}


class _Ctx:
    def __init__(self, resp):
        self.resp = resp

    async def __aenter__(self):
        return self.resp

    async def __aexit__(self, *a):
        return False


class _Session:
    def __init__(self, resp):
        self.resp = resp
        self.calls = 0

    def post(self, *a, **k):
        self.calls += 1
        return _Ctx(self.resp)


def test_disabled_without_key():
    _disable()
    try:
        assert kimi.is_enabled() is False
        assert asyncio.run(kimi.ask("system", "user")) is None
    finally:
        _restore()


def test_body_and_answer():
    _enable()
    seen = {}

    async def fake_post(url, headers, body, timeout):
        seen["url"] = url
        seen["body"] = body
        return 200, {"choices": [{"message": {"content": "Привет от Kimi"}}]}

    kimi._post = fake_post
    try:
        out = asyncio.run(kimi.ask("Ты редактор", "Скажи привет"))
    finally:
        _restore()

    assert out == "Привет от Kimi"
    assert seen["url"].endswith("/chat/completions")
    assert seen["body"]["messages"][0] == {"role": "system", "content": "Ты редактор"}
    assert seen["body"]["messages"][-1] == {"role": "user", "content": "Скажи привет"}
    assert seen["body"]["model"]


def test_http_error_gives_none():
    _enable()

    async def fake_post(url, headers, body, timeout):
        return 401, "bad key"

    kimi._post = fake_post
    try:
        out = asyncio.run(kimi.ask("s", "u"))
        err = kimi.STATE.get("last_error", "")
    finally:
        _restore()

    assert out is None
    assert "401" in err, err


def test_empty_answer_gives_none():
    _enable()

    async def fake_post(url, headers, body, timeout):
        return 200, {"choices": [{"message": {"content": "   "}}]}

    kimi._post = fake_post
    try:
        assert asyncio.run(kimi.ask("s", "u")) is None
    finally:
        _restore()


def test_spare_call_falls_back_to_kimi():
    _enable()
    svc = _service()

    async def deep_none(*a, **k):
        return None

    async def kimi_yes(*a, **k):
        return "Ответ Kimi"

    svc._deepseek_spare = deep_none
    kimi.ask = kimi_yes
    try:
        out = asyncio.run(svc.spare_call("s", "u", 10, 0.5))
    finally:
        _restore()

    assert out == "Ответ Kimi"
    assert svc.last_provider == "kimi"


def test_spare_call_stays_none_without_kimi():
    _disable()
    svc = _service()

    async def deep_none(*a, **k):
        return None

    svc._deepseek_spare = deep_none
    try:
        assert asyncio.run(svc.spare_call("s", "u", 10, 0.5)) is None
    finally:
        _restore()


def test_no_deepseek_key_goes_to_kimi():
    _enable()
    svc = _service(api_key="")

    async def kimi_yes(*a, **k):
        return "Ответ Kimi"

    kimi.ask = kimi_yes
    try:
        out = asyncio.run(svc._call_deepseek("s", "u", max_tokens=10))
    finally:
        _restore()

    assert out == "Ответ Kimi"
    assert svc.last_provider == "kimi"


def test_deepseek_401_goes_to_kimi():
    _enable()
    svc = _service()
    sess = _Session(_Resp(401))

    async def get_session():
        return sess

    async def kimi_yes(*a, **k):
        return "Ответ Kimi"

    svc._get_session = get_session
    kimi.ask = kimi_yes
    try:
        out = asyncio.run(svc._call_deepseek("s", "u", max_tokens=10))
    finally:
        _restore()

    assert out == "Ответ Kimi", out
    assert sess.calls == 1, "на 401 повторять DeepSeek нельзя — сразу запасная модель"


def test_streaming_without_key_yields_kimi():
    _enable()
    svc = _service(api_key="")

    async def kimi_yes(*a, **k):
        return "Привет из Kimi"

    kimi.ask = kimi_yes

    async def collect():
        out = []
        async for d in svc.generate_response_streaming(
                message="Привет", context={}, profile={}, mode="coach",
                system_prompt="s"):
            out.append(d)
        return out

    try:
        out = asyncio.run(collect())
    finally:
        _restore()

    assert "Привет" in "".join(out), out


def test_k3_temperature_is_forced_to_one():
    """K3 — рассуждающая: провайдер принимает только temperature=1 (проверено)."""
    body = kimi.build_body("s", "u", model_name="kimi-k3.1-pro", temperature=0.4)
    assert body["temperature"] == 1.0
    body = kimi.build_body("s", "u", model_name="moonshot-v1-8k", temperature=0.4)
    assert body["temperature"] == 0.4


def test_budget_has_headroom_for_reasoning():
    """При 120 токенах K3 отдаёт пустой content: рассуждение съедает бюджет."""
    assert kimi.build_body("s", "u", max_tokens=200)["max_tokens"] == 1500
    assert kimi.build_body("s", "u", max_tokens=5000)["max_tokens"] == 8000


def test_missing_model_falls_to_next():
    _enable()
    seen = []

    async def fake_post(url, headers, body, timeout):
        seen.append(body["model"])
        if len(seen) == 1:
            return 404, '{"error":{"message":"Not found the model"}}'
        return 200, {"choices": [{"message": {"content": "Ответ со второй модели"},
                                  "finish_reason": "stop"}]}

    kimi._post = fake_post
    try:
        out = asyncio.run(kimi.ask("s", "u"))
    finally:
        _restore()

    assert out == "Ответ со второй модели"
    assert len(seen) == 2, seen


def test_generate_response_uses_two_model_panel():
    """Психолог: DeepSeek и Kimi дали разные ответы → синтез собирает один."""
    _enable()
    svc = _service()
    calls = {"synth": 0}

    async def fake_deepseek(system_prompt, user_prompt, max_tokens=1000,
                            temperature=0.7, **kw):
        if "ОТВЕТ ВТОРОЙ МОДЕЛИ" in (user_prompt or ""):
            calls["synth"] += 1
            return "Итог: режим, свет и экран."
        return "Начни с режима и подъёма в одно время."

    async def kimi_yes(*a, **k):
        calls["kimi_tokens"] = k.get("max_tokens")
        calls["kimi_system"] = a[0] if a else k.get("system_prompt", "")
        return "Добавь утренний свет и убери экран за час до сна."

    svc._call_deepseek = fake_deepseek
    kimi.ask = kimi_yes
    try:
        out = asyncio.run(svc.generate_response(
            user_id=1, message="Как наладить сон?", context={}, profile={},
            mode="psychologist", max_tokens=400))
    finally:
        _restore()

    assert "Итог" in out, out
    assert calls["synth"] == 1, "синтез должен вызваться ровно один раз"
    assert calls["kimi_tokens"] <= 400, "второму мнению хватает короткого бюджета"
    assert "4-6 предложений" in calls["kimi_system"], calls["kimi_system"]


def test_generate_response_streaming_uses_panel():
    _enable()
    svc = _service()

    async def fake_deepseek(system_prompt, user_prompt, max_tokens=1000,
                            temperature=0.7, **kw):
        if "ОТВЕТ ВТОРОЙ МОДЕЛИ" in (user_prompt or ""):
            return "Итог стрима: режим и свет."
        return "Режим и подъём в одно время."

    async def kimi_yes(*a, **k):
        return "Утренний свет помогает просыпаться."

    svc._call_deepseek = fake_deepseek
    kimi.ask = kimi_yes

    async def collect():
        out = []
        async for d in svc.generate_response_streaming(
                message="Как наладить сон?", context={}, profile={},
                mode="coach", system_prompt="s", max_tokens=400):
            out.append(d)
        return "".join(out)

    try:
        text = asyncio.run(collect())
    finally:
        _restore()

    assert "Итог" in text, text


def test_panel_applies_respects_settings():
    """PANEL_MODE=off — панель выключена; heavy — только свои режимы; без Kimi — никогда."""
    old = os.environ.get("PANEL_MODE")
    try:
        _enable()
        svc = _service()
        os.environ["PANEL_MODE"] = "off"
        assert svc.panel_applies("psychologist") is False

        os.environ["PANEL_MODE"] = "heavy"
        assert svc.panel_applies("psychologist") is True
        assert svc.panel_applies("basic") is False

        os.environ["PANEL_MODE"] = "all"
        assert svc.panel_applies("basic") is True

        _disable()
        assert svc.panel_applies("psychologist") is False
    finally:
        _restore()
        if old is None:
            os.environ.pop("PANEL_MODE", None)
        else:
            os.environ["PANEL_MODE"] = old


def test_panel_off_while_deepseek_is_down():
    """DeepSeek упал и ещё не ответил — панель не тратит три запроса впустую."""
    _enable()
    svc = _service()
    ai.LAST_AI_FAIL["ts"] = 100.0
    svc._deepseek_ok_ts = 0.0
    try:
        assert svc.panel_applies("psychologist") is False
        svc._deepseek_ok_ts = 200.0        # успешный ответ вернул панель
        assert svc.panel_applies("psychologist") is True
    finally:
        _restore()


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
