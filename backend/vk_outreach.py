"""
vk_outreach.py — DeepSeek-powered генератор персональных сообщений (Phase 5A).

На вход:
  - source_features: слепок исходного клиента Фреди (что у него за проблема,
    темы, marker_groups). НЕ передаём кандидату — это наш контекст.
  - candidate_data: что мы знаем о кандидате из VK (имя, статус, пересекающиеся
    группы, демография).

На выход:
  - draft: основной вариант сообщения (3-5 предложений)
  - alternatives: 1-2 альтернативы с другим заходом
  - reasoning: короткое обоснование почему именно так

Этический контур (зашит в system prompt):
  - Сообщение не должно упоминать «мы вас профилировали» / «нашли вас по группе» —
    это пугает.
  - Не давить, не использовать срочность, не симулировать дружбу.
  - Не обещать терапию или диагноз — только бесплатную консультацию у бота.
  - Уважать право проигнорировать.
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

FREDI_LANDING = "https://meysternlp.ru/fredi/"


SYSTEM_PROMPT = (
    "Ты — копирайтер сервиса «Фреди» (Telegram/web-бот, бесплатный психолог). Твоя задача: "
    "написать одно короткое личное сообщение от лица сервиса человеку в VK, чтобы предложить "
    "ему попробовать бесплатно поговорить с ботом-психологом.\n\n"
    "ПРАВИЛА:\n"
    "1. Пиши на «ты» (или «вы» если в статусе явно более формальный тон), по-человечески, "
    "без корпоративного жаргона. 3-5 предложений, 250-400 символов максимум.\n"
    "2. НЕ упоминай что мы анализировали профиль, искали по группам или подбирали под проблему. "
    "Это создаёт ощущение слежки и отталкивает.\n"
    "3. Заход — через нейтральный мостик: общая группа («увидела тебя в …»), общий интерес, "
    "статус кандидата. Без давления.\n"
    "4. НЕ ставь диагнозов («у тебя травматическая привязанность», «вы в депрессии»). НЕ обещай "
    "результат. НЕ упоминай что у нас на тебя «слепок». Просто говори про бота как про инструмент.\n"
    "5. В конце — короткая ссылка " + FREDI_LANDING + " и приглашение «потыкать без обязательств». "
    "Уважение к выбору проигнорировать сообщение.\n"
    "6. Без эмодзи в избытке (одно-два допустимо). Без CAPS. Без рекламных штампов.\n\n"
    "ВЫХОД — строго JSON:\n"
    "{\n"
    "  \"draft\": \"основной вариант\",\n"
    "  \"alternatives\": [\"вариант 2 с другим заходом\", \"вариант 3\"],\n"
    "  \"reasoning\": \"одно предложение почему именно такой заход (для оператора)\",\n"
    "  \"hook_used\": \"какой именно мостик использован\"\n"
    "}\n"
    "Никакого markdown, никаких префиксов вроде ```json — только сам JSON."
)


def _build_user_prompt(source_features: Dict[str, Any], candidate: Dict[str, Any]) -> str:
    src_problem = source_features.get("problem_summary") or "(не указано)"
    src_themes = source_features.get("key_themes") or []

    cand = candidate.get("data") or candidate  # допускаем оба формата
    name = (cand.get("first_name") or "").strip()
    last = (cand.get("last_name") or "").strip()
    sex = cand.get("sex")
    sex_label = {1: "женский", 2: "мужской"}.get(sex, "не указан")
    status = (cand.get("status") or "").strip()[:200]
    about = (cand.get("about") or "").strip()[:200]
    bdate = (cand.get("bdate") or "").strip()
    city = (cand.get("city") or "").strip()
    matched_groups = candidate.get("matched_groups") or []
    matched_names = [g.get("name") or "?" for g in matched_groups if isinstance(g, dict)][:3]

    blocks: List[str] = []
    blocks.append("=== Контекст: что за проблематика у нашего клиента (НЕ упоминать кандидату!) ===")
    blocks.append(f"Кратко: {src_problem}")
    if src_themes:
        blocks.append(f"Темы: {', '.join(src_themes[:5])}")

    blocks.append("\n=== Кандидат, которому пишем ===")
    blocks.append(f"Имя: {name} {last}".strip())
    if sex_label != "не указан":
        blocks.append(f"Пол: {sex_label}")
    if bdate:
        blocks.append(f"Дата рождения: {bdate}")
    if city:
        blocks.append(f"Город: {city}")
    if status:
        blocks.append(f"Статус (то что у него в шапке VK): «{status}»")
    if about:
        blocks.append(f"О себе: «{about}»")
    if matched_names:
        blocks.append(f"Общие с нашим клиентом группы: {', '.join(matched_names)}")
    else:
        blocks.append("Общих групп нет (нашли через другой признак).")

    blocks.append("\nНапиши сообщение по правилам выше. Верни JSON.")
    return "\n".join(blocks)


async def draft_message(
    source_features: Dict[str, Any],
    candidate: Dict[str, Any],
    *,
    model: Optional[str] = None,
    temperature: float = 0.7,
) -> Dict[str, Any]:
    """Генерит черновик сообщения. Кидает RuntimeError при сбое DeepSeek."""
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY не задан в env")

    user_msg = _build_user_prompt(source_features, candidate)

    payload = {
        "model": model or DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
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

    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].lstrip()

    try:
        result = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"DeepSeek вернул не-JSON: {e}; text={text[:300]}")

    if not isinstance(result, dict):
        raise RuntimeError("DeepSeek вернул не объект")

    result.setdefault("draft", "")
    result.setdefault("alternatives", [])
    result.setdefault("reasoning", "")
    result.setdefault("hook_used", "")
    result["_meta"] = {
        "model": payload["model"],
        "tokens_in": body.get("usage", {}).get("prompt_tokens"),
        "tokens_out": body.get("usage", {}).get("completion_tokens"),
    }
    return result
