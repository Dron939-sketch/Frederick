#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_b2c_analyzer.py
Глубокий анализ ОДНОЙ страницы VK для прицельного аутрича (B2C).

Стратегия: «9 из 10». Цель — крючок такой силы, чтобы получатель не смог
проигнорировать. Для этого нужна максимальная плотность контекста и
несколько проходов LLM.

  Pass 1 (psychological_profile): анкета + посты → DeepSeek → портрет.
    Включает COGNITIVE_STYLE (rational/irrational) — определяет, какие
    модули Фреди мы будем предлагать (рациональным — тест/Берн/
    зеркало, иррациональным — таро/гороскоп/толкование снов/сказки).
  Pass 2 (active_pain): профиль + посты с ДАТАМИ → DeepSeek →
    конкретная активная боль ИЛИ baseline-потребность через факт
    ведения публичной страницы (внимание/одобрение/признание/
    отражение/идентичность).
    + pain_recency: current/recent/historical/baseline — чтобы не
    писать «недавно пережила утрату», когда событие было год назад.
  Pass 3 (hooks): профиль + боль + цитаты → 3 крючка с self-score.

Возвращаем также gender (f/m/n) из VK user.sex — pitch использует
для правильных окончаний глаголов прошедшего времени.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from vk_parser import _call, parse_user
from services.b2c_compensatory_patterns import (
    llm_classifier_hint as _b2c_classifier_hint,
    is_target_audience_hint as _b2c_target_hint,
)
from services.b2c_problem_signals import (
    llm_problem_detector_hint as _b2c_problem_hint,
    filter_actionable as _b2c_filter_problems,
)
from services.b2c_journeys import (
    llm_journey_detector_hint as _b2c_journey_hint,
    get_journey as _b2c_get_journey,
    get_tool_chain as _b2c_get_tool_chain,
)
from services.b2c_existential import (
    llm_existential_hint as _b2c_existential_hint,
    get_existential as _b2c_get_existential,
    get_locus as _b2c_get_locus,
)

logger = logging.getLogger(__name__)

# Composed hint для подключения в _PAIN_SYSTEM:
#   1) ЦА-гейт (бьюти-предпринимательница 30+)
#   2) Compensatory pattern — стратегический слой
#   3) Problem signals (12) — тактический слой
#   4) Journey (А→Б→С, 10 траекторий) — нарративный слой
#   5) Existential × Locus — координатная сетка для УТОЧНЕНИЯ А и С
_COMPENSATORY_HINT = (
    _b2c_target_hint()
    + "\n\n" + _b2c_classifier_hint()
    + "\n\n" + _b2c_problem_hint()
    + "\n\n" + _b2c_journey_hint()
    + "\n\n" + _b2c_existential_hint()
)


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
    "  • cognitive_style (rational|irrational) — ВАЖНО, определяется по "
    "контенту страницы:\n"
    "    RATIONAL — опирается на факты, логику, метрики, «по данным», "
    "ссылки на исследования, бизнес-литературу, критическое мышление, "
    "профессиональные термины, систему, процессы, цели и KPI. Цитирует "
    "учёных, авторов методологий. Пишет аналитически.\n"
    "    IRRATIONAL — опирается на интуицию, эмоции, метафоры, эзотерику, "
    "астрологию («ретроградный меркурий», «лунный календарь»), знаки "
    "вселенной, «ангелы-хранители», карты Таро, нумерология, цитаты-"
    "афоризмы без источников, мистицизм, «энергия», «вибрации», поэзия, "
    "сны и предчувствия. Пишет образно, метафорично.\n"
    "    Если смешанно — выбери преобладающий стиль. Если строго не "
    "определяется — RATIONAL по умолчанию.\n"
    "Возвращай СТРОГО JSON:\n"
    "{\n"
    "  \"profile\": \"3-5 предложений психологический портрет\",\n"
    "  \"defenses\": [\"защита1\", \"защита2\"],\n"
    "  \"patterns\": [\"паттерн1\", \"паттерн2\"],\n"
    "  \"archetype\": \"CODE\",\n"
    "  \"openness\": \"закрыт|средне|открыт\",\n"
    "  \"cognitive_style\": \"rational|irrational\",\n"
    "  \"existential_stance\": \"type1_special|type2_withdrawal|type3_legacy|none\",\n"
    "  \"locus_of_control\": \"internal|external|mixed\",\n"
    "  \"existential_evidence\": \"конкретная цитата/наблюдение по existential\",\n"
    "  \"locus_evidence\": \"конкретная цитата/наблюдение по locus\"\n"
    "}\n"
    "Без markdown, только JSON.\n\n"
    + _b2c_existential_hint()
)


