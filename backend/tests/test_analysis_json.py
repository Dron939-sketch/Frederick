# -*- coding: utf-8 -*-
"""Недописанный JSON полного разбора превращается в разбор, а не в ошибку.

14.09.2026 владелец нажал «полный отчёт» и получил на экран текст
питоновского парсера: «Unterminated string starting at: line 6 column 14»
и «Expecting ',' delimiter: line 7 column 590». Первое — модель уперлась
в max_tokens и оборвала JSON на пятом разделе из шести. Второе —
незаэкранированный символ внутри строки.

Логика _salvage_json_sections воспроизведена здесь построчно: тянуть
main.py в тест нельзя (он поднимает БД, Redis и голос).
"""

import json
import re

KEYS = ("portrait", "loops", "mechanisms", "growth", "forecast", "keys")


def salvage(text: str, keys=KEYS) -> dict:
    out = {}
    for k in keys:
        m = re.search(r'"%s"\s*:\s*"((?:[^"\\]|\\.)*)' % re.escape(k), text, re.S)
        if not m:
            continue
        raw = m.group(1)
        try:
            val = json.loads('"' + raw + '"')
        except json.JSONDecodeError:
            val = raw.replace('\\"', '"').replace('\\n', '\n').replace('\\t', '\t')
        val = val.strip()
        if len(val) >= 40:
            out[k] = val
    return out


def _section(word, n=8):
    """Раздел разбора — пять-шесть предложений, не пара слов.

    Порог в 40 символов в самой функции отсекает огрызки, поэтому
    фикстура обязана быть длиннее настоящего раздела, а не короче.
    """
    return ' '.join(f'{word} предложение номер {i} про этого человека.' for i in range(n))


TRUNCATED = (
    '{\n'
    f'  "portrait": "{_section("портрет")}",\n'
    f'  "loops": "{_section("петли")}",\n'
    f'  "mechanisms": "{_section("механизмы")}",\n'
    f'  "growth": "{_section("рост")}",\n'
    f'  "forecast": "{_section("прогноз")}'
)


def test_truncated_json_gives_five_sections():
    """Главный случай: ответ оборван на шестом разделе."""
    got = salvage(TRUNCATED)
    assert set(got) == {"portrait", "loops", "mechanisms", "growth", "forecast"}
    assert got["forecast"].startswith("прогноз")
    assert "keys" not in got


def test_whole_json_is_read_fully():
    whole = json.dumps({k: _section(k) for k in KEYS}, ensure_ascii=False)
    got = salvage(whole)
    assert set(got) == set(KEYS)
    for k in KEYS:
        assert got[k] == _section(k).strip()


def test_escaped_quotes_survive():
    text = json.dumps({"portrait": 'он сказал "нет" ' + _section("и это важно")},
                      ensure_ascii=False)
    got = salvage(text)
    assert '"нет"' in got["portrait"]


def test_stub_shorter_than_forty_chars_is_not_a_section():
    """Огрызок в пару слов — начало фразы, а не раздел."""
    got = salvage('{"portrait": "он ')
    assert got == {}


def test_garbage_gives_nothing():
    assert salvage('совсем не json') == {}
    assert salvage('') == {}
