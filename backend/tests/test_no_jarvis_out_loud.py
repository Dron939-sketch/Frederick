"""Фреди не упоминает Джарвиса вслух.

17.09.2026 владелец увидел в Вебвизоре: человек пишет первое сообщение, а
следом Фреди представляется и рассказывает про Iron Man. В выгрузке за
неделю нашлось три такие реплики, слово в слово: «Я Фреди. По стилю — как
Джарвис из Iron Man».

Источник был в самом промпте активного пресета:

    - Если спрашивают «как тебя зовут / ты кто» — отвечай: «Я Фреди.»
      При желании можно добавить: «по стилю — как Джарвис из Iron Man».

Модель приняла разрешение за указание. Сравнение с Джарвисом — указание
о стиле для модели, а не реплика для человека, который пришёл со своей
бедой.
"""

import pathlib
import re

SRC = (pathlib.Path(__file__).resolve().parents[1]
       / "modes" / "prompts" / "basic_presets.py").read_text(encoding="utf-8")


def _preset_current() -> str:
    """Тело дефолтного пресета — только то, что уходит в модель."""
    m = re.search(r'_PRESET_CURRENT = """\\\n(.*?)\n"""', SRC, re.S)
    assert m, "не нашёлся _PRESET_CURRENT"
    return m.group(1)


def test_no_permission_to_mention_iron_man():
    """Разрешения «можно добавить про Iron Man» в промпте больше нет."""
    body = _preset_current()
    assert "можно добавить" not in body.lower() or "iron man" not in body.lower(), \
        "вернулось разрешение упоминать Iron Man"
    assert "При желании можно добавить: «по стилю — как Джарвис" not in body


def test_ban_is_explicit():
    """Запрет назван прямо: ни Джарвиса, ни Железного человека вслух."""
    body = _preset_current()
    assert "не упоминай никогда" in body, "нет прямого запрета произносить это вслух"
    assert "Железного человека" in body and "Iron Man" in body, \
        "запрет должен перечислять оба написания — модель обходит одно через другое"


def test_style_anchor_survives():
    """Сам стиль остаётся: это то, за что владелец держится."""
    body = _preset_current()
    assert "Джарвис из «Железного человека»" in body, \
        "стилевой якорь убран — голос Фреди поедет"


def test_jarvis_preset_untouched():
    """Отдельный пресет JARVIS — сознательный выбор владельца, не трогаем."""
    assert "_PRESET_JARVIS" in SRC and "Ты — JARVIS из Iron Man" in SRC
