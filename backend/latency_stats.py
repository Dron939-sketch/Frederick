# -*- coding: utf-8 -*-
"""Сводка задержки первого слова по серверным таймингам хода.

Каждый ход чата пишется в fredi_events событием «chat» с таймингами
(prep_ms, gen_start_ms, gen_first_chunk_ms, first_delta_ms, total_ms и
то, что доложил режим). До 25.09 эти числа никто не читал: админ-лента
показывает первые три поля события, и это mode / длины реплик. Спор
«где человек ждёт свои семь секунд» вёлся вслепую.

Здесь — чистая арифметика без БД, чтобы её можно было проверить тестом.
"""
from typing import Any, Dict, Iterable, List, Optional
import json

# Порог, после которого ожидание первого слова считается тормозом.
# Медиана выше него за час — сигнал в пульсе.
SLOW_FIRST_MS = 4000

# Отсечки в порядке прохождения хода: где именно копится время, видно
# по разнице соседних медиан.
STAGES = ("prep_ms", "gen_start_ms", "gen_first_chunk_ms", "first_delta_ms", "total_ms")


def _num(v: Any) -> Optional[float]:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).strip())
    except (TypeError, ValueError):
        return None


def _data(row: Any) -> Dict[str, Any]:
    d = row.get("event_data") if isinstance(row, dict) else row["event_data"]
    if isinstance(d, str):
        try:
            d = json.loads(d)
        except ValueError:
            return {}
    return d if isinstance(d, dict) else {}


def _pct(xs: List[float], q: float) -> float:
    if not xs:
        return 0.0
    ys = sorted(xs)
    i = min(len(ys) - 1, max(0, int(round(q * (len(ys) - 1)))))
    return ys[i]


def _stats(xs: List[float]) -> Dict[str, Any]:
    return {
        "n": len(xs),
        "median": int(_pct(xs, 0.5)),
        "p90": int(_pct(xs, 0.9)),
        "max": int(max(xs)) if xs else 0,
    }


def latency_summary(rows: Iterable[Any], limit: int = 30) -> Dict[str, Any]:
    """rows — записи fredi_events с event_data и created_at (новые первыми).

    Возвращает по каждой отсечке n / медиану / p90 / max, разбивку медианы
    первого слова по режимам, долю «медленных» ходов (>SLOW_FIRST_MS) и
    последние ходы как есть — по ним видно, один ли это выброс или
    все подряд.
    """
    per_stage: Dict[str, List[float]] = {k: [] for k in STAGES}
    extra: Dict[str, List[float]] = {}
    by_mode: Dict[str, List[float]] = {}
    slow = 0
    counted = 0
    recent: List[Dict[str, Any]] = []
    for row in rows:
        d = _data(row)
        first = _num(d.get("first_delta_ms"))
        if first is None:
            continue
        counted += 1
        if first > SLOW_FIRST_MS:
            slow += 1
        for k in STAGES:
            v = _num(d.get(k))
            if v is not None:
                per_stage[k].append(v)
        for k, raw in d.items():
            if k in STAGES or not k.endswith("_ms"):
                continue
            v = _num(raw)
            if v is not None:
                extra.setdefault(k, []).append(v)
        mode = str(d.get("mode") or "?")
        by_mode.setdefault(mode, []).append(first)
        if len(recent) < limit:
            created = row.get("created_at") if isinstance(row, dict) else row["created_at"]
            item = {"at": created.isoformat() if hasattr(created, "isoformat") else str(created or ""),
                    "mode": mode}
            for k in STAGES:
                v = _num(d.get(k))
                if v is not None:
                    item[k] = int(v)
            for k in extra:
                v = _num(d.get(k))
                if v is not None:
                    item[k] = int(v)
            recent.append(item)

    stages = {k: _stats(v) for k, v in per_stage.items() if v}
    stages.update({k: _stats(v) for k, v in sorted(extra.items()) if v})
    first_all = per_stage["first_delta_ms"]
    return {
        "turns": counted,
        "slow_share": round(slow / counted, 3) if counted else 0.0,
        "slow_threshold_ms": SLOW_FIRST_MS,
        "alert": bool(counted >= 5 and _pct(first_all, 0.5) > SLOW_FIRST_MS),
        "stages": stages,
        "by_mode": {m: _stats(v) for m, v in sorted(by_mode.items())},
        "recent": recent,
    }