_PAIN_SYSTEM = (
    "Ты — клинический психолог. На вход — психологический портрет + "
    "последние 30 постов человека С ДАТАМИ (каждый пост помечен "
    "относительной давностью: «вчера», «3 дня назад», «5 мес. назад», "
    "«год назад» и т.п.). Цель: найти ЗАЦЕПКУ — на чём можно опереться "
    "при предложении услуг AI-психолога Фреди.\n\n"
    "🚨 КРИТИЧНО — УЧИТЫВАЙ ВОЗРАСТ СОБЫТИЙ:\n"
    "  • Каждый пост помечен временем: «[3 дня назад]», «[5 мес. назад]»,\n"
    "    «[год назад]», «[2 г. назад]».\n"
    "  • НЕ пиши «недавно пережила утрату», если пост о ней был год назад.\n"
    "  • Если событие старое (>3 мес) — это уже ИСТОРИЯ, а не текущее.\n"
    "  • В pain_active отражай реальный возраст («год назад прошла "
    "через...», «полгода назад писала о...»).\n"
    "  • Поле pain_recency обязательно — оно потом модулирует тон pitch'а.\n\n"
    "СНАЧАЛА ищи КОНКРЕТНУЮ АКТИВНУЮ БОЛЬ — то что у человека болит "
    "или болело (событие/состояние из постов):\n"
    "  • цитата из его реальных слов — самый сильный сигнал\n"
    "  • цитаты ЗАВЕРШЁННЫЕ — кончаются на знаке препинания или "
    "многоточии. НЕ обрывай посреди слова. Длина 60-200 символов.\n"
    "  • конкретность: не «одиночество», а «недавно расстался, по "
    "вечерам тяжело»\n"
    "  • PRIORITY свежим постам (<2 нед). Старые — только если других "
    "сигналов нет.\n\n"
    "ЕСЛИ ЯВНОЙ АКТИВНОЙ БОЛИ НЕТ (всё спокойно, посты бытовые или "
    "позитивные) — НЕ говори «всё ок». Вместо этого опиши БАЗОВУЮ "
    "ПОТРЕБНОСТЬ через сам факт ведения публичной страницы. Любой "
    "кто регулярно ведёт VK с фото и постами — закрывает одну из "
    "универсальных потребностей:\n"
    "  • быть увиденной/услышанным (внимание)\n"
    "  • признание себя в социальной группе (свой/своя)\n"
    "  • одобрение, лайки, положительная обратная связь\n"
    "  • поиск отражения — «правильно ли я живу»\n"
    "  • поддержание идентичности через демонстрацию\n"
    "Выбери ОДНУ на основе паттерна публикаций:\n"
    "  • много фото себя крупно → одобрение / внешность\n"
    "  • рассказы о семье и быте → признание роли (мама/жена/дочь)\n"
    "  • цитаты о жизни → поиск смысла, отражение\n"
    "  • профессиональные достижения и сертификаты → идентичность\n"
    "  • просто красивые места и моменты → внимание\n\n"
    "Возвращай JSON (без полей со значением «нет» / null):\n"
    "{\n"
    "  \"pain_active\": \"что болит/болело + ВОЗРАСТ события (если есть), "
    "1-2 предложения\",\n"
    "  \"pain_intensity\": \"низкая|средняя|высокая\",\n"
    "  \"pain_type\": \"acute_anxiety|acute_sleep|acute_relationships|"
    "acute_burnout|acute_identity|acute_meaning|acute_habits|acute_grief|"
    "baseline_attention|baseline_recognition|baseline_approval|"
    "baseline_reflection|baseline_identity\",\n"
    "  \"pain_recency\": \"current|recent|historical|baseline\",\n"
    "  \"pain_event_age\": \"человекочитаемая давность события "
    "(например «3 дня назад», «5 мес назад», «год назад») или пусто "
    "если baseline\",\n"
    "  \"evidence_quotes\": [\"его реальные цитаты\"],\n"
    "  \"desired_outcome\": \"чего он хочет (например: быть услышанным; "
    "разобраться с тревогой; перестать спорить с собой)\",\n"
    "  \"vulnerability_window\": \"когда он наиболее открыт к диалогу\",\n"
    "  \"is_target_audience\": true|false,\n"
    "  \"compensatory_pattern\": \"peace_deficit|intimacy_deficit|body_deficit|none\",\n"
    "  \"problem_signals\": [\n"
    "    {\"code\": \"loneliness_chat|mental_clutter|identity_search|"
    "blind_spots|social_isolation|relational_scripts|unspeakable_grief|"
    "insomnia_anxiety|nervous_dysregulation|emotional_reactivity|"
    "recurring_dreams|existential_void\",\n"
    "     \"weight\": 0.0-1.0,\n"
    "     \"evidence\": \"конкретная цитата или наблюдение\"}\n"
    "  ],\n"
    "  \"journey\": {\n"
    "    \"code\": \"invisible_to_seen|good_girl_to_self|strong_to_soft|"
    "alone_to_tribe|control_to_let_go|wounded_to_healed|lost_to_path|"
    "body_as_tool_to_body_as_home|frozen_to_feeling|daughter_to_self|none\",\n"
    "    \"point_a\": \"описание ТОЧКИ А этого человека (2-3 предложения, "
    "    не шаблонный — на основе его реальных постов/анкеты)\",\n"
    "    \"point_c\": \"описание ТОЧКИ С — куда тянется (2-3 предложения, "
    "    на основе его лайков/репостов/намёков в постах)\",\n"
    "    \"weight\": 0.0-1.0,\n"
    "    \"evidence_a\": \"конкретная цитата подтверждающая А\",\n"
    "    \"evidence_c\": \"конкретная цитата подтверждающая С\"\n"
    "  }\n"
    "}\n\n"
    "СПРАВОЧНИК pain_recency:\n"
    "  • current — событие в последние 2 недели (свежая боль)\n"
    "  • recent — 2 нед — 3 мес назад (ещё актуально)\n"
    "  • historical — старше 3 месяцев (уже история, но может болеть)\n"
    "  • baseline — нет конкретного события, общая потребность\n\n"
    + _COMPENSATORY_HINT + "\n\n"
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


def _vk_sex_to_gender(sex: Any) -> str:
    """VK user.sex → 'f' | 'm' | 'n'."""
    try:
        s = int(sex)
    except (TypeError, ValueError):
        return "n"
    if s == 1:
        return "f"
    if s == 2:
        return "m"
    return "n"


def _ago(ts: Any) -> str:
    """Unix timestamp → человекочитаемая давность.

    Возвращает «вчера» / «3 дня назад» / «5 мес. назад» / «год назад» /
    «2 г. назад». Используется в _summarize_user_for_llm для каждого
    поста, чтобы LLM не написал «недавно пережила X», когда событие
    было год назад.
    """
    if ts is None:
        return ""
    try:
        ts = int(ts)
    except (TypeError, ValueError):
        return ""
    if ts <= 0:
        return ""
    now = int(time.time())
    diff = now - ts
    if diff < 0:
        return "в будущем"
    days = diff // 86400
    if days < 1:
        hours = diff // 3600
        if hours < 1:
            return "только что"
        if hours == 1:
            return "час назад"
        return f"{hours} ч. назад"
    if days == 1:
        return "вчера"
    if days < 7:
        return f"{days} дн. назад"
    if days < 30:
        weeks = days // 7
        if weeks == 1:
            return "неделю назад"
        return f"{weeks} нед. назад"
    if days < 365:
        months = days // 30
        if months == 1:
            return "месяц назад"
        return f"{months} мес. назад"
    years = days // 365
    if years == 1:
        return "год назад"
    return f"{years} г. назад"


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
    blocks.append(f"СЕГОДНЯ: {datetime.now().strftime('%d.%m.%Y')} "
                  f"(используй для оценки возраста постов)")
    blocks.append("")
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
        blocks.append(f"\n=== Последние {min(len(items),30)} постов "
                      f"(с относительными датами) ===")
        for p in items[:30]:
            t = (p.get("text") or "").strip()
            if t:
                age = _ago(p.get("date"))
                prefix = f"[{age}] " if age else ""
                blocks.append(f"- {prefix}{t[:280]}")

    g_items = (groups or {}).get("items") or []
    if g_items:
        blocks.append(f"\n=== Группы (top {min(len(g_items),20)}) ===")
        for g in g_items[:20]:
            blocks.append(f"- {g.get('name','')[:100]}")

    return "\n".join(blocks) or "(нет данных)"


async def analyze_profile(url_or_name: str) -> Dict[str, Any]:
    sn = _resolve_screen_name(url_or_name)
    if not sn:
        return {"error": "invalid_url"}

    try:
        vk_data = await parse_user(screen_name=sn)
    except Exception as e:
        logger.warning(f"analyze_profile: parse_user({sn}) failed: {e}")
        return {"error": "parse_failed", "message": str(e)}

    if not (vk_data and vk_data.get("user")):
        return {"error": "no_user", "message": "VK не вернул user-данные"}

    summary = _summarize_user_for_llm(vk_data)

    try:
        profile = await _deepseek([
            {"role": "system", "content": _PROFILE_SYSTEM},
            {"role": "user", "content": summary},
        ], temperature=0.3, feature="b2c.profile")
    except Exception as e:
        logger.warning(f"analyze_profile: pass1 failed: {e}")
        profile = {"error": str(e)}

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

    user_obj = vk_data.get("user") if isinstance(vk_data.get("user"), dict) else {}
    gender = _vk_sex_to_gender(user_obj.get("sex"))

    # Тактический слой: отфильтровать сигналы по weight_floor каждой
    # проблемы, дополнить инфо об инструменте, отсортировать desc.
    # Topology: max 3 actionable. Используется фронтом и mirror_pitch.
    raw_signals = []
    if isinstance(pain, dict):
        raw_signals = pain.get("problem_signals") or []
    actionable_problems = _b2c_filter_problems(raw_signals)

    # Нарративный слой: journey А→Б→С + цепочка инструментов.
    # LLM возвращает journey.code; мы достаём его карточку из каталога
    # и подгружаем актуальную цепочку инструментов с их UI-описанием.
    journey_resolved = None
    try:
        if isinstance(pain, dict):
            jraw = pain.get("journey") or {}
            jcode = (jraw.get("code") or "").strip().lower()
            jweight = float(jraw.get("weight") or 0.0)
            if jcode and jcode != "none" and jweight >= 0.4:
                jmeta = _b2c_get_journey(jcode)
                if jmeta:
                    journey_resolved = {
                        "code": jcode,
                        "name_ru": jmeta.get("name_ru", ""),
                        "compass": jmeta.get("compass", ""),
                        "point_a": jraw.get("point_a", "") or jmeta.get("point_a_archetype", ""),
                        "point_c": jraw.get("point_c", "") or jmeta.get("point_c_archetype", ""),
                        "weight": jweight,
                        "evidence_a": jraw.get("evidence_a", ""),
                        "evidence_c": jraw.get("evidence_c", ""),
                        "tool_chain": _b2c_get_tool_chain(jcode),
                        "compensatory_link": jmeta.get("compensatory_link", ""),
                    }
    except Exception as _je:
        logger.warning(f"journey resolve failed: {_je}")

    # Экзистенциальный слой: достаём из profile + резолвим карточки.
    existential_resolved = None
    try:
        if isinstance(profile, dict):
            es_code = (profile.get("existential_stance") or "").strip().lower()
            lc_code = (profile.get("locus_of_control") or "").strip().lower()
            es_card = _b2c_get_existential(es_code)
            lc_card = _b2c_get_locus(lc_code)
            if es_card or lc_card:
                existential_resolved = {
                    "existential_stance": es_code if es_card else "none",
                    "existential_card": es_card,
                    "existential_evidence": profile.get("existential_evidence", ""),
                    "locus_of_control": lc_code if lc_card else "none",
                    "locus_card": lc_card,
                    "locus_evidence": profile.get("locus_evidence", ""),
                    "compass": (
                        f"{(es_card or {}).get('name_ru', '—')}  ×  "
                        f"{(lc_card or {}).get('name_ru', '—')}"
                    ),
                }
    except Exception as _ee:
        logger.warning(f"existential resolve failed: {_ee}")

    return {
        "vk_data": {
            "user_basic": {
                k: user_obj.get(k)
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
        "gender": gender,
        "vk_url": f"https://vk.com/{sn}",
        # Actionable проблемы (отфильтрованы по weight_floor, max 3).
        # Каждая запись: {code, weight, evidence, tool_code, tool, name_ru,
        # best_send_time_msk}. Используется на фронте для отображения и
        # в vk_mirror_pitch для second-touch.
        "problem_signals_actionable": actionable_problems,
        # Нарративный слой: А→Б→С с цепочкой инструментов. None если
        # LLM не нашёл траекторию с weight >= 0.4. Используется в
        # глубоких касаниях (mirror_pitch.render_journey_pitch).
        "journey": journey_resolved,
        # Экзистенциальный слой: existential_stance × locus_of_control.
        # Это «координатная сетка» — множитель для уточнения А и С.
        # None если оба не определены.
        "existential": existential_resolved,
    }
