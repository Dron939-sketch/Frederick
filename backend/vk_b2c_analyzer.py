#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_b2c_analyzer.py
Глубокий анализ ОДНОЙ страницы VK для прицельного аутрича (B2C).

Стратегия: «9 из 10». Цель — крючок такой силы, чтобы получатель не смог
проигнорировать. Для этого нужна максимальная плотность контекста и
несколько проходов LLM:

  Pass 1 (psychological_profile):
     все данные страницы → DeepSeek → состояние, защиты, типичные паттерны.

  Pass 2 (active_pain):
     профиль + последние 30 постов → DeepSeek → конкретная активная боль
     (что болит сегодня, не общая тема).

  Pass 3 (hooks):
     профиль + боль + цитаты из постов/статуса → DeepSeek копирайтер
     генерит 3 крючка разной интонации:
       - мягкий («бывает такое...»)
       - прямой («заметил что у тебя...»)
       - эмоциональный («не знаю как объяснить, но твой пост зацепил...»)
     Каждый — сам себе оценивает score 0..100 «вероятность ответа».

Без БД. Транзитный режим, оператор копирует и шлёт сам.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

import httpx

from vk_parser import _call, parse_user

logger = logging.getLogger(__name__)


DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
TIMEOUT_S = 60.0

FREDI_LANDING = "https://meysternlp.ru/fredi/"


_PROFILE_SYSTEM = (
    "Ты — психоаналитик. На вход — анкета человека из VK (имя, статус, "
    "о себе, посты, группы, музыка, счётчики). Дай развёрнутый "
    "психологический портрет:\n"
    "  • вероятный темперамент / тип характера\n"
    "  • защитные механизмы (что человек прячет)\n"
    "  • активные паттерны (как он реагирует на стресс, на отношения)\n"
    "  • архетип по Марк-Пирсон (один из 12: INNOCENT/SAGE/EXPLORER/HERO/"
    "    OUTLAW/MAGICIAN/LOVER/JESTER/EVERYMAN/CREATOR/RULER/CAREGIVER)\n"
    "  • уровень публичной открытости (закрыт/средне/открыт)\n"
    "Возвращай СТРОГО JSON:\n"
    "{\n"
    "  \"profile\": \"3-5 предложений психологический портрет\",\n"
    "  \"defenses\": [\"защита1\", \"защита2\"],\n"
    "  \"patterns\": [\"паттерн1\", \"паттерн2\"],\n"
    "  \"archetype\": \"CODE\",\n"
    "  \"openness\": \"закрыт|средне|открыт\"\n"
    "}\n"
    "Без markdown, только JSON."
)


_PAIN_SYSTEM = (
    "Ты — клинический психолог. На вход — психологический портрет + последние "
    "30 постов человека. Найди КОНКРЕТНУЮ АКТИВНУЮ БОЛЬ — то, что у него болит "
    "ПРЯМО СЕЙЧАС (не общая тема).\n\n"
    "ОБЯЗАТЕЛЬНО:\n"
    "  • цитата из его реальных слов (то что он сам написал) — это самый сильный сигнал\n"
    "  • цитаты ЗАВЕРШЁННЫЕ — кончаются на знаке препинания или многоточии. "
    "    НЕ обрывай посреди слова («что зна» — плохо). Длина 60-200 символов.\n"
    "  • конкретность: не «одиночество», а «недавно расстался, по вечерам тяжело»\n"
    "  • если активной боли НЕТ (всё ок) — так и скажи\n\n"
    "Возвращай JSON:\n"
    "{\n"
    "  \"pain_active\": \"что болит, 1-2 предложения\",\n"
    "  \"pain_intensity\": \"низкая|средняя|высокая\",\n"
    "  \"evidence_quotes\": [\"его реальные цитаты\"],\n"
    "  \"desired_outcome\": \"чего он хочет\",\n"
    "  \"vulnerability_window\": \"когда он наиболее открыт к диалогу\"\n"
    "}\n"
    "Без markdown."
)


