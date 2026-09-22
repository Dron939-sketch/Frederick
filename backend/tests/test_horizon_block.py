# -*- coding: utf-8 -*-
"""Фреди сам говорит, что будет дальше, — за пару минут до стены.

Выгрузка диалогов 11–17.09.2026: 28 разговоров оборвались на 8–11
минуте — это стена по бесплатным минутам, и все 28 без аккаунта.
Последние реплики людей перед ней: «Выбор сохранять ли семью», «Я не
хочу терять семью, у меня сын», «мне 45, я думаю, что уже не смогу найти
мужчину». Человек дописал самое трудное — и получил модалку с ценой.
Предупреждал о ней только тост в углу. В 1348 ответах Фреди подписка
упомянута 13 раз, все 13 — робот-замок коуча; сам Фреди не говорил о
ней ни разу.

Блок ЧТО БУДЕТ ДАЛЬШЕ — одна фраза в конце ответа, когда бесплатных
минут осталось мало. Числа берутся из статуса счётчика и тарифов.
"""
import ast
import importlib.util
import os
import pathlib
import sys
import types

BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, BACKEND)
os.environ.setdefault("DEEPSEEK_API_KEY", "test")


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(BACKEND, rel))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# services/__init__ тянет голосовой стек (numpy). Подменяем пакет пустым и
# грузим только ai_service — как в test_dialog_hygiene.
if "services.ai_service" not in sys.modules:
    _services = types.ModuleType("services")
    _services.__path__ = [os.path.join(BACKEND, "services")]
    sys.modules["services"] = _services
    _load("services.ai_service", "services/ai_service.py")
if "modes" not in sys.modules:
    _modes = types.ModuleType("modes")
    _modes.__path__ = [os.path.join(BACKEND, "modes")]
    sys.modules["modes"] = _modes

from modes.basic import BasicMode  # noqa: E402

MAIN = (pathlib.Path(BACKEND) / "main.py").read_text(encoding="utf-8")


def _mode(**user_data):
    b = BasicMode.__new__(BasicMode)
    b.user_data = user_data
    return b


def test_silent_when_plenty_of_time():
    assert _mode(remaining_minutes=7, limit_minutes=10, session_turns=4,
                 is_registered=False)._build_horizon_block() == ""


def test_silent_for_premium():
    assert _mode(is_premium=True, remaining_minutes=1, limit_minutes=10,
                 session_turns=4)._build_horizon_block() == ""


def test_silent_when_status_unknown():
    """Нет данных счётчика — молчим, а не выдумываем минуты."""
    assert _mode(session_turns=4)._build_horizon_block() == ""
    assert _mode(remaining_minutes=None, session_turns=4)._build_horizon_block() == ""


def test_silent_on_first_turns():
    """Первую-вторую реплику не трогаем: человек ещё не увидел, за что платить."""
    assert _mode(remaining_minutes=1.5, limit_minutes=10, session_turns=0,
                 is_registered=False)._build_horizon_block() == ""
    assert _mode(remaining_minutes=1.5, limit_minutes=10, session_turns=1,
                 is_registered=False)._build_horizon_block() == ""


def test_silent_after_the_wall():
    """Ноль минут — это уже стена, а не «скоро»."""
    assert _mode(remaining_minutes=0, limit_minutes=10, session_turns=4,
                 is_registered=False)._build_horizon_block() == ""


def test_anonymous_hears_account_and_trial():
    t = _mode(remaining_minutes=1.6, limit_minutes=10, session_turns=4,
              is_registered=False)._build_horizon_block()
    assert t.startswith("ЧТО БУДЕТ ДАЛЬШЕ")
    assert "через 2 мин" in t
    assert "аккаунт" in t and "четыре цифры" in t, "анониму — как сохранить разговор"
    assert "69 ₽" in t, "цена пробы из payment.py"
    assert "без давления" in t


def test_registered_hears_saved_and_trial_only():
    t = _mode(remaining_minutes=1.0, limit_minutes=10, session_turns=4,
              is_registered=True)._build_horizon_block()
    assert "сохранён" in t
    assert "четыре цифры" not in t, "у зарегистрированного аккаунт уже есть"
    assert "69 ₽" in t


def test_threshold_scales_with_small_limit():
    """Анониму с дневными 3 минутами порог — треть лимита, не 2 минуты:
    иначе предупреждение пришло бы на первом же ответе."""
    assert _mode(remaining_minutes=1.5, limit_minutes=3, session_turns=4,
                 is_registered=False)._build_horizon_block() == ""
    assert _mode(remaining_minutes=0.9, limit_minutes=3, session_turns=4,
                 is_registered=False)._build_horizon_block() != ""


def test_price_comes_from_payment_plans():
    """Цена не вписана руками: если тариф поменяют, промпт поменяется сам."""
    from payment import PLANS, TRIAL_PLAN
    amt = str(PLANS[TRIAL_PLAN]["amount"]).split(".")[0]
    t = _mode(remaining_minutes=1.0, limit_minutes=10, session_turns=4,
              is_registered=True)._build_horizon_block()
    assert f"{amt} ₽" in t


def test_session_meta_carries_meter_status():
    """main._session_meta обязан класть в user_data остаток минут —
    иначе блок молчит всегда (см. test_silent_when_status_unknown)."""
    tree = ast.parse(MAIN)
    fn = next(n for n in ast.walk(tree)
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "_session_meta")
    src = ast.get_source_segment(MAIN, fn)
    for key in ("remaining_minutes", "limit_minutes", "is_premium"):
        assert f'"{key}"' in src, f"_session_meta не отдаёт {key}"
    assert "get_user_status" in src


def test_horizon_wired_after_closing_and_not_together():
    """Блок стоит в сборке промпта и не дублирует ритуал завершения."""
    src = (pathlib.Path(BACKEND) / "modes" / "basic.py").read_text(encoding="utf-8")
    i = src.index("closing = self._build_closing_block()")
    j = src.index("horizon = self._build_horizon_block()")
    assert i < j
    assert "if not closing:" in src[i:j + 200], (
        "ритуал завершения и «что будет дальше» в одном ответе — два раза про завтра"
    )
