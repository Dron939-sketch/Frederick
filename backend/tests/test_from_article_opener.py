"""Пришёл из статьи — сначала познакомься, потом отвечай.

17.09.2026 владелец показал разговор: человек нажал кнопку в статье, ему
ушло готовое «Я только что из статьи «Лекция 6. Иерархии…». Помогите
примерить это на мой случай», и Фреди сразу начал разбирать иерархии —
«назови мне две-три свои главные и в каждой одну вещь». Человек ушёл
после первого ответа.

Замер по выгрузке за неделю подтвердил, что это не единичный случай, а
худший сегмент:

                        из статьи (n=68)   все остальные (n=313)
  медиана реплик              1                    2
  ушли после одной          85 %                 37 %
  дошли до пяти              1 %                  27 %

Каждый пятый разговор приходит так, и ломается он в первом же ходе:
вопрос написал не человек, а ссылка, и отвечать пока не на что.
"""

import pathlib
import re

SRC = (pathlib.Path(__file__).resolve().parents[1]
       / "modes" / "prompts" / "basic_presets.py").read_text(encoding="utf-8")


def _current() -> str:
    m = re.search(r'_PRESET_CURRENT = """\\\n(.*?)\n"""', SRC, re.S)
    assert m, "не нашёлся _PRESET_CURRENT"
    return m.group(1)


def test_block_exists():
    body = _current()
    assert "ПРИШЁЛ ИЗ СТАТЬИ — СНАЧАЛА ПОЗНАКОМЬСЯ" in body


def test_opener_is_recognized_as_machine_written():
    """Сказано прямо: это сообщение написал не человек."""
    body = _current()
    assert "написал НЕ человек" in body
    assert "зашито" in body


def test_no_answering_on_the_merits_first():
    """Первым ходом по существу статьи не отвечаем."""
    body = _current()
    assert "НЕ отвечать по существу статьи" in body
    assert "НЕ пересказывать статью" in body


def test_acquaintance_and_one_question():
    """Знакомство и ровно один простой вопрос про его случай."""
    body = _current()
    assert "как к нему обращаться" in body
    assert "ОДИН вопрос" in body
    assert "домашнее задание" in body, "нет запрета на вопрос-задание"


def test_first_move_is_short_here():
    """Здесь короткий ход — исключение, и оно обосновано."""
    body = _current()
    assert "трёх-четырёх предложениях" in body
    assert "не вложил ни слова" in body


def test_numbers_are_in_the_prompt():
    """Числа замера стоят в промпте — чтобы правило не сочли вкусовым."""
    body = _current()
    assert "85 %" in body and "68" in body