_HOOK_SYSTEM = (
    "Ты — копирайтер сервиса Фреди (бесплатный AI-психолог). На вход — "
    "профиль человека + его боль + его цитаты. Сгенерируй 3 разных «крючка» — "
    "первое сообщение в VK с разной интонацией:\n\n"
    "  1. SOFT — мягкий, через «бывает такое», «иногда», «у многих». "
    "     Минимум прямого попадания, оставляет пространство «не моё».\n"
    "  2. DIRECT — прямой, через эхо его реальных слов. Перефразируй (не цитируй) "
    "     то что он написал, чтобы он узнал себя в твоём тексте.\n"
    "  3. EMOTIONAL — эмоциональный, начинается с «зацепило», «прочитал и понял», "
    "     показывает что ты прочитал его пост.\n\n"
    "ЖЁСТКИЕ ЗАПРЕТЫ (для всех вариантов):\n"
    "  • НЕ упоминай что мы анализировали его профиль.\n"
    "  • НЕ ставь диагнозов.\n"
    "  • НЕ цитируй дословно — ЭХО (60-70% перефраза).\n"
    "  • НЕ обещай результат, не гарантируй, не давай срочности.\n"
    "  • Уважай право на «нет» — мягкий выход в конце.\n\n"
    "СТРУКТУРА каждого варианта:\n"
    "  1) зацепка (1-2 предложения, эхо его состояния)\n"
    "  2) нормализация («это типичное, многие в этой точке»)\n"
    "  3) что есть Фреди — бесплатный AI-психолог\n"
    "  4) мягкий призыв с правом на нет: «если зайдёт — " + FREDI_LANDING +
    ". Если нет — забей.»\n\n"
    "Каждый вариант 280-500 символов, на «ты», 0-2 эмодзи.\n\n"
    "Для КАЖДОГО варианта дай само сообщение, причину почему он сработает, и "
    "СОБСТВЕННУЮ оценку 0..100 «вероятность что человек ответит».\n\n"
    "Возвращай JSON:\n"
    "{\n"
    "  \"variants\": [\n"
    "    {\"tone\": \"soft|direct|emotional\", \"text\": \"...\", "
    "\"reasoning\": \"...\", \"score\": 75},\n"
    "    ...\n"
    "  ],\n"
    "  \"best_tone\": \"soft|direct|emotional\",\n"
    "  \"strategy_summary\": \"одно предложение для оператора\"\n"
    "}\n"
    "Без markdown."
)


_SCREEN_NAME_RE = re.compile(
    r"(?:vk\.com/|^)([a-zA-Z0-9_\.]+)$"
)


def _resolve_screen_name(url_or_name: str) -> str:
    """Нормализация любых VK-ссылок → screen_name или idN.

    Принимает: https/http/нет-протокола, vk.com / m.vk.com / www.vk.com / vk.ru,
    с/без trailing-slash, query, hash, @-префикса, кавычек, /wall_xxx путей.
    """
    s = (url_or_name or "").strip()
    if not s:
        return ""
    s = s.strip("«»\"'() \t\n\r")
    if s.startswith("@"):
        s = s[1:]
    s = s.split("#", 1)[0]
    s = s.split("?", 1)[0]
    low = s.lower()
    if low.startswith("https://"):
        s = s[8:]
    elif low.startswith("http://"):
        s = s[7:]
    for prefix in ("www.vk.com/", "www.vk.ru/", "m.vk.com/", "m.vk.ru/", "vk.com/", "vk.ru/"):
        if s.lower().startswith(prefix):
            s = s[len(prefix):]
            break
    if "/" in s:
        s = s.split("/", 1)[0]
    s = s.strip().rstrip("/")
    return s


