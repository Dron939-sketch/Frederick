"""
vk_feature_extractor.py — DeepSeek-powered «слепок» юзера для матчинга близнецов.

На вход:
  - composite_profile: тест + контекст + последние диалоги (что юзер рассказал Фреди)
  - vk_data: спарсенные публичные данные (users.get + wall.get + groups.get)

На выход — структурированный JSON-«слепок»:
  problem_summary, key_themes, marker_groups, marker_keywords,
  demographics, post_tone, activity_pattern, search_strategies.

Этот слепок используется в Phase 4 (поиск близнецов) для:
  - groups.getMembers по marker_groups
  - users.search с marker_keywords + demographics

DEEPSEEK_API_KEY читается из env (уже в Render).
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT_S = 60.0


SYSTEM_PROMPT = (
    "Ты — аналитик, который из связки «психологический профиль человека + его публичная активность в VK» "
    "строит структурированный «поведенческий слепок» для последующего поиска похожих людей в социальных сетях.\n\n"
    "Цель использования: сервис психологической поддержки ищет людей с похожей проблематикой "
    "и предлагает им бесплатную консультацию у Фреди. Это outreach с явным согласием на ответ "
    "(человек волен проигнорировать сообщение). Никакой слежки, эксплуатации или таргетинга на уязвимых "
    "групп без их согласия — слепок нужен только для разумного подбора темы первого сообщения.\n\n"
    "Возвращай СТРОГО валидный JSON по указанной схеме, без пояснений, без markdown, без префиксов."
)


SCHEMA_HINT = """
Схема ответа (все поля обязательны, пустые значения — пустыми массивами/строками):
{
  "problem_summary": "Одно предложение про основную проблематику (на русском). Пример: «Травматическая привязка к бывшему партнёру, женщина 25–35 лет, ночные приступы тоски и руминация».",
  "key_themes": ["3–5 ключевых тем словами/короткими фразами"],
  "marker_groups": [
    {"id": <int|null>, "name": "...", "screen_name": "..."}
  ],
  "marker_keywords": ["8–15 слов и фраз, характерных для этой проблематики, на основе постов и диалогов"],
  "demographics": {
    "sex": "m" | "f" | null,
    "age_range": [<int>, <int>] | null,
    "city": "..." | null,
    "city_id": <int|null>
  },
  "post_tone": "негативный" | "нейтральный" | "позитивный" | "смешанный" | "недостаточно данных",
  "activity_pattern": "ночная (23:00–03:00)" | "дневная" | "вечерняя" | "круглосуточная" | "недостаточно данных",
  "search_strategies": [
    "Краткие подсказки на естественном языке: какие шаги поиска близнецов имеет смысл сделать, в каком порядке. Примеры: «groups.getMembers по marker_groups[0..2] → пересечь», «users.search city=<city> sex=<sex> age_from=<lo> age_to=<hi> q=<keyword>»."
  ]
}

