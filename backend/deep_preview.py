# -*- coding: utf-8 -*-
"""Глубинный разбор без подписки: начало читается, остальное — под блюром.

Решение по плану от 25.09.2026 (шаг «размытый разбор»). До этого человек
без подписки видел на месте разбора список заголовков — «что откроется» —
и кнопку. За 23–25.09 этот замок не показался ни разу, а разбор при этом
раздавался целиком: подарок первого разбора (19.09) остался на сервере
после того, как 23.09 его убрали со стены, и любой, кто нажимал «часть 4»
на экране теста, получал шесть разделов бесплатно и без обещания.

Теперь разбор генерируется всем, кто прошёл тест, и сохраняется с
locked = TRUE у человека без подписки. Наружу без подписки уходит только
это превью: начало портрета целиком (первые фразы, OPEN_CHARS знаков) и
для каждого раздела — заголовок и объём в знаках, чтобы клиент нарисовал
размытый текст нужной длины. Самого скрытого текста в ответе НЕТ:
«блюр» поверх настоящих слов снимается одной галочкой в инспекторе, и
это известный способ читать платное бесплатно.

Подписка открывает ровно тот текст, который человек видел размытым:
строка в базе та же, меняется только флаг.

Модуль без FastAPI и без базы — чтобы тест гонял его в песочнице.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List

# Порядок и заголовки разделов — те же, что на экране разбора (analysis.js).
SECTIONS = (
    ("portrait", "Глубинный портрет"),
    ("loops", "Системные петли"),
    ("mechanisms", "Скрытые механизмы"),
    ("growth", "Точки роста"),
    ("forecast", "Прогноз"),
    ("keys", "Персональные ключи"),
)

# Сколько знаков портрета открыто. Две-три фразы: достаточно, чтобы
# человек узнал себя, мало, чтобы прочесть портрет целиком.
OPEN_CHARS = 320
OPEN_MIN_CHARS = 120

_SENT_END = re.compile(r"[.!?…]+[»)\"]?\s+")


def _text(v: Any) -> str:
    if isinstance(v, (list, tuple)):
        v = "\n".join(str(x) for x in v)
    return str(v or "").strip()


def open_part(text: str, limit: int = OPEN_CHARS) -> str:
    """Начало текста до конца фразы, не длиннее limit знаков.

    Режем по концу предложения, а не по знаку: обрыв на полуслове читается
    как поломка, а не как приглашение. Если ни одна граница фразы не
    помещается в limit, берём первую фразу целиком — пусть длиннее, чем
    лишить человека даже одной целой мысли.
    """
    text = _text(text)
    if len(text) <= limit:
        return text
    cut = 0
    for m in _SENT_END.finditer(text):
        if m.end() > limit:
            break
        cut = m.end()
    if cut < OPEN_MIN_CHARS:
        m = _SENT_END.search(text)
        cut = m.end() if m else 0
    if cut <= 0:
        return text[:limit].rstrip() + "…"
    return text[:cut].rstrip()


def preview(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Что отдаём без подписки.

    {"open": {"key": "portrait", "text": "..."},
     "sections": [{"key", "title", "chars", "hidden_chars"}, ...]}

    chars — полная длина раздела, hidden_chars — сколько из неё скрыто
    (у портрета меньше на открытое начало). Клиент рисует размытую
    заглушку такой же длины: человек видит, что разбор большой и уже
    написан, а не «будет когда-нибудь».
    """
    analysis = analysis or {}
    sections: List[Dict[str, Any]] = []
    open_key, open_text = "", ""
    for key, title in SECTIONS:
        body = _text(analysis.get(key))
        if not body:
            continue
        if not open_key:
            open_key, open_text = key, open_part(body)
        hidden = len(body) - (len(open_text) if key == open_key else 0)
        sections.append({
            "key": key,
            "title": title,
            "chars": len(body),
            "hidden_chars": max(0, hidden),
        })
    return {
        "open": {"key": open_key, "text": open_text},
        "sections": sections,
        "total_chars": sum(s["chars"] for s in sections),
    }
