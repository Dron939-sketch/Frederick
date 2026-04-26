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

# Архетипный пакет (Марк–Пирсон) подмешиваем в system prompt, когда экстрактор
# его определил. Тон голоса и характер крючка зависят от архетипа.
try:
    from services.archetype_mapper import archetype_directives_for_outreach
except Exception:  # noqa: BLE001
    def archetype_directives_for_outreach(_code): return ""

logger = logging.getLogger(__name__)

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT_S = 60.0

FREDI_LANDING = "https://meysternlp.ru/fredi/"


SYSTEM_PROMPT = (
    "Ты — копирайтер сервиса «Фреди» (бесплатный бот-психолог). Твоя задача: написать одно короткое "
    "сообщение в VK человеку, чтобы он почувствовал «это про меня» и захотел попробовать.\n\n"
    "КЛЮЧЕВОЙ ИНСАЙТ: тебе на вход дают pain_point и desired_outcome нашего исходного клиента — "
    "это та же активная боль/желание, что (по нашим оценкам) есть и у получателя сообщения. "
    "Твоя цель — НЕ озвучить эту боль прямо (это пугает и звучит как слежка), а написать так, "
    "чтобы получатель сам в неё узнался. Это и есть «крючок».\n\n"
    "ПРАВИЛА КРЮЧКА (как именно резонировать без называния):\n"
    "  • Опиши не диагноз, а живую сцену/состояние, в котором узнаются люди с такой болью. "
    "    Пример (если pain = «не отпустить бывшего, ночные приступы»): «Бывает такое — "
    "    лежишь ночью, прокручиваешь, что надо было сказать иначе. Я не знаю, твоё ли это, но если да…»\n"
    "  • Используй неопределённые формулировки («бывает такое», «иногда», «если когда-то…»), "
    "    оставляющие получателю пространство сказать «нет, не моё» и закрыть.\n"
    "  • Соединяй с нейтральным мостиком: общая группа, статус, интерес, что угодно.\n"
    "  • ЭХО-ПРИЁМ: если в данных есть его собственный коммент или пост — НЕ цитируй прямо, "
    "    а переформулируй смысл его же словами (на 60–70%). Это даёт «о, это будто про меня», "
    "    но не «о, они читают мою стену». Например, если он написал «лежу ночью прокручиваю что зря "
    "    сказал», ты пишешь «бывает такое — лежишь и прокручиваешь, что зря сказал».\n\n"
    "СТРУКТУРА СООБЩЕНИЯ — тот шаблон, который реально работает:\n"
    "  1. Зацепка (1–2 предложения): эхо его состояния через сцену/«бывает».\n"
    "  2. Нормализация (1 предложение): не «у тебя проблема», а «это типичная вещь — "
    "     многие в этой точке».\n"
    "  3. Что предлагаем (1–2 предложения): «у меня есть Фреди — бесплатный ИИ-психолог. "
    "     С ним можно проговорить это голосом или текстом. Иногда хватает 10 минут».\n"
    "  4. Мягкий призыв с правом на «нет»: «если зайдёт — " + FREDI_LANDING + ". Не зайдёт — забей.»\n\n"
    "ЖЁСТКИЕ ЗАПРЕТЫ:\n"
    "1. НЕ упоминай что мы анализировали его профиль, искали по группам, подбирали под проблему.\n"
    "2. НЕ ставь диагнозов («у тебя травматическая привязанность», «ты в депрессии»). НЕ цитируй "
    "   pain_point дословно. НЕ давай оценок личности.\n"
    "3. НЕ обещай результат, не используй ложную срочность («только сегодня»), не давай гарантий.\n"
    "4. НЕ симулируй дружбу («давно тебя замечаю»), не флиртуй.\n"
    "5. Уважай право проигнорировать. В конце — мягкий выход: «если зайдёт — потыкай: " + FREDI_LANDING + ". Если нет — забей, я не обижусь».\n\n"
    "ФОРМА:\n"
    "  • На «ты» (если статус более формальный — «вы»). По-человечески, без корпоратива.\n"
    "  • 3–5 предложений, 280–500 символов.\n"
    "  • 0–2 эмодзи максимум. Без CAPS, без рекламных штампов («предлагаем уникальное решение»).\n"
    "  • Обязательно ссылка " + FREDI_LANDING + " ровно один раз.\n\n"
    "ВЫХОД — строго JSON:\n"
    "{\n"
    "  \"draft\": \"основной вариант, который ты считаешь самым попадающим\",\n"
    "  \"alternatives\": [\n"
    "    \"вариант 2 — заход с ДРУГОГО угла (например, через статус или группу вместо состояния)\",\n"
    "    \"вариант 3 — ещё короче и нейтральнее, для осторожных получателей\"\n"
    "  ],\n"
    "  \"reasoning\": \"одно предложение для оператора: какой именно крючок и почему он должен сработать\",\n"
    "  \"hook_used\": \"конкретный мостик основного варианта (например: «общая группа + ночная сцена»)\",\n"
    "  \"pain_targeted\": \"какую именно боль (1 фраза) ты пытаешься зацепить в этом сообщении\"\n"
    "}\n"
    "Никакого markdown, никаких префиксов вроде ```json — только сам JSON."
)