async def _deepseek(
    messages: List[Dict[str, str]],
    temperature: float = 0.4,
    feature: str = "vk_b2c_analyzer",
) -> Dict[str, Any]:
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY missing")
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
        r = await client.post(
            DEEPSEEK_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    body = r.json()
    content = body["choices"][0]["message"]["content"]
    # Учёт расходов (fire-and-forget).
    try:
        import asyncio as _aio
        from services.api_usage import log_llm_usage, extract_deepseek_tokens
        tk = extract_deepseek_tokens(body)
        _aio.create_task(log_llm_usage(
            provider="deepseek", model=DEEPSEEK_MODEL,
            tokens_in=tk["tokens_in"], tokens_out=tk["tokens_out"],
            feature=feature,
        ))
    except Exception as _e:
        logger.warning(f"api_usage log skipped: {_e}")
    return json.loads(content)


def _summarize_user_for_llm(vk_data: Dict[str, Any]) -> str:
    user = vk_data.get("user") or {}
    wall = vk_data.get("wall") or {}
    groups = vk_data.get("groups") or {}

    blocks: List[str] = []
    blocks.append(
        f"Имя: {user.get('first_name','')} {user.get('last_name','')}".strip()
    )
    if user.get("sex") in (1, 2):
        blocks.append(f"Пол: {'женский' if user.get('sex') == 1 else 'мужской'}")
    if user.get("bdate"):
        blocks.append(f"Дата рождения: {user.get('bdate')}")
    if isinstance(user.get("city"), dict) and user["city"].get("title"):
        blocks.append(f"Город: {user['city']['title']}")
    if user.get("status"):
        blocks.append(f"Статус (шапка VK): «{user.get('status')[:200]}»")
    if user.get("about"):
        blocks.append(f"О себе: «{user.get('about')[:500]}»")
    if user.get("interests"):
        blocks.append(f"Интересы: {user.get('interests')[:200]}")
    if user.get("music"):
        blocks.append(f"Музыка: {user.get('music')[:200]}")
    if user.get("books"):
        blocks.append(f"Книги: {user.get('books')[:150]}")
    if user.get("quotes"):
        blocks.append(f"Цитаты: «{user.get('quotes')[:200]}»")

    counters = user.get("counters") or {}
    if counters:
        blocks.append(
            f"Счётчики: friends={counters.get('friends','?')} "
            f"followers={counters.get('followers','?')} "
            f"posts={counters.get('posts','?')} "
            f"photos={counters.get('photos','?')}"
        )

    items = (wall or {}).get("items") or []
    if items:
        blocks.append(f"\n=== Последние {min(len(items),30)} постов ===")
        for p in items[:30]:
            t = (p.get("text") or "").strip()
            if t:
                blocks.append(f"- {t[:280]}")

    g_items = (groups or {}).get("items") or []
    if g_items:
        blocks.append(f"\n=== Группы (top {min(len(g_items),20)}) ===")
        for g in g_items[:20]:
            blocks.append(f"- {g.get('name','')[:100]}")

    return "\n".join(blocks) or "(нет данных)"


async def analyze_profile(url_or_name: str) -> Dict[str, Any]:
    """Полный анализ страницы. Возвращает {vk_data, profile, pain, hooks, error?}."""
    sn = _resolve_screen_name(url_or_name)
    if not sn:
        return {"error": "invalid_url"}

    # 1. Парсим страницу полностью.
    try:
        vk_data = await parse_user(screen_name=sn)
    except Exception as e:
        logger.warning(f"analyze_profile: parse_user({sn}) failed: {e}")
        return {"error": "parse_failed", "message": str(e)}

    if not (vk_data and vk_data.get("user")):
        return {"error": "no_user", "message": "VK не вернул user-данные"}

    summary = _summarize_user_for_llm(vk_data)

    # Pass 1 — психологический профиль.
    try:
        profile = await _deepseek([
            {"role": "system", "content": _PROFILE_SYSTEM},
            {"role": "user", "content": summary},
        ], temperature=0.3, feature="b2c.profile")
    except Exception as e:
        logger.warning(f"analyze_profile: pass1 failed: {e}")
        profile = {"error": str(e)}

    # Pass 2 — активная боль.
    pain_input = (
        "ПСИХОЛОГИЧЕСКИЙ ПОРТРЕТ:\n"
        + json.dumps(profile, ensure_ascii=False, indent=2)
        + "\n\nАНКЕТА И ПОСТЫ:\n"
        + summary
    )
    try:
        pain = await _deepseek([
            {"role": "system", "content": _PAIN_SYSTEM},
            {"role": "user", "content": pain_input},
        ], temperature=0.4, feature="b2c.pain")
    except Exception as e:
        logger.warning(f"analyze_profile: pass2 failed: {e}")
        pain = {"error": str(e)}

    # Pass 3 — три крючка с self-critique.
    hook_input = (
        "ПРОФИЛЬ:\n"
        + json.dumps(profile, ensure_ascii=False, indent=2)
        + "\n\nБОЛЬ:\n"
        + json.dumps(pain, ensure_ascii=False, indent=2)
        + "\n\nЦИТАТЫ И ПОСТЫ:\n"
        + summary[:3000]
    )
    try:
        hooks = await _deepseek([
            {"role": "system", "content": _HOOK_SYSTEM},
            {"role": "user", "content": hook_input},
        ], temperature=0.7, feature="b2c.hooks")
    except Exception as e:
        logger.warning(f"analyze_profile: pass3 failed: {e}")
        hooks = {"error": str(e)}

    return {
        "vk_data": {
            "user_basic": {
                k: (vk_data["user"].get(k) if isinstance(vk_data.get("user"), dict) else None)
                for k in (
                    "id", "first_name", "last_name", "sex", "bdate",
                    "status", "about", "is_closed", "photo_max",
                )
            },
            "wall_count": len((vk_data.get("wall") or {}).get("items") or []),
            "groups_count": len((vk_data.get("groups") or {}).get("items") or []),
        },
        "profile": profile,
        "pain": pain,
        "hooks": hooks,
        "vk_url": f"https://vk.com/{sn}",
    }
