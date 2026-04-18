"""
varitype_context.py — Поведенческий контекст пользователя по системе Вариатики.

Из базы знаний (backend/data/varitype_kb.json) строит короткий текстовый блок,
который можно подложить в system prompt AI: что человеку нужно, как с ним
говорить, чего AI должен избегать, слепое пятно, стресс-реакция и т.п.

Также грузит манифест голоса Фреди (backend/data/freddy_persona.md).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
_KB_PATH = os.path.join(_DATA_DIR, "varitype_kb.json")
_PERSONA_PATH = os.path.join(_DATA_DIR, "freddy_persona.md")

_kb_cache: Optional[dict] = None
_persona_cache: Optional[str] = None

VECTOR_ORDER = ("СБ", "ТФ", "УБ", "ЧВ")


def _load_kb() -> dict:
    global _kb_cache
    if _kb_cache is not None:
        return _kb_cache
    try:
        with open(_KB_PATH, "r", encoding="utf-8") as f:
            _kb_cache = json.load(f)
    except Exception as e:
        logger.warning(f"varitype_context: KB load failed: {e}")
        _kb_cache = {}
    return _kb_cache


def _load_persona() -> str:
    global _persona_cache
    if _persona_cache is not None:
        return _persona_cache
    try:
        with open(_PERSONA_PATH, "r", encoding="utf-8") as f:
            _persona_cache = f.read().strip()
    except Exception as e:
        logger.warning(f"varitype_context: persona load failed: {e}")
        _persona_cache = ""
    return _persona_cache


def _normalize_level(raw, default: int = 3) -> int:
    """Приводит значение уровня к 1..6. Поддерживает list (берёт последний)."""
    if isinstance(raw, list) and raw:
        raw = raw[-1]
    try:
        val = int(raw)
    except (TypeError, ValueError):
        return default
    return max(1, min(6, val))


def _extract_levels(vectors: Optional[Dict]) -> Dict[str, int]:
    """Вытаскивает {vec: level 1..6} из формата профиля Frederick."""
    out: Dict[str, int] = {}
    if not isinstance(vectors, dict):
        return out
    for k in VECTOR_ORDER:
        if k in vectors:
            out[k] = _normalize_level(vectors[k])
    return out


def build_user_context(vectors: Optional[Dict], include_all: bool = False) -> str:
    """
    Возвращает текстовый блок со значимыми полями KB для данного пользователя.

    По умолчанию включает ТОЛЬКО доминирующий (макс) и уязвимый (мин) векторы —
    это сохраняет промпт компактным. include_all=True — описание всех 4 векторов.
    """
    kb = _load_kb()
    if not kb:
        return ""
    kb_vectors = kb.get("vectors") or {}
    if not kb_vectors:
        return ""

    levels = _extract_levels(vectors)
    if not levels:
        return ""

    # Выбираем на какие векторы делать разбор
    if include_all:
        targets = [k for k in VECTOR_ORDER if k in levels]
    else:
        sorted_by_val = sorted(levels.items(), key=lambda kv: kv[1])
        weakest_key = sorted_by_val[0][0]
        strongest_key = sorted_by_val[-1][0]
        # Уникальный порядок: сначала доминирующий, потом уязвимый
        targets: List[str] = []
        for k in (strongest_key, weakest_key):
            if k not in targets:
                targets.append(k)

    parts: List[str] = ["ВАРИАТИКА — ПОВЕДЕНЧЕСКИЙ КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:"]
    for key in targets:
        lvl = levels[key]
        vec_data = kb_vectors.get(key) or {}
        level_data = (vec_data.get("levels") or {}).get(str(lvl)) or {}
        if not level_data:
            continue
        role = vec_data.get("name") or key
        level_name = level_data.get("level_name") or f"{key}={lvl}"
        communication = level_data.get("communication") or {}
        behavior = level_data.get("behavior") or {}
        parts.append(
            f"• {key} ({role}) — уровень {lvl}/6: {level_name}\n"
            f"  Нужно: {level_data.get('what_they_need', '—')}\n"
            f"  Стресс-реакция: {behavior.get('stress_response', '—')}; "
            f"слепое пятно: {behavior.get('blind_spot', '—')}\n"
            f"  Говорить: {communication.get('preference', '—')} "
            f"({communication.get('message_format', '—')})\n"
            f"  Избегать в общении: {communication.get('what_to_avoid', '—')}; "
            f"триггеры доверия: {communication.get('trust_triggers', '—')}\n"
            f"  AI НЕ должен: {level_data.get('ai_should_avoid', '—')}"
        )
    if len(parts) == 1:
        return ""
    return "\n".join(parts)


def freddy_persona() -> str:
    """Манифест голоса Фреди (Милош Бикович, паузы, принципы эмпатии)."""
    return _load_persona()


def freddy_system_preface(
    vectors: Optional[Dict] = None,
    include_persona: bool = True,
    include_all_vectors: bool = False,
) -> str:
    """
    Готовый префикс для system prompt: персона + поведенческий контекст.
    Может склеиваться с существующими системными промптами через \\n\\n.
    """
    chunks: List[str] = []
    if include_persona:
        p = _load_persona()
        if p:
            chunks.append(p)
    ctx = build_user_context(vectors, include_all=include_all_vectors)
    if ctx:
        chunks.append(ctx)
    return "\n\n".join(chunks)
