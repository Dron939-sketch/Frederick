# -*- coding: utf-8 -*-
"""После конца подписки бесплатных минут нет (05.10.2026, решение владельца).

Проба продаётся один раз. Раньше человек с аккаунтом после пробы получал
пять минут в день и стену «завтра снова минуты» — бесплатную версию
вместо месяца. Теперь любая кончившаяся подписка даёт лимит ноль, причину
'expired' и закрытый голос; фронт по этой причине рисует стену с одной
дорогой — 690 ₽ в месяц.

Запуск: python3 -m pytest -q backend/tests/test_expired_wall.py
"""
import importlib.util
import pathlib

BACKEND = pathlib.Path(__file__).resolve().parents[1]
METER = (BACKEND / "subscription_meter.py").read_text(encoding="utf-8")
SITE_METER = pathlib.Path("/home/user/dron939-sketch.github.io/fredi/meter.js")


def _meter_class():
    spec = importlib.util.spec_from_file_location("meter_probe", BACKEND / "subscription_meter.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_expired_subscription_has_no_free_minutes():
    m = _meter_class()
    meter = m.SubscriptionMeter(db=None)
    # давний аккаунт, который сегодня ещё ничего не потратил
    s = meter._compose_status(used_seconds=0, free_days_used=3, total_seconds=5000,
                              registered=True, had_subscription=True)
    assert s["can_send"] is False
    assert s["block_reason"] == "expired"
    assert s["limit_minutes"] == 0 and s["remaining_today_minutes"] == 0
    assert s["voice_allowed"] is False and s["trial_exhausted"] is True
    # без подписки в прошлом — как раньше: пять минут аккаунту
    s2 = meter._compose_status(used_seconds=0, free_days_used=3, total_seconds=5000,
                               registered=True, had_subscription=False)
    assert s2["can_send"] is True and s2["block_reason"] is None


def test_expired_beats_auth_for_phone_only_payers():
    m = _meter_class()
    meter = m.SubscriptionMeter(db=None)
    s = meter._compose_status(used_seconds=0, free_days_used=3, total_seconds=5000,
                              registered=False, had_subscription=True)
    assert s["block_reason"] == "expired", "кто платил, тому не предлагать аккаунт за минуты"


def test_status_path_checks_past_subscriptions():
    i = METER.index("async def get_user_status")
    block = METER[i:METER.index("async def _has_active_week_plan")]
    assert "had_subscription = await self._had_subscription(user_id)" in block
    assert "had_subscription=had_subscription" in block
    assert "FROM fredi_subscriptions WHERE user_id = $1 LIMIT 1" in METER


def test_site_wall_knows_expired():
    if not SITE_METER.exists():
        return
    js = SITE_METER.read_text(encoding="utf-8")
    assert "data.block_reason === 'expired'" in js
    assert "690 ₽ в месяц" in js
    i = js.index("if (expired) {")
    seg = js[i:i + 900]
    assert "69" not in seg.replace("690", ""), "на стене после пробы 69 ₽ быть не должно"
    assert "meterTimer" not in seg
