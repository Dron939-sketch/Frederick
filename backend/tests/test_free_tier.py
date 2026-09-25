# -*- coding: utf-8 -*-
"""Память бесплатной версии: семь дней на устройстве без аккаунта.

25.09.2026. До этого аноним «завтра начинал сначала» (13.09), а из-за
ошибки в main.py — начинал сначала на каждой реплике: история в промпт
шла без времени, фильтр отбрасывал всё без времени. Здесь проверяется:

1. окно анонима — семь дней, аккаунт — без окна;
2. main.py фильтрует строки С временем, до обрезки до role/content;
3. возвращение после паузы даёт тему и «когда», и не срабатывает внутри
   того же разговора;
4. Фреди на возврате получает блок ВОЗВРАЩЕНИЕ, на каждом ходу — РИТМ,
   каждый третий ход — без вопроса; тексты про «завтра не вспомню»
   исчезли из ритуала завершения и горизонта.

Запуск: python3 backend/tests/test_free_tier.py
"""
import ast
import os
import pathlib
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import free_tier as ft  # noqa: E402

BACKEND = pathlib.Path(__file__).resolve().parents[1]
MAIN = (BACKEND / "main.py").read_text(encoding="utf-8")
BASIC = (BACKEND / "modes" / "basic.py").read_text(encoding="utf-8")
NOW = datetime(2026, 9, 25, 12, 0, tzinfo=timezone.utc)


def _row(minutes_ago, role="user", content="x"):
    return {"role": role, "content": content,
            "created_at": (NOW - timedelta(minutes=minutes_ago)).isoformat()}


def _func(source: str, name: str) -> str:
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == name:
            return ast.get_source_segment(source, node) or ""
    raise AssertionError(f"функция {name} не найдена")


# ---------- окно памяти ----------

def test_anonymous_keeps_seven_days():
    hist = [_row(60 * 24 * 8), _row(60 * 24 * 6, "assistant"), _row(60 * 26), _row(5, "assistant")]
    out = ft.session_history(hist, registered=False, now=NOW)
    assert out == hist[1:], out
    assert ft.ANON_MEMORY_DAYS == 7


def test_registered_keeps_everything():
    hist = [_row(60 * 24 * 40), _row(30)]
    assert ft.session_history(hist, registered=True, now=NOW) == hist


def test_anonymous_row_without_time_is_dropped():
    hist = [{"role": "user", "content": "когда-то"}, _row(3)]
    assert ft.session_history(hist, registered=False, now=NOW) == [hist[1]]


def test_main_filters_rows_before_stripping_time():
    """Регресс 13–25.09: фильтр стоял после обрезки до role/content и
    выбрасывал всё — аноним получал пустую историю."""
    i_filter = MAIN.index("session_history(rows_asc, registered)")
    i_strip = MAIN.index("history = [{'role': m['role'], 'content': m['content']} for m in rows_asc]")
    assert i_filter < i_strip, "фильтр по времени должен стоять до обрезки до role/content"
    assert "session_history(history, registered)" not in MAIN, "старый порядок вернулся"


def test_memory_summaries_allowed_for_everyone_with_anon_window():
    assert '"memory_allowed": True' in MAIN
    assert '"memory_max_age_days": None if registered else ANON_MEMORY_DAYS' in MAIN
    for f in ("modes/basic.py", "modes/coach.py", "modes/trainer.py", "modes/psychologist.py"):
        src = (BACKEND / f).read_text(encoding="utf-8")
        assert 'max_age_days=self.user_data.get("memory_max_age_days")' in src, f
    sm = _func((BACKEND / "session_memory.py").read_text(encoding="utf-8"), "load_memory_block")
    assert "max_age_days" in sm and "ended_at > NOW()" in sm


# ---------- возвращение ----------

def test_return_context_after_a_pause():
    hist = [_row(60 * 30, content="Муж не слышит меня, всё время в телефоне"),
            _row(60 * 30 - 1, "assistant"), _row(60 * 30 - 2, content="да")]
    ctx = ft.return_context(hist, registered=False, now=NOW)
    assert ctx["return_topic"].startswith("Муж не слышит")
    assert ctx["return_when"] == "вчера" and ctx["return_days"] == 1


def test_return_context_not_inside_same_conversation():
    assert ft.return_context([_row(10, content="привет")], registered=False, now=NOW) == {}


def test_return_context_respects_windows():
    old = [_row(60 * 24 * 9, content="старое")]
    assert ft.return_context(old, registered=False, now=NOW) == {}
    assert ft.return_context(old, registered=True, now=NOW)["return_days"] == 9
    assert ft.return_context([_row(60 * 24 * 40, content="очень старое")], registered=True, now=NOW) == {}


def test_return_context_cuts_long_topic_on_word():
    long = "слово " * 40
    ctx = ft.return_context([_row(60 * 30, content=long)], registered=False, now=NOW)
    assert ctx["return_topic"].endswith("…") and len(ctx["return_topic"]) <= 82


def test_main_passes_return_context_on_first_turn_only():
    assert 'if int(session_meta.get("session_turns") or 0) == 0:' in MAIN
    assert "return_ctx = return_context(rows_asc, registered)" in MAIN
    assert "**return_ctx," in MAIN


# ---------- промпт Фреди ----------

def test_basic_has_return_block_wired():
    body = _func(BASIC, "_build_return_block")
    assert "ВОЗВРАЩЕНИЕ" in body and "return_topic" in body and "return_when" in body
    assert "_SEARCH_STARTS" in body, "автовопрос из рекламы — не возвращение"
    assert "returned = self._build_return_block(question)" in BASIC


def test_basic_rhythm_every_third_turn_without_question():
    body = _func(BASIC, "_build_rhythm_block")
    assert "NO_QUESTION_EVERY" in body and "БЕЗ вопроса" in body
    assert "Первое предложение — про то, что он только что написал" in body
    assert "NO_QUESTION_EVERY = 3" in BASIC
    # Ритуал завершения сам без вопроса — ритм в том же ответе не нужен.
    i = BASIC.index("rhythm = self._build_rhythm_block(question)")
    assert "if not closing:" in BASIC[i - 200:i]


def test_no_more_forget_by_tomorrow_texts():
    closing = _func(BASIC, "_build_closing_block")
    horizon = _func(BASIC, "_build_horizon_block")
    for body in (closing, horizon):
        assert "не вспомн" not in body, "текст «завтра не вспомню» устарел: память семь дней"
        # Литералы в исходнике разбиты по строкам — сверяем по склейке.
        joined = body.replace('"\n', '').replace('                "', '')
        assert "неделю на этом устройстве" in joined.replace('" "', '')


# ---------- опрос ----------

def test_why_not_links_carry_reason_codes():
    link = "https://meysternlp.ru/fredi/?ref=reeng&cid=t1&utm_source=fredi_mail"
    text = ft.why_not_block(link)
    html = ft.why_not_html(link)
    for code, label in ft.WHY_NOT_REASONS:
        assert f"&why={code}" in text and label in text
        assert f"&why={code}" in html and label in html
    assert text.count("why=") == 4
    assert ft.why_not_block("https://x/app").count("?why=") == 4


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
