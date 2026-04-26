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

# Каталог архетипов (Марк–Пирсон) — DeepSeek опирается на него при выборе
# поля archetype в слепке. Фолбэк по векторам — если LLM поставил null.
try:
    from services.archetype_mapper import (
        archetype_catalog_for_prompt,
        infer_archetype_from_vectors,
        all_codes as _archetype_codes,
    )
except Exception:  # noqa: BLE001
    def archetype_catalog_for_prompt() -> str: return ""
    def infer_archetype_from_vectors(*_a, **_kw): return None
    def _archetype_codes(): return []

logger = logging.getLogger(__name__)

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT_S = 60.0


SYSTEM_PROMPT = (
    "Ты — аналитик, который из связки «психологический профиль + публичная активность в VK» "
    "строит структурированный «поведенческий слепок». Слепок используется сервисом Фреди для:\n"
    "  (1) точного поиска людей с такой же болью\n"
    "  (2) генерации крючкового сообщения\n\n"
    "ПРАВИЛО ТРИАНГУЛЯЦИИ — у тебя ТРИ источника, каждый со своей ролью:\n"
    "  • Тест (fredi_users.profile, поля profile_code/vectors/attachment/core_fears/defenses) — "
    "    БАЗОВЫЙ СКЕЛЕТ. Это объективный психологический профиль, выявленный через тест-задания. "
    "    От него нельзя отступать: если тест показал тревожную привязанность — значит так оно и есть.\n"
    "  • Контекст (fredi_user_contexts) — ЧТО ЧЕЛОВЕК САМ О СЕБЕ РАССКАЗАЛ. Это уточнение/подтверждение. "
    "    Конкретизирует тест: имя, обстоятельства, истории.\n"
    "  • Диалоги (последние user-сообщения Фреди) — ЧТО ЖИВЁТ ПРЯМО СЕЙЧАС. Самый «свежий» сигнал. "
    "    Здесь видна АКТИВНАЯ БОЛЬ — то, что прямо сегодня крутится в голове.\n\n"
    "Pain_point строй на пересечении ВСЕХ ТРЁХ. Если тест говорит про привязанность, "
    "контекст подтверждает что был партнёр, а в диалогах человек пишет про бессонницу — это и есть "
    "«не отпустить, ночные приступы». Если три источника противоречат — отметь это в `confidence`.\n\n"
    "В output обязательно укажи:\n"
    "  • pain_origin — какие источники подтвердили боль (массив из «test», «context», «dialogues»)\n"
    "  • confidence — насколько уверен в pain_point: «high» (3 источника), «medium» (2), «low» (1).\n\n"
    "Этический контур: outreach с правом игнора, никаких диагнозов, никаких манипуляций. "
    "Слепок — внутренний инструмент, получателю не показывается.\n\n"
    "ОСОБОЕ ВНИМАНИЕ:\n"
    "  • pain_point — конкретная активная боль. Должна звучать так, чтобы человек сказал «это про меня».\n"
    "  • desired_outcome — чего хочет и не получает.\n"
    "  • archetype — один из ровно этих кодов или null:\n"
    + "    " + ", ".join(_archetype_codes() or ["INNOCENT","SAGE","EXPLORER","HERO","OUTLAW","MAGICIAN","LOVER","JESTER","EVERYMAN","CREATOR","RULER","CAREGIVER"]) + "\n"
    "    Выбирай по сочетанию теста, контекста и активности в VK; не пиши русское имя архетипа,\n"
    "    только code из списка. Если ни один не подходит уверенно — null.\n"
    "  • marker_groups — ТОЛЬКО реальные id из vk_data.groups.items, не выдумывай.\n"
    "  • marker_keywords — слова, которые человек реально использует (из постов и диалогов).\n\n"
    + archetype_catalog_for_prompt() + "\n\n"
    "Возвращай СТРОГО валидный JSON по схеме, без markdown, без префиксов."
)


