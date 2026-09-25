# -*- coding: utf-8 -*-
"""Размытый разбор (25.09.2026): начало читается, остальное заперто.

Замена подарочному разбору (19.09): подарок убрали со стены 23.09, а
серверная выдача осталась — любой, кто нажимал «часть 4» на экране
теста, получал шесть разделов бесплатно, при том что рядом кнопка звала
купить их за 69 ₽. Теперь разбор генерируется всем прошедшим тест и без
подписки сохраняется запертым; наружу уходит только превью.

Три вещи, которые ломаются молча и потому проверяются здесь:

1. В превью нет скрытого текста. «Блюр» поверх настоящих слов снимается
   одной галочкой в инспекторе.
2. Подписка открывает ту же строку, а не генерирует заново: человек
   должен получить ровно тот текст, начало которого видел.
3. Соседние ручки (история) не отдают запертый текст без подписки.

Модуль превью — чистый, гоняется напрямую; ручки и репозиторий — по
тексту, как в остальных тестах: FastAPI и базы в песочнице нет.
"""
import ast
import os
import pathlib
import sys

BACKEND = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
MAIN = (BACKEND / "main.py").read_text(encoding="utf-8")
REPO = (BACKEND / "repositories" / "user_repo.py").read_text(encoding="utf-8")


def _func(source: str, name: str) -> str:
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == name:
            return ast.get_source_segment(source, node) or ""
    raise AssertionError(f"функция {name} не найдена")


SAMPLE = {
    "portrait": ("Ты человек, который держит всё под контролем, пока хватает сил. "
                 "Снаружи это выглядит как надёжность, внутри — как постоянное напряжение. "
                 "Ты редко просишь о помощи и почти никогда не показываешь усталость. "
                 "Отдых воспринимается как слабость, а не как часть работы. "
                 "Поэтому срывы приходят внезапно и для окружающих, и для тебя."),
    "loops": "Ты берёшь больше, чем можешь унести, потом злишься на тех, кто не помог. " * 3,
    "mechanisms": "Контроль защищает от стыда быть недостаточным. " * 4,
    "growth": "Первая точка — научиться говорить «мне нужна помощь» до, а не после срыва. " * 2,
    "forecast": "Если ничего не менять, через полгода усталость станет фоном. " * 2,
    "keys": "«Я имею право не справляться сегодня.» " * 3,
}


# ---------- модуль превью ----------

def test_preview_has_no_hidden_text():
    from deep_preview import preview
    p = preview(SAMPLE)
    dumped = str(p)
    for key in ("loops", "mechanisms", "growth", "forecast", "keys"):
        assert SAMPLE[key][:40] not in dumped, f"в превью утёк текст раздела {key}"
    # Из портрета видно только начало.
    assert p["open"]["key"] == "portrait"
    assert SAMPLE["portrait"].startswith(p["open"]["text"])
    assert len(p["open"]["text"]) < len(SAMPLE["portrait"])


def test_preview_opens_whole_sentences():
    from deep_preview import open_part, OPEN_CHARS
    text = open_part(SAMPLE["portrait"])
    assert text.endswith(".")
    assert len(text) <= OPEN_CHARS
    # Короткий текст открывается целиком — резать нечего.
    assert open_part("Одна фраза.") == "Одна фраза."


def test_preview_reports_section_sizes():
    from deep_preview import preview, SECTIONS
    p = preview(SAMPLE)
    keys = [s["key"] for s in p["sections"]]
    assert keys == [k for k, _ in SECTIONS]
    for s in p["sections"]:
        assert s["title"] and s["chars"] > 0
        if s["key"] == "portrait":
            assert s["hidden_chars"] == s["chars"] - len(p["open"]["text"])
        else:
            assert s["hidden_chars"] == s["chars"]
    assert p["total_chars"] == sum(len(v.strip()) for v in SAMPLE.values())


