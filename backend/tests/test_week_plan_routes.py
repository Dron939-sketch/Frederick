# -*- coding: utf-8 -*-
"""«Семь дней по теме» на трубах плана навыка.

Проверяется: преобразование плана в форму fredi_skill_plans и обратно;
тема последнего захода из ленты сообщений; признак активного плана;
планировщик skill_notify считает дни по days_total и молчит после
конца; напоминания return_nudge не догоняют тех, кому уже пишет
планировщик; ручки зарегистрированы и подключены в main.py.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import week_plan as wp  # noqa: E402
import week_plan_routes as wr  # noqa: E402

BACKEND = os.path.join(os.path.dirname(__file__), "..")
NOW = datetime(2026, 9, 25, 12, 0, tzinfo=timezone.utc)


def _plan():
    raw = json.dumps({"title": "Неделя границ", "days": [
        {"day": i, "title": f"Шаг {i}", "action": "Скажите одну фразу маме вечером: «я перезвоню завтра».",
         "lecture": 1} for i in range(1, 8)]}, ensure_ascii=False)
    return wp.parse_plan(raw, "lichnye-granicy")


def test_to_skill_plan_and_back():
    sp = wp.to_skill_plan(_plan(), "не могу отказать маме")
    assert sp["kind"] == "week_topic" and sp["days_total"] == 7
    ex = sp["weeks"][0]["exercises"]
    assert len(ex) == 7 and ex[0]["day"] == 1 and ex[0]["dur"] == "3 мин"
    assert "Лекция к шагу" in ex[0]["inst"] and "https://meysternlp.ru/blog/lekciya-granicy-1" in ex[0]["inst"]
    view = wp.view_from_skill_row(sp, [1, 2], NOW - timedelta(days=2), NOW)
    assert view["day"] == 3 and view["done_days"] == [1, 2] and view["topic"] == "не могу отказать маме"
    assert view["today"]["action"].startswith("Скажите одну фразу") and "Лекция к шагу" not in view["today"]["action"]
    assert view["today"]["lecture_url"].endswith("lekciya-granicy-1-chto-takoe.html")
    # Строки-JSON и days_done строками — как отдаёт asyncpg.
    assert wp.view_from_skill_row(json.loads(json.dumps(sp)), ["1"], NOW, NOW)["done_days"] == [1]
    # План навыка (21 день) — не наш, клиенту «неактивно».
    assert wp.view_from_skill_row({"weeks": [{"exercises": []}]}, [], NOW, NOW) is None


def _msg(role, content, minutes_ago):
    return {"role": role, "content": content, "created_at": (NOW - timedelta(minutes=minutes_ago)).isoformat()}


def test_last_user_topic_takes_first_message_of_last_session():
    rows = [_msg("assistant", "ответ", 1), _msg("user", "да", 2), _msg("assistant", "…", 3),
            _msg("user", "Муж не слышит меня, всё время в телефоне", 5),
            _msg("assistant", "старое", 60 * 24), _msg("user", "старая тема", 60 * 24 + 1)]
    assert wr.last_user_topic(rows) == "Муж не слышит меня, всё время в телефоне"
    assert wr.last_user_topic([]) == ""
    assert wr.last_user_topic([_msg("assistant", "только Фреди", 1)]) == ""
    long = [_msg("user", "слово " * 60, 1)]
    t = wr.last_user_topic(long)
    assert t.endswith("…") and len(t) <= wr.TOPIC_MAX_CHARS + 1


def test_plan_is_active_by_total_and_done():
    sp = {"days_total": 7}
    assert wr.plan_is_active(sp, [], NOW - timedelta(days=6), NOW)
    assert not wr.plan_is_active(sp, [], NOW - timedelta(days=7), NOW), "восьмые сутки — план кончился"
    assert not wr.plan_is_active(json.dumps(sp), json.dumps([1, 2, 3, 4, 5, 6, 7]), NOW, NOW)
    assert wr.plan_is_active({"weeks": []}, [], NOW - timedelta(days=15), NOW), "навык — 21 день"
    assert not wr.plan_is_active(sp, [], None, NOW)


def test_skill_notify_respects_days_total():
    sys.path.insert(0, os.path.join(BACKEND, "services"))
    import importlib
    sn = importlib.import_module("skill_notify")
    assert sn._plan_total({"days_total": 7}) == 7
    assert sn._plan_total('{"days_total": 7}') == 7
    assert sn._plan_total({"weeks": []}) == 21 and sn._plan_total(None) == 21
    tz = timezone.utc
    start = datetime.now(timezone.utc) - timedelta(days=10)
    assert sn._current_day(start, tz, 7) == 7 and sn._current_day(start, tz) == 11
    assert sn._days_elapsed(start, tz) == 11
    body = open(os.path.join(BACKEND, "services", "skill_notify.py"), encoding="utf-8").read()
    assert "из 21*" not in body, "«из 21» больше не вшито — длина из плана"
    assert 'return {"success": False, "error": "plan finished"}' in body
    assert "Семь дней по теме" in body


def test_return_nudge_skips_users_with_running_plan():
    sys.path.insert(0, os.path.join(BACKEND, "services"))
    import importlib
    rn = importlib.import_module("return_nudge")
    assert "fredi_skill_plans sp" in rn.CANDIDATES_SQL and "sp.channel <> 'none'" in rn.CANDIDATES_SQL
    assert "fredi_skill_plans" not in rn.SOS_CANDIDATES_SQL, "после SOS догоняем всех"


def test_routes_registered_in_main():
    main = open(os.path.join(BACKEND, "main.py"), encoding="utf-8").read()
    assert "register_week_plan_routes(app, db, lambda: ai_service, limiter)" in main
    assert '"week_plan": bool(getattr(app.state, "week_plan_ready", False))' in main
    src = open(os.path.join(BACKEND, "week_plan_routes.py"), encoding="utf-8").read()
    assert "from __future__ import annotations" not in src
    for route in ('"/api/week-plan/start"', '"/api/week-plan/{user_id}"', '"/api/week-plan/{user_id}/done"'):
        assert route in src
    assert "json_mode=True" in src, "план разбирается json.loads — нужен строгий JSON провайдера"
    assert "ON CONFLICT (user_id) DO UPDATE" in src and "last_sent_at    = NOW()" in src, \
        "день 1 показан на экране — планировщик не должен прислать его же утром"