SCHEMA_HINT = """
Схема ответа (все поля обязательны, пустые значения — пустыми массивами/строками):
{
  "pain_point": "ОДНО предложение, что у человека болит прямо сейчас (или: «недостаточно данных для определения активной боли»). Конкретно, не общая тема. Пример: «Не может отпустить бывшего, ночные приступы тоски, постит цитаты про «вернуть».",
  "pain_origin": ["test"|"context"|"dialogues"],
  "confidence": "high"|"medium"|"low",
  "desired_outcome": "ОДНО предложение, чего он хочет и не получает. Пример: «Хочет, чтобы он сам написал и предложил вернуться».",
  "archetype": "INNOCENT|SAGE|EXPLORER|HERO|OUTLAW|MAGICIAN|LOVER|JESTER|EVERYMAN|CREATOR|RULER|CAREGIVER" | null,
  "problem_summary": "Один-два предложения общего описания проблематики (как мост от боли к контексту).",
  "key_themes": ["3–5 ключевых тем словами/короткими фразами"],
  "evidence_in_dialogue": [
    "1–3 коротких ЦИТАТЫ из последних user-сообщений Фреди, где видно эту боль. Точные слова в кавычках. Если цитат нет — пустой массив."
  ],
  "evidence_in_vk": [
    "1–3 наблюдения с VK: какой пост, статус, цитата из био или выбор группы указывает на эту боль. Кратко, конкретно."
  ],
  "vulnerability_window": "Когда человек с этой болью наиболее открыт к диалогу. Примеры: «после ссоры/расставания», «ночью когда не спит», «в воскресенье вечером». Если непонятно — «недостаточно данных».",
  "marker_groups": [
    {"id": <int|null>, "name": "...", "screen_name": "..."}
  ],
  "marker_keywords": ["8–15 слов и фраз, характерных для этой боли, на основе постов и диалогов"],
  "demographics": {
    "sex": "m" | "f" | null,
    "age_range": [<int>, <int>] | null,
    "city": "..." | null,
    "city_id": <int|null>,
    "country_id": <int|null>
  },
  "post_tone": "негативный" | "нейтральный" | "позитивный" | "смешанный" | "недостаточно данных",
  "activity_pattern": "ночная (23:00–03:00)" | "дневная" | "вечерняя" | "круглосуточная" | "недостаточно данных",
  "search_recommendation": {
    "geo_scope": "same_city" | "russia" | "worldwide",
    "rationale": "Одно предложение почему именно так. Например: «Боль про конкретный местный круг — искать в том же городе»; «Тема универсальная — Россия»; «Очень нишевая — нет смысла ограничивать географию»."
  },
  "search_strategies": [
    "Конкретные подсказки на естественном языке: какие шаги поиска имеет смысл сделать. Пример: «groups.getMembers по marker_groups[0..2] → пересечь»; «users.search q=<keyword>, sex=<sex>, age_from=<lo>, age_to=<hi>»."
  ]
}

ВАЖНО:
- marker_groups бери ТОЛЬКО из реального vk_data.groups.items, ничего не выдумывай.
- Если групп в vk_data нет (closed профиль / error) — marker_groups = [], в search_strategies объясни что искать без групп (через keywords + demographics).
- evidence_in_dialogue — точные цитаты в кавычках, не пересказ.
- pain_point должна быть РЕЗОНАНСНОЙ — слова, в которых человек узнает себя.
- demographics.city_id и country_id — только если реально есть в данных. country_id для России = 1.
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


def _assess_data_quality(features: Dict[str, Any], vk_data: Dict[str, Any]) -> Dict[str, Any]:
    """Считаем «качество данных» 0..100 для решения, стоит ли запускать поиск
    близнецов сейчас. Работаем по факту того, что лежит в `features` после
    DeepSeek-экстракции и в `vk_data` от VK API.

    Шкала:
      • группы:    5+ → +30, 1–4 → +15, 0 → +0
      • маркер.слова: 10+ → +30, 1–9 → +15, 0 → +0
      • город:     есть → +20
      • биография/about/status: есть → +10
      • стена не закрыта (есть посты) → +10
    """
    score = 0
    issues: List[str] = []

    marker_groups = features.get("marker_groups") or []
    if len(marker_groups) >= 5:
        score += 30
    elif len(marker_groups) > 0:
        score += 15
        issues.append(f"мало релевантных групп ({len(marker_groups)} — нужно от 5)")
    else:
        issues.append("нет маркер-групп — профиль может быть закрыт или пуст")

    marker_keywords = features.get("marker_keywords") or []
    if len(marker_keywords) >= 10:
        score += 30
    elif len(marker_keywords) > 0:
        score += 15
        issues.append(f"мало маркер-слов ({len(marker_keywords)} — нужно от 10)")
    else:
        issues.append("нет маркер-слов — слишком мало постов для анализа")

    demo = features.get("demographics") or {}
    if demo.get("city") or demo.get("city_id"):
        score += 20
    else:
        issues.append("не указан город — сложнее фильтровать по гео")

    user = (vk_data or {}).get("user") or {}
    if (user.get("about") or "").strip() or (user.get("status") or "").strip():
        score += 10
    else:
        issues.append("пустые about/status — мало личного контента")

    wall = (vk_data or {}).get("wall") or {}
    wall_items = wall.get("items") or []
    if "error" in wall:
        issues.append(f"стена закрыта/ошибка: {wall.get('error')}")
    elif len(wall_items) >= 5:
        score += 10
    else:
        issues.append("на стене меньше 5 постов")

    score = max(0, min(100, score))
    if score >= 70:
        level = "high"
        recommendation = "можно запускать поиск близнецов прямо сейчас"
    elif score >= 40:
        level = "medium"
        recommendation = "можно искать, но точность будет средней — рассмотри попросить юзера дополнить профиль"
    else:
        level = "low"
        recommendation = "сначала добери данные: попроси открыть профиль / дописать о себе / указать город"

    return {
        "score": score,
        "level": level,
        "issues": issues,
        "recommendation": recommendation,
    }


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
    features.setdefault("pain_point", "")
    features.setdefault("pain_origin", [])
    features.setdefault("confidence", "low")
    features.setdefault("desired_outcome", "")
    features.setdefault("archetype", None)
    # Оценка качества данных — оператор видит, имеет ли смысл звать
    # Близнецов сейчас или сначала просить у юзера больше данных
    # (открыть профиль, дописать пост, указать город). Считается из реальных
    # vk_data, чтобы не зависеть от качества LLM-экстракции.
    features["data_quality"] = _assess_data_quality(features, vk_data)
    # Если LLM не выбрал архетип — дожимаем эвристикой по векторам теста.
    if not features.get("archetype"):
        try:
            test_profile = (composite_profile or {}).get("profile") or {}
            vectors = test_profile.get("vectors") or {}
            # Векторы в БД могут лежать как {"СБ": 5} или {"sb": 5} — пробуем оба.
            features["archetype"] = infer_archetype_from_vectors(
                sb=vectors.get("СБ") or vectors.get("SB") or vectors.get("sb"),
                tf=vectors.get("ТФ") or vectors.get("TF") or vectors.get("tf"),
                ub=vectors.get("УБ") or vectors.get("UB") or vectors.get("ub"),
                cv=vectors.get("ЧВ") or vectors.get("CV") or vectors.get("cv"),
            )
        except Exception as _e:
            logger.debug(f"archetype heuristic fallback failed: {_e}")
            features["archetype"] = None
    features.setdefault("problem_summary", "")
    features.setdefault("key_themes", [])
    features.setdefault("evidence_in_dialogue", [])
    features.setdefault("evidence_in_vk", [])
    features.setdefault("vulnerability_window", "недостаточно данных")
    features.setdefault("marker_groups", [])
    features.setdefault("marker_keywords", [])
    features.setdefault("demographics", {})
    features.setdefault("post_tone", "недостаточно данных")
    features.setdefault("activity_pattern", "недостаточно данных")
    features.setdefault("search_recommendation", {"geo_scope": "russia", "rationale": ""})
    features.setdefault("search_strategies", [])

    # Метаданные о вызове — пригодятся в дебаге.
    features["_meta"] = {
        "model": payload["model"],
        "tokens_in": body.get("usage", {}).get("prompt_tokens"),
        "tokens_out": body.get("usage", {}).get("completion_tokens"),
    }
    return features