def test_preview_survives_partial_analysis():
    """Разбор, собранный по частям (пять разделов из шести), тоже даёт превью."""
    from deep_preview import preview
    partial = {k: v for k, v in SAMPLE.items() if k != "portrait"}
    p = preview(partial)
    assert p["open"]["key"] == "loops"
    assert len(p["sections"]) == 5
    assert preview({}) == {"open": {"key": "", "text": ""}, "sections": [], "total_chars": 0}


# ---------- ручки ----------

def test_generation_locks_without_subscription():
    body = _func(MAIN, "deep_analysis")
    assert "locked=not is_premium" in body, "разбор без подписки должен сохраняться запертым"
    assert "_deep_locked_response" in body, "без подписки наружу идёт превью, а не разбор"
    assert "_deep_access" not in body and "_deep_gift_available" not in body


def test_generation_refuses_second_analysis_without_subscription():
    body = _func(MAIN, "deep_analysis")
    i = body.index("get_last_deep_analysis")
    j = body.index("_call_deepseek")
    assert i < j, "проверка «разбор уже есть» должна стоять до генерации"
    assert "premium_required" in body[i:j]


def test_locked_response_carries_preview_only():
    body = _func(MAIN, "_deep_locked_response")
    assert "from deep_preview import preview" in body
    assert '"premium_required": True' in body
    assert '"analysis"' not in body.replace('.get("analysis")', ""), (
        "в ответе без подписки не должно быть поля analysis с текстом"
    )


def test_reading_unlocks_same_row_for_subscriber():
    body = _func(MAIN, "get_saved_deep_analysis")
    assert body.index("get_last_deep_analysis") < body.index("locked"), (
        "сохранённый разбор читается раньше проверки замка"
    )
    assert "unlock_deep_analysis" in body, "подписка открывает ту же строку, а не генерирует заново"
    assert "_deep_locked_response" in body, "без подписки запертый разбор отдаётся превью"
    assert "gift_available" not in body


def test_history_hides_locked_without_subscription():
    body = _func(MAIN, "get_deep_analysis_history")
    assert 'h.get("locked")' in body and "_is_premium_user" in body


def test_gift_endpoint_is_gone():
    assert "/api/deep-analysis/{user_id}/gift" not in MAIN
    assert "_deep_gift_available" not in MAIN and "_deep_access" not in MAIN


def test_meter_lets_first_generation_through_once():
    body = _func(MAIN, "meter_guard_middleware")
    assert "/api/deep-analysis" in body
    assert "_deep_never_generated" in body, (
        "исключение держится на «разборов не было ни разу» — иначе после "
        "первой генерации дыра осталась бы открытой"
    )
    never = _func(MAIN, "_deep_never_generated")
    assert "count_deep_analyses" in never and "== 0" in never


def test_deep_analysis_still_metered():
    assert "deep-analysis" in MAIN.split("_METER_AI_REGEX")[1][:1200]


# ---------- репозиторий ----------

def test_repo_stores_and_reads_lock():
    save = _func(REPO, "save_deep_analysis")
    assert "locked" in save and "$4" in save
    read = _func(REPO, "get_last_deep_analysis")
    assert '"locked": bool(row[\'locked\'])' in read
    unlock = _func(REPO, "unlock_deep_analysis")
    assert "SET locked = FALSE" in unlock and "is_active = TRUE" in unlock
    hist = _func(REPO, "get_deep_analyses_history")
    assert "locked" in hist


def test_lock_column_is_migrated():
    assert "ALTER TABLE fredi_deep_analyses ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE" in MAIN


def test_count_counts_every_row():
    body = _func(REPO, "count_deep_analyses")
    assert "COUNT(*)" in body and "is_active" not in body and "locked" not in body


def test_no_strikethrough_price_anywhere():
    """Зачёркнутых цен в продукте нет: скидки нет, а зачёркнутая цена без
    скидки — недостоверная реклама (ст. 5 ФЗ «О рекламе»)."""
    import re
    payment = (BACKEND / "payment.py").read_text(encoding="utf-8")
    from payment import plan_price
    assert plan_price("monthly") > plan_price("trial_week") > 0
    assert "290" not in re.sub(r"#.*", "", payment)
