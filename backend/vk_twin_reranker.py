"""
vk_twin_reranker.py — Phase 7B: уточнённый ре-скоринг кандидатов через DeepSeek.

После того как vk_twin_finder отобрал кандидатов по пересечению marker-групп,
этот модуль для каждого top-кандидата:
  1) дёргает wall.get (последние 20-30 постов через vk_parser._call)
  2) шлёт в DeepSeek краткую сводку постов + слепок исходного юзера
  3) получает quality_score (0-100) и reasoning «что совпало / что нет»

Идея — отсеять «формально подходящих» кандидатов, у которых на стене
совершенно другая тематика. Скоринг по группам — это ИНТЕРЕС, а скоринг
по постам — это «что человек реально пишет».

Цена: на каждого кандидата = 1 wall.get + 1 DeepSeek-вызов.
Используется только когда оператор включает re_rank вручную.
"""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx

from vk_parser import _call  # type: ignore[attr-defined]

logger = logging.getLogger(__name__)

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT_S = 60.0


SYSTEM_PROMPT = (
    "Ты — аналитик качества подбора. Тебе дают «слепок проблематики» нашего "
    "клиента (pain_point, key_themes, evidence) и до 30 постов кандидата из VK. "
    "Твоя задача — оценить, насколько этот кандидат разделяет ту же боль, "
    "те же темы, ту же эмоциональную тональность.\n\n"
    "Шкала score (целое 0–100):\n"
    "  90-100 — посты явно про ту же боль, тот же эмоциональный фон, очень похоже\n"
    "  70-89  — пересечение тем сильное, но не полное; крючок сработает\n"
    "  50-69  — есть общие маркеры, но боль другая или не активная\n"
    "  30-49  — формальное совпадение по интересу, без признаков боли\n"
    "  0-29   — кандидат явно про другое; крючок не сработает\n\n"
    "Возвращай СТРОГО JSON:\n"
    "{\n"
    "  \"quality_score\": <int 0..100>,\n"
    "  \"reasoning\": \"одно-два предложения для оператора: что совпало в постах, что нет\",\n"
    "  \"matched_signals\": [\"конкретные сигналы совпадения, если есть\"],\n"
    "  \"missing_signals\": [\"чего ожидали увидеть в постах но нет\"]\n"
    "}\n"
    "Никакого markdown, только JSON."
)


def _summarize_candidate_wall(wall_resp: Dict[str, Any], limit: int = 30) -> List[str]:
    items = (wall_resp or {}).get("items") or []
    texts: List[str] = []
    for p in items[:limit]:
        t = (p.get("text") or "").strip()
        if t:
            texts.append(t[:300])
    return texts


def _build_prompt(features: Dict[str, Any], candidate_user: Dict[str, Any], wall_texts: List[str]) -> str:
    pain = features.get("pain_point") or features.get("problem_summary") or ""
    desire = features.get("desired_outcome") or ""
    themes = features.get("key_themes") or []
    keywords = features.get("marker_keywords") or []
    evidence_dlg = features.get("evidence_in_dialogue") or []

    blocks: List[str] = []
    blocks.append("=== Слепок целевой проблематики (что должны видеть в постах) ===")
    if pain:
        blocks.append(f"Активная боль: {pain}")
    if desire:
        blocks.append(f"Желание: {desire}")
    if themes:
        blocks.append(f"Темы: {', '.join(themes[:5])}")
    if keywords:
        blocks.append(f"Marker-слова: {', '.join(keywords[:15])}")
    if evidence_dlg:
        blocks.append("Как боль звучит изнутри (для тона):")
        for q in evidence_dlg[:3]:
            blocks.append(f"  — «{q}»")

    blocks.append("\n=== Кандидат ===")
    name = (candidate_user.get("first_name") or "") + " " + (candidate_user.get("last_name") or "")
    blocks.append(f"Имя: {name.strip() or '(не указано)'}")
    if candidate_user.get("status"):
        blocks.append(f"Статус: «{(candidate_user.get('status') or '')[:200]}»")
    if candidate_user.get("about"):
        blocks.append(f"О себе: «{(candidate_user.get('about') or '')[:200]}»")

    blocks.append(f"\n=== Посты кандидата ({len(wall_texts)} шт) ===")
    if not wall_texts:
        blocks.append("(постов нет / стена закрыта / тексты пустые)")
    else:
        for i, t in enumerate(wall_texts, 1):
            blocks.append(f"[{i}] {t}")

    blocks.append("\nОцени совпадение по шкале выше. Верни JSON.")
    return "\n".join(blocks)


async def fetch_candidate_wall(client: httpx.AsyncClient, vk_id: int, count: int = 30) -> Dict[str, Any]:
    """Тащит wall.get для одного кандидата через общий rate-limited клиент."""
    try:
        return await _call(client, "wall.get", {
            "owner_id": int(vk_id),
            "count": count,
            "extended": 0,
        })
    except RuntimeError as e:
        return {"error": str(e)}


async def rerank_candidate(
    features: Dict[str, Any],
    candidate_user: Dict[str, Any],
    wall_resp: Dict[str, Any],
    *,
    model: Optional[str] = None,
    temperature: float = 0.2,
) -> Dict[str, Any]:
    """Возвращает {quality_score, reasoning, matched_signals, missing_signals}."""
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY не задан в env")

    if "error" in wall_resp:
        # Стена закрыта / ошибка VK — оценить нельзя; даём низкий score.
        return {
            "quality_score": 0,
            "reasoning": f"Стена недоступна ({wall_resp.get('error')[:100]}). Re-rank по постам невозможен.",
            "matched_signals": [],
            "missing_signals": ["wall closed or VK error"],
        }

    wall_texts = _summarize_candidate_wall(wall_resp)
    if not wall_texts:
        return {
            "quality_score": 5,
            "reasoning": "У кандидата на стене нет постов с текстом — оценить совпадение по содержанию нельзя.",
            "matched_signals": [],
            "missing_signals": ["no text posts"],
        }

    prompt = _build_prompt(features, candidate_user, wall_texts)
    payload = {
        "model": model or DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            r = await client.post(
                DEEPSEEK_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as e:
        raise RuntimeError(f"DeepSeek network error (re-rank): {e}")

    if r.status_code != 200:
        raise RuntimeError(f"DeepSeek HTTP {r.status_code} (re-rank): {r.text[:300]}")

    body = r.json()
    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError(f"DeepSeek re-rank: unexpected response: {str(body)[:300]}")

    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].lstrip()
    try:
        result = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"DeepSeek re-rank вернул не-JSON: {e}; text={text[:200]}")

    if not isinstance(result, dict):
        raise RuntimeError("DeepSeek re-rank вернул не объект")

    # Нормализация
    try:
        score = int(result.get("quality_score") or 0)
    except (ValueError, TypeError):
        score = 0
    score = max(0, min(100, score))

    return {
        "quality_score": score,
        "reasoning": str(result.get("reasoning") or "")[:500],
        "matched_signals": result.get("matched_signals") or [],
        "missing_signals": result.get("missing_signals") or [],
        "_meta": {
            "tokens_in": body.get("usage", {}).get("prompt_tokens"),
            "tokens_out": body.get("usage", {}).get("completion_tokens"),
        },
    }