ВАЖНО:
- marker_groups бери только из реального списка vk_data.groups.items, ничего не выдумывай.
- Если групп в vk_data нет (closed профиль / error) — marker_groups = [], и search_strategies объясни что искать без групп.
- marker_keywords строй на пересечении того, что человек писал Фреди, и того, что есть в его постах. Если пересечения нет — бери из диалогов с Фреди.
- demographics.city_id заполняй только если реально знаешь VK city id (из user.city.id).
"""


def _summarize_messages(messages: List[Dict[str, Any]], char_budget: int = 4000) -> str:
    """Берём только user-сообщения, обрезаем под бюджет."""
    out: List[str] = []
    used = 0
    for m in messages:
        if (m.get("role") or "") != "user":
            continue
        text = str(m.get("content") or "").strip()
        if not text:
            continue
        chunk = "- " + text[:600]
        if used + len(chunk) > char_budget:
            out.append("…[обрезано]")
            break
        out.append(chunk)
        used += len(chunk) + 1
    return "\n".join(out) or "(сообщений нет)"


def _summarize_vk(vk_data: Dict[str, Any]) -> Dict[str, Any]:
    """Сжимаем vk_data, чтобы влезть в контекст модели."""
    user = vk_data.get("user") or {}
    wall = vk_data.get("wall") or {}
    groups = vk_data.get("groups") or {}

    def _safe_get(d, k, default=None):
        v = d.get(k) if isinstance(d, dict) else None
        return v if v is not None else default

    user_brief: Dict[str, Any] = {
        "id": user.get("id"),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "sex": user.get("sex"),
        "bdate": user.get("bdate"),
        "city": _safe_get(user.get("city") or {}, "title"),
        "city_id": _safe_get(user.get("city") or {}, "id"),
        "status": (user.get("status") or "")[:200],
        "about": (user.get("about") or "")[:300],
        "interests": (user.get("interests") or "")[:300],
        "music": (user.get("music") or "")[:200],
        "books": (user.get("books") or "")[:200],
        "movies": (user.get("movies") or "")[:200],
        "quotes": (user.get("quotes") or "")[:200],
        "is_closed": user.get("is_closed"),
    }

    wall_brief: Dict[str, Any]
    if "error" in wall:
        wall_brief = {"error": wall.get("error")}
    else:
        items = wall.get("items") or []
        texts: List[str] = []
        for p in items[:30]:
            t = (p.get("text") or "").strip()
            if t:
                texts.append(t[:280])
        wall_brief = {
            "count": wall.get("count"),
            "sample_texts": texts[:20],
        }

    groups_brief: Dict[str, Any]
    if "error" in groups:
        groups_brief = {"error": groups.get("error")}
    else:
        items = groups.get("items") or []
        gs: List[Dict[str, Any]] = []
        for g in items[:30]:
            gs.append({
                "id": g.get("id"),
                "name": (g.get("name") or "")[:120],
                "screen_name": g.get("screen_name") or "",
                "activity": (g.get("activity") or "")[:80],
            })
        groups_brief = {"count": groups.get("count"), "items": gs}

    return {"user": user_brief, "wall": wall_brief, "groups": groups_brief}


def _build_user_message(composite: Dict[str, Any], vk_data: Dict[str, Any]) -> str:
    profile = composite.get("profile") or {}
    context = composite.get("context") or {}
    user_meta = composite.get("user") or {}
    msgs = composite.get("messages") or []

    blocks: List[str] = []

    blocks.append("=== Психологический профиль (тест + что Фреди про юзера записал) ===")
    blocks.append(json.dumps(profile, ensure_ascii=False, indent=2, default=str))

    if context:
        blocks.append("\n=== Контекст пользователя (что он рассказал о себе) ===")
        blocks.append(json.dumps(context, ensure_ascii=False, indent=2, default=str)[:3000])

    if user_meta:
        blocks.append("\n=== Telegram/web-учётка ===")
        blocks.append(json.dumps({
            "first_name": user_meta.get("first_name"),
            "last_name": user_meta.get("last_name"),
            "language": user_meta.get("language_code"),
        }, ensure_ascii=False, default=str))

    blocks.append("\n=== Последние user-сообщения Фреди (чем человек живёт сейчас) ===")
    blocks.append(_summarize_messages(msgs))

    blocks.append("\n=== Спарсенные публичные данные VK ===")
    blocks.append(json.dumps(_summarize_vk(vk_data), ensure_ascii=False, indent=2, default=str))

    blocks.append("\n" + SCHEMA_HINT.strip())
    blocks.append("\nВерни JSON.")
    return "\n".join(blocks)


async def extract_features(
    composite_profile: Dict[str, Any],
    vk_data: Dict[str, Any],
    *,
    model: Optional[str] = None,
    temperature: float = 0.2,
) -> Dict[str, Any]:
    """Вызывает DeepSeek и возвращает распарсенный «слепок» (dict).

    Кидает RuntimeError если:
      - DEEPSEEK_API_KEY не задан,
      - сетевая ошибка / non-200 от DeepSeek,
      - модель вернула не-JSON.
    """
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY не задан в env")

    prompt = _build_user_message(composite_profile, vk_data)

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
        raise RuntimeError(f"DeepSeek network error: {e}")

    if r.status_code != 200:
        raise RuntimeError(f"DeepSeek HTTP {r.status_code}: {r.text[:400]}")

    body = r.json()
    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError(f"DeepSeek: unexpected response shape: {str(body)[:400]}")

    # Иногда модели оборачивают JSON в markdown ```json ... ``` несмотря на
    # response_format=json_object. Защищаемся.
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].lstrip()

    try:
        features = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"DeepSeek вернул не-JSON: {e}; text={text[:300]}")

    if not isinstance(features, dict):
        raise RuntimeError("DeepSeek вернул не объект")

    # Минимальная нормализация — гарантируем что ключи присутствуют.
    features.setdefault("problem_summary", "")
    features.setdefault("key_themes", [])
    features.setdefault("marker_groups", [])
    features.setdefault("marker_keywords", [])
    features.setdefault("demographics", {})
    features.setdefault("post_tone", "недостаточно данных")
    features.setdefault("activity_pattern", "недостаточно данных")
    features.setdefault("search_strategies", [])

    # Метаданные о вызове — пригодятся в дебаге.
    features["_meta"] = {
        "model": payload["model"],
        "tokens_in": body.get("usage", {}).get("prompt_tokens"),
        "tokens_out": body.get("usage", {}).get("completion_tokens"),
    }
    return features