def _build_user_prompt(source_features: Dict[str, Any], candidate: Dict[str, Any]) -> str:
    # Phase 6: pain_point — главная цель крючка. Если её нет — fallback на problem_summary.
    src_pain = (source_features.get("pain_point") or "").strip()
    src_desire = (source_features.get("desired_outcome") or "").strip()
    src_problem = source_features.get("problem_summary") or "(не указано)"
    src_themes = source_features.get("key_themes") or []
    src_vuln = (source_features.get("vulnerability_window") or "").strip()
    src_evidence_dlg = source_features.get("evidence_in_dialogue") or []
    src_evidence_vk = source_features.get("evidence_in_vk") or []

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
    blocks.append("=== ЦЕЛЬ ОБРАЩЕНИЯ — pain_point (НЕ озвучивать получателю!) ===")
    if src_pain:
        blocks.append(f"Боль/неудовлетворённая потребность: {src_pain}")
    if src_desire:
        blocks.append(f"Чего хочет получить: {src_desire}")
    if src_vuln:
        blocks.append(f"Окно открытости (когда такие люди готовы говорить): {src_vuln}")
    blocks.append(f"Контекст: {src_problem}")
    if src_themes:
        blocks.append(f"Темы: {', '.join(src_themes[:5])}")
    if src_evidence_dlg:
        blocks.append("Цитаты, как звучит боль изнутри (из диалогов нашего клиента, для калибровки тона):")
        for q in src_evidence_dlg[:3]:
            blocks.append(f"  — «{q}»")
    if src_evidence_vk:
        blocks.append("Как боль проявляется в VK у похожих людей (для калибровки наблюдений):")
        for o in src_evidence_vk[:3]:
            blocks.append(f"  • {o}")

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

    # Триггер-текст: реальные слова получателя (его коммент или его пост,
    # по которым мы его нашли). Это самая мощная зацепка — copywriter
    # должен сделать «эхо» (узнавание без прямого цитирования).
    trig_c = (candidate.get("triggering_comment") or {}) if isinstance(candidate.get("triggering_comment"), dict) else {}
    trig_p = (candidate.get("triggering_post") or {}) if isinstance(candidate.get("triggering_post"), dict) else {}
    if trig_c.get("text"):
        blocks.append(
            "\n=== ЕГО СЛОВА (триггер-комментарий, который и привёл нас к нему) ==="
        )
        blocks.append(f"«{trig_c['text']}»")
        blocks.append(
            "Не цитируй дословно. Сделай ЭХО: переформулируй смысл его же словами "
            "(чуть проще или с другой стороны), чтобы он узнал себя в твоём тексте."
        )
    elif trig_p.get("text"):
        blocks.append(
            "\n=== ЕГО ПОСТ (по которому мы его нашли) ==="
        )
        blocks.append(f"«{trig_p['text']}»")
        blocks.append(
            "Не цитируй дословно. Сделай ЭХО: говори про то же состояние, "
            "но другими словами, чтобы он узнал себя без чувства слежки."
        )
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

    # Архетип получателя — общий с исходным клиентом (мы ищем близнецов).
    # Если архетип определён, подмешиваем его директивы в system prompt:
    # тон, какую боль бить, что обещать. Без этого copywriter может писать
    # Бунтарю как Невинному.
    archetype_block = archetype_directives_for_outreach(source_features.get("archetype"))
    system_content = SYSTEM_PROMPT + ("\n\n" + archetype_block if archetype_block else "")

    payload = {
        "model": model or DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_content},
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
    result.setdefault("pain_targeted", "")
    result["_meta"] = {
        "model": payload["model"],
        "tokens_in": body.get("usage", {}).get("prompt_tokens"),
        "tokens_out": body.get("usage", {}).get("completion_tokens"),
    }
    return result
