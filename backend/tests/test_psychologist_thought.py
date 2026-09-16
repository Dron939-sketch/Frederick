"""Мысли психолога: обращение с большой буквы и разбор не в одну строку.

17.09.2026 владелец показал экран: «друг, ты часто ставишь интересы
других выше своих. Где та грань…» — одно предложение и обращение со
строчной буквы. Обе причины разные.

Строчная «друг» — из format_psychologist_text: он приписывает обращение
и понижает первую букву текста. Для настоящего имени это верно («Анна,
ты часто…»), а запасное «друг» приходит со строчной и таким и остаётся.

Одно предложение — это запасной текст: в промпте просили «1 предложение»
на раздел, а на экране был вовсе не он, а хардкод из _get_thought_fallback.
"""

import ast
import pathlib
import re
import sys

BACKEND = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from formatters import format_psychologist_text  # noqa: E402

AI_SRC = (BACKEND / "services" / "ai_service.py").read_text(encoding="utf-8")


def test_address_is_capitalized():
    """«друг» становится «Друг» — обращение открывает предложение."""
    out = format_psychologist_text("Ты часто ставишь интересы выше своих.", "друг")
    assert out.startswith("Друг, ты часто"), out[:40]


def test_real_name_still_works():
    """Настоящее имя не ломается."""
    out = format_psychologist_text("Ты часто ставишь интересы выше своих.", "Анна")
    assert out.startswith("Анна, ты часто"), out[:40]


def test_no_address_without_name():
    """Без имени обращение не приписывается вовсе."""
    out = format_psychologist_text("Ты часто ставишь интересы выше своих.", "")
    assert out.startswith("Ты часто"), out[:40]


def test_prompt_asks_for_several_sentences():
    """Промпт просит 2–3 предложения на раздел, а не одно."""
    assert "в каждом 2–3 предложения" in AI_SRC
    assert "🔐 КЛЮЧЕВОЙ ЭЛЕМЕНТ — (1 предложение)" not in AI_SRC


def test_token_ceiling_raised():
    """1400 токенов: на 500 текст обрывался бы на четвёртом разделе."""
    m = re.search(r"generate_psychologist_thought.*?max_tokens=(\d+)", AI_SRC, re.S)
    assert m and int(m.group(1)) >= 1200, "потолок токенов не поднят"


def test_fallback_does_not_pose_as_personal_analysis():
    """Запасной текст честно говорит, что он общий, и зовёт пересобрать."""
    src = AI_SRC.split("def _get_thought_fallback")[1].split("def ")[0]
    assert "не про тебя лично" in src, "запасной текст выдаёт себя за разбор"
    assert "Новая мысль" in src, "нет выхода — как получить свою мысль"
