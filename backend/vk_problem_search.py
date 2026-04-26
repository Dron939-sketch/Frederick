#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_problem_search.py
Поиск кандидатов в VK по ПРОБЛЕМНОЙ КАТЕГОРИИ (а не от конкретного Fredi-юзера).

Алгоритм:
  1. Берём category из problem_categories.PROBLEM_CATEGORIES.
  2. Резолвим seed_group_screen_names → числовые group_id через groups.getById.
  3. Тянем участников через groups.getMembers (top-N групп, members_per_group).
  4. Фильтруем по category.demographics (sex/age).
  5. Возвращаем кандидатов с метаданными для UI и последующего draft-message.

В отличие от vk_twin_finder здесь нет seed-юзера и нет пересечения групп —
просто берём людей из тематических сообществ по проблеме.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import re
import time
from datetime import datetime

import httpx

from vk_parser import _call, is_real_active_profile  # rate-limited helper + фильтр живого профиля
from services.problem_categories import get_category


# Универсальные «маркеры боли» — слова, которые человек в состоянии проблемы
# реально использует. Их наличие в тексте триггер-коммента/поста/about/status
# повышает «яркость» кандидата.
_PAIN_MARKERS = re.compile(
    r"\b(не\s+могу|не\s+сплю|не\s+знаю\s+что\s+делать|помогите|"
    r"тяжело|больно|устал[а-я]?|выгор[а-я]+|страш[а-я]+|"
    r"одна|один|никому|пустота|апати[а-я]+|тревог[а-я]+|"
    r"ненавижу|потерял[а-я]?|не\s+отпускает|сил[а-я]?\s+нет|"
    r"плохо|боюсь|стыдно|бессмыслен[а-я]+|невыносим[а-я]+)\b",
    re.IGNORECASE,
)


# Сильные маркеры «это провайдер услуг, а не страдалец» — в about/status.
# Если человек называет себя психологом/коучем/таро-практиком, его «пост про
# выгорание» — это маркетинг чужой боли, а не своя боль.
_PROVIDER_HARD_MARKERS = re.compile(
    r"\b(психолог[а-я]*|коуч[а-я]*|консультант[а-я]*|терапевт[а-я]*|тренер|"
    r"эксперт[а-я]*|астролог[а-я]*|таролог[а-я]*|нумеролог[а-я]*|целитель[а-я]*|"
    r"проводник|шаман[а-я]*|нейрокоуч[а-я]*|расстановщик[а-я]*|родолог[а-я]*|"
    r"профориентолог[а-я]*|карьерн[а-я]+\s+консультант|hr[\-]бренд|hr[\s\-]консульт|"
    r"бизнес[\-\s]коуч|life[\s\-]коуч|family[\s\-]коуч|"
    r"автор\s+книги|соавтор\s+книги|номер\s+регистрации|"
    r"запис[аы]ться\s+на\s+консультаци|whats\s*app|telegram\s*[:@]|"
    r"вытаскива[юе]|помога[юе]\s+(?:людям|вам|выйти|найти|выбраться)|"
    r"провод[ия][тл][ьеа]?\s+игр[ыу]|трансформацион[а-я]+\s+игр|"
    r"\d{3}[\s-]?\d{3}[\s-]?\d{4})\b",
    re.IGNORECASE,
)

# Маркеры «пост про чужих клиентов» (провайдер пишет про свою практику).
_PROVIDER_PRACTICE_MARKERS = re.compile(
    r"(\bко\s+мне\s+(?:приход|обращ|на\s+консульт)|"
    r"\bна\s+консультаци[яи]|\bмо[еих]+\s+клиент[а-я]*|"
    r"\bодн[аои][а-я]*\s+из\s+клиент[а-я]+|\bмо[аяё]\s+клиент[а-я]+|"
    r"\bпомога[юе]\b|\bя\s+проводник|\bя\s+психолог|\bя\s+коуч|"
    r"\bкак\s+психолог|\bкак\s+коуч|\bкак\s+эксперт|\bя\s+волшебник|"
    r"\bпр[оа]ходи(л|т)\s+ко\s+мне|\bкак\s+я\s+помог|"
    r"\bобъявля[юе]\s+поход|\bкрестов[а-я]+\s+поход|"
    r"\bстать[яи]\s+\d|\bчасть\s+\d|"
    r"\bвытаскива[юе]\s+из|\bработа[юе]\s+с\s+(?:людьми|клиент))",
    re.IGNORECASE,
)

# Маркеры «художественный текст» — рассказ от третьего лица, не своя жизнь.
# Диалоговое тире «— Реплика — сказал X», глаголы говорения,
# несколько имён собственных подряд.
_NARRATIVE_DIALOGUE = re.compile(r"—\s+[А-ЯЁ]")
_NARRATIVE_SAID_VERB = re.compile(
    r"\b(сказал[а-я]?|жаловал[а-я]+|воскликн[а-я]+|"
    r"подумал[а-я]?|пробормотал[а-я]?|ответил[а-я]?|спросил[а-я]?)\b",
    re.IGNORECASE,
)
_PROPER_NAME = re.compile(r"\b[А-ЯЁ][а-яё]{2,}\b")


def _brightness_score(c: Dict[str, Any], category_meta: Dict[str, Any]) -> Dict[str, Any]:
    """«Яркость выраженности проблемы» 0..100 + расшифровка по слагаемым.

    Возвращает {score: int, reasons: List[str], parts: Dict[str, int]}:
      • reasons — человекочитаемые строки для тултипа («длинный текст +25», ...)
      • parts — машинная разбивка: {length, pain, seed, exclam, ellipsis}.

    Метрики:
      • Длина триггер-текста (коммент / пост / status / about).
      • Маркеры боли (regex по 20+ универсальным фразам).
      • Совпадения с seed_keywords категории.
      • Эмоциональная пунктуация.
    """
    parts: Dict[str, int] = {}
    reasons: List[str] = []

    # Триггер-текст: для comment-source это текст коммента, для newsfeed —
    # текст поста, иначе пробуем status/about как слабый сигнал.
    text_blocks: List[str] = []
    tc = c.get("triggering_comment") or {}
    if tc.get("text"):
        text_blocks.append(tc["text"])
    tp = c.get("triggering_post") or {}
    if tp.get("text"):
        text_blocks.append(tp["text"])
    if c.get("status"):
        text_blocks.append(c["status"])
    if c.get("about"):
        text_blocks.append(c["about"])

    text = " ".join(text_blocks).strip()
    text_lower = text.lower()

    # 1. Объём «исповеди»: чем больше, тем больше выражена боль.
    L = len(text)
    if L >= 80:
        parts["length"] = 25
        reasons.append(f"длинный текст ({L} симв) +25")
    elif L >= 30:
        parts["length"] = 12
        reasons.append(f"средний текст ({L} симв) +12")
    elif L > 0:
        parts["length"] = 5
        reasons.append(f"короткий текст ({L} симв) +5")
    else:
        parts["length"] = 0

    # 2. Маркеры боли — каждый матч +5, потолок 30.
    pain_matches = _PAIN_MARKERS.findall(text_lower)
    pain_hits = len(pain_matches)
    parts["pain"] = min(pain_hits * 5, 30)
    if pain_hits:
        sample = ", ".join(sorted(set(pain_matches))[:3])
        reasons.append(f"{pain_hits} маркер(ов) боли «{sample}» +{parts['pain']}")

    # 3. Совпадения с seed_keywords категории (длинные фразы веса больше).
    keywords = (category_meta or {}).get("seed_keywords") or []
    kw_hits: List[str] = []
    for kw in keywords:
        if kw and kw.lower() in text_lower:
            kw_hits.append(kw)
    parts["seed"] = min(len(kw_hits) * 3, 20)
    if kw_hits:
        sample = ", ".join(kw_hits[:2])
        reasons.append(f"{len(kw_hits)} совпад. seed «{sample}» +{parts['seed']}")

    # 4. Эмоциональная пунктуация (восклицания, многоточия).
    parts["exclam"] = 0
    parts["ellipsis"] = 0
    if "!" in text:
        parts["exclam"] = 3
        reasons.append("восклицание +3")
    if "..." in text or "…" in text:
        parts["ellipsis"] = 2
        reasons.append("многоточие +2")

    # 5. Штрафы за «провайдер услуг»: психолог/коуч/таро-практик пишут о
    # выгорании в маркетинге, а не от своего имени. Проверяем about+status
    # отдельно (там самые сильные сигналы) и текст поста (там практика).
    parts["provider_role"] = 0
    parts["provider_practice"] = 0

    role_text = " ".join([
        (c.get("about") or ""),
        (c.get("status") or ""),
    ]).lower()
    role_hits = _PROVIDER_HARD_MARKERS.findall(role_text)
    if role_hits:
        sample = ", ".join(sorted(set(map(str.lower, role_hits)))[:2])
        # -40 если 1+ маркер. Это почти всегда провайдер.
        parts["provider_role"] = -40
        reasons.append(f"провайдер услуг в about/status «{sample}» -40")

    practice_hits = _PROVIDER_PRACTICE_MARKERS.findall(text_lower)
    if practice_hits:
        # Каждый матч (ко мне приходят / на консультации / помогаю / ...) -10,
        # потолок -30 (вряд ли больше трёх будет в коротком посте).
        n = len(practice_hits)
        pen = -min(n * 10, 30)
        parts["provider_practice"] = pen
        # Покажем фрагменты для прозрачности.
        sample_p = "; ".join(
            (h if isinstance(h, str) else (h[0] if h else ""))[:40]
            for h in practice_hits[:2]
        )
        reasons.append(f"маркетинг практики «{sample_p}» {pen}")

    # 6. Художественный пост (рассказ от третьего лица). Если есть диалоговое
    # тире + глагол говорения, или 4+ разных имён собственных — это не
    # своё переживание, а пересказ.
    parts["narrative"] = 0
    has_dialogue = bool(_NARRATIVE_DIALOGUE.search(text))
    has_said = bool(_NARRATIVE_SAID_VERB.search(text_lower))
    proper_names = set(_PROPER_NAME.findall(text))
    if has_dialogue and has_said:
        parts["narrative"] = -25
        reasons.append("художественный текст (диалог) -25")
    elif len(proper_names) >= 4:
        parts["narrative"] = -15
        reasons.append(f"много имён ({len(proper_names)}) — рассказ -15")

    # 7. Тема не соответствует категории. У категории есть topic_markers
    # (для BURNOUT — про работу/уволиться/коллег/офис). Если в тексте
    # триггера ни одного матча — пост сильный по эмоции, но не про эту тему.
    parts["off_topic"] = 0
    topic = (category_meta or {}).get("topic_markers") or []
    if topic and text:
        has_topic = any(
            (kw or "").lower() in text_lower for kw in topic
        )
        if not has_topic:
            parts["off_topic"] = -20
            reasons.append("нет ни одного слова темы категории -20")

    score = sum(parts.values())
    score = max(0, min(100, score))
    return {"score": score, "reasons": reasons, "parts": parts}

logger = logging.getLogger(__name__)

# last_seen и has_photo нужны фильтру is_real_active_profile,
# чтобы отсечь заблокированных, заброшенных и фейков.
_VK_USER_FIELDS = (
    "city,country,bdate,sex,about,status,is_closed,can_access_closed,"
    "photo_max,has_photo,last_seen"
)


def _normalise_sex(s: Any) -> Optional[int]:
    """'m'|'male'|2 → 2 (мужской), 'f'|'female'|1 → 1 (женский), 'any'/None → None."""
    if s is None:
        return None
    if isinstance(s, int) and s in (1, 2):
        return s
    sl = str(s).strip().lower()
    if sl in ("m", "male", "м", "муж", "мужской"):
        return 2
    if sl in ("f", "female", "ж", "жен", "женский"):
        return 1
    return None


def _parse_birth_year(bdate: Any) -> Optional[int]:
    """VK bdate = "DD.MM.YYYY" или "DD.MM" (без года) → year или None."""
    if not bdate or not isinstance(bdate, str):
        return None
    parts = bdate.split(".")
    if len(parts) != 3:
        return None
    try:
        return int(parts[2])
    except (ValueError, TypeError):
        return None


def _matches_demographics(user: Dict[str, Any], demo: Dict[str, Any]) -> bool:
    """True, если user попадает в demographic-окно категории."""
    target_sex = _normalise_sex(demo.get("sex"))
    if target_sex is not None:
        u_sex = user.get("sex")
        if u_sex not in (1, 2):
            return False
        if u_sex != target_sex:
            return False

    age_from = demo.get("age_from")
    age_to = demo.get("age_to")
    if age_from or age_to:
        from datetime import datetime
        year = _parse_birth_year(user.get("bdate"))
        if year:
            current_year = datetime.utcnow().year
            age = current_year - year
            if age_from and age < age_from:
                return False
            if age_to and age > age_to:
                return False
        else:
            # Без года рождения — пропускаем фильтр, чтобы не выбрасывать 80%
            pass
    return True


async def _resolve_screen_names(
    client: httpx.AsyncClient, screen_names: List[str]
) -> List[Dict[str, Any]]:
    """Резолвим список screen_name в group_id через groups.getById. Если хотя бы
    один screen_name не найден или закрыт — пропускаем его и идём дальше."""
    if not screen_names:
        return []
    resolved: List[Dict[str, Any]] = []
    try:
        # VK принимает до 500 group_ids через запятую за один вызов.
        resp = await _call(client, "groups.getById", {
            "group_ids": ",".join(screen_names),
            "fields": "members_count,is_closed,activity",
        })
        items = []
        if isinstance(resp, dict):
            items = resp.get("groups") or []
        elif isinstance(resp, list):
            items = resp
        for g in items:
            if not isinstance(g, dict):
                continue
            if g.get("is_closed", 1) != 0:
                # Закрытые группы не дают getMembers — пропускаем.
                logger.info(f"problem_search: group {g.get('screen_name')} is closed, skip")
                continue
            resolved.append({
                "id": g.get("id"),
                "name": g.get("name"),
                "screen_name": g.get("screen_name"),
                "members_count": g.get("members_count"),
            })
    except RuntimeError as e:
        logger.warning(f"groups.getById failed: {e}")
    return resolved


def _candidate_dict(u: Dict[str, Any], from_group: Dict[str, Any], source: str = "group") -> Dict[str, Any]:
    """Формируем карточку кандидата.

    source: 'group'    — из groups.getMembers сообщества;
            'newsfeed' — автор поста из newsfeed.search;
            'comment'  — автор комментария из wall.getComments
                         (плюс триггер-коммент в `triggering_comment`).
    """
    name = " ".join(filter(None, [u.get("first_name"), u.get("last_name")])).strip()
    triggering = u.get("_triggering_comment")
    triggering_post = u.get("_triggering_post")
    return {
        "vk_id": u.get("id"),
        "first_name": u.get("first_name") or "",
        "last_name": u.get("last_name") or "",
        "full_name": name,
        "sex": u.get("sex"),
        "bdate": u.get("bdate") or "",
        "city": (u.get("city") or {}).get("title") if isinstance(u.get("city"), dict) else None,
        "status": (u.get("status") or "")[:200],
        "about": (u.get("about") or "")[:300],
        "photo_max": u.get("photo_max"),
        "is_closed": bool(u.get("is_closed")),
        "source": source,
        "triggering_post": {
            "text": triggering_post.get("text") or "",
            "post_url": triggering_post.get("post_url") or "",
            "source_phrase": triggering_post.get("source_phrase") or "",
        } if isinstance(triggering_post, dict) else None,
        "from_group": {
            "id": from_group.get("id"),
            "name": from_group.get("name"),
            "screen_name": from_group.get("screen_name"),
        } if from_group else None,
        # Текст и ссылка на пост, под которым человек оставил коммент —
        # оператор сразу видит, на что именно он реагировал.
        "triggering_comment": {
            "text": triggering.get("comment_text") or "",
            "post_url": triggering.get("post_url") or "",
            "source_phrase": triggering.get("source_phrase") or "",
        } if isinstance(triggering, dict) else None,
        # Фраза-источник (для newsfeed/comment) — нужна phrase optimizer'у
        # для атрибуции кандидата к конкретной фразе.
        "source_phrase": u.get("_source_phrase"),
        "vk_url": f"https://vk.com/id{u.get('id')}",
    }


async def search_by_problem(
    category_code: str,
    *,
    max_groups_to_scan: int = 3,
    members_per_group: int = 1000,
    max_candidates: int = 50,
    geo_scope: str = "auto",  # auto | russia | worldwide — сейчас фильтра нет, поле под будущее
    db: Any = None,  # если передан — читаем phrase override и пишем phrase perf
) -> Dict[str, Any]:
    """Главная точка: возвращает {category, candidates, stats, groups_used}.

    Pipeline:
      1. newsfeed.search по seed_search_phrases — авторов постов берём
         как ОСНОВНОЙ источник (заведомо живые, тема свежая).
      2. groups.getMembers по seed_group_screen_names — дополняем, если seed
         сообщества открыты и резолвятся.
      3. Для каждого кандидата: фильтр демографии + is_real_active_profile.
      4. Сортируем (источник newsfeed > group, открытый > закрытый,
         с about/status в плюс).
    """
    cat = get_category(category_code)
    if not cat:
        return {
            "category": None,
            "candidates": [],
            "stats": {},
            "groups_used": [],
            "note": f"unknown category: {category_code}",
        }

    demo = cat.get("demographics") or {}
    seed_screen_names: List[str] = cat.get("seed_group_screen_names") or []
    seed_phrases: List[str] = cat.get("seed_search_phrases") or []

    # Если у категории есть применённый override от phrase-optimizer'а —
    # используем его. Это и есть «учитываем при следующем поиске».
    override_applied = False
    if db is not None:
        try:
            from vk_phrase_optimizer import get_active_phrases
            override = await get_active_phrases(db, category_code)
            if override:
                seed_phrases = override
                override_applied = True
        except Exception as e:
            logger.debug(f"phrase override read failed: {e}")

    members_fetched = 0
    seen: Dict[int, Dict[str, Any]] = {}
    rejected_by_reason: Dict[str, int] = {}
    skipped_demo = 0
    keyword_stats: Dict[str, Any] = {}
    resolved: List[Dict[str, Any]] = []
    groups_to_scan: List[Dict[str, Any]] = []

    def _absorb(user: Dict[str, Any], from_group: Dict[str, Any], source: str) -> None:
        """Дедуплицирующий приём кандидата с фильтрами и подсчётом причин."""
        nonlocal skipped_demo
        uid = user.get("id")
        if not uid or uid in seen:
            return
        if not _matches_demographics(user, demo):
            skipped_demo += 1
            return
        ok, reason = is_real_active_profile(user)
        if not ok:
            key = (reason or "unknown").split(":", 1)[0]
            rejected_by_reason[key] = rejected_by_reason.get(key, 0) + 1
            return
        seen[uid] = _candidate_dict(user, from_group, source=source)

    comment_stats: Dict[str, Any] = {}

    # 1) ОСНОВНОЙ источник — авторы постов (newsfeed.search).
    if seed_phrases:
        try:
            from vk_keyword_search import search_authors_by_phrases
            kw_result = await search_authors_by_phrases(
                seed_phrases, per_phrase=200, total_limit=max_candidates * 4
            )
            keyword_stats = kw_result.get("stats") or {}
            for u in kw_result.get("users") or []:
                _absorb(u, {}, source="newsfeed")
                if len(seen) >= max_candidates * 3:
                    break
        except Exception as e:
            logger.warning(f"problem_search: keyword search failed: {e}")

    # 2) ДОПОЛНИТЕЛЬНЫЙ источник — комментаторы постов на тему. Часто
    # эмоционально сильнее, чем сами посты («у меня то же самое»).
    if seed_phrases and len(seen) < max_candidates * 3:
        try:
            from vk_comment_search import search_authors_by_comments
            cm_result = await search_authors_by_comments(
                seed_phrases,
                posts_per_phrase=20,
                comments_per_post=20,
                total_limit=max_candidates * 4,
            )
            comment_stats = cm_result.get("stats") or {}
            for u in cm_result.get("users") or []:
                _absorb(u, {}, source="comment")
                if len(seen) >= max_candidates * 3:
                    break
        except Exception as e:
            logger.warning(f"problem_search: comment search failed: {e}")

    # 3) ДОПОЛНИТЕЛЬНО — участники сообществ (если seed-группы вообще есть и
    # хотя бы одна резолвится в открытое community).
    if seed_screen_names and len(seen) < max_candidates * 3:
        async with httpx.AsyncClient() as client:
            resolved = await _resolve_screen_names(client, seed_screen_names)
            groups_to_scan = resolved[:max_groups_to_scan]

            for g in groups_to_scan:
                gid = g.get("id")
                if not gid:
                    continue
                try:
                    resp = await _call(client, "groups.getMembers", {
                        "group_id": gid,
                        "count": members_per_group,
                        "offset": 0,
                        "fields": _VK_USER_FIELDS,
                        "sort": "id_desc",
                    })
                except RuntimeError as e:
                    logger.warning(f"problem_search: groups.getMembers({gid}) failed: {e}")
                    continue
                items = (resp or {}).get("items") or []
                members_fetched += len(items)
                for u in items:
                    _absorb(u, g, source="group")
                    if len(seen) >= max_candidates * 3:
                        break

    # Сортировка: newsfeed-кандидаты впереди (это живые подтверждённые посты),
    # потом по открытости профиля и наличию инфы о себе.
    candidates = list(seen.values())

    # Считаем brightness один раз, кладём в карточку, чтобы UI мог показать.
    for c in candidates:
        br = _brightness_score(c, cat)
        c["brightness"] = br["score"]
        c["brightness_reasons"] = br["reasons"]
        c["brightness_parts"] = br["parts"]

    def _score(c: Dict[str, Any]) -> int:
        s = 0
        # newsfeed = автор поста (initiator), comment = автор коммента
        # (reaction). Initiator обычно более активный таргет, но
        # коммент-автор подтверждает живучесть и эмоцию.
        src = c.get("source")
        if src == "newsfeed":
            s += 25
        elif src == "comment":
            s += 18
        if not c.get("is_closed"):
            s += 10
        if c.get("about"):
            s += 5
        if c.get("status"):
            s += 3
        if c.get("city"):
            s += 2
        # Главный сигнал «яркости» — насколько прямо человек проявляет
        # проблему. brightness 0..100 — добавляем как самый весомый множитель.
        s += int(c.get("brightness") or 0)
        return s

    candidates.sort(key=_score, reverse=True)
    candidates = candidates[:max_candidates]

    by_source = {"newsfeed": 0, "comment": 0, "group": 0}
    for c in candidates:
        s = c.get("source") or "group"
        by_source[s] = by_source.get(s, 0) + 1

    # Per-phrase агрегация: складываем посты-увиденные из обоих источников
    # (newsfeed + comment) и считаем кандидатов, для которых _source_phrase
    # фиксировался. Это пишется в fredi_vk_phrase_perf при наличии db.
    phrase_perf: Dict[str, Dict[str, int]] = {}
    for ph, br in (keyword_stats.get("per_phrase") or {}).items():
        rec = phrase_perf.setdefault(ph, {"posts_seen": 0, "candidates_yielded": 0})
        rec["posts_seen"] += int(br.get("posts_seen") or 0)
    for ph, br in (comment_stats.get("per_phrase") or {}).items():
        rec = phrase_perf.setdefault(ph, {"posts_seen": 0, "candidates_yielded": 0})
        rec["posts_seen"] += int(br.get("posts_seen") or 0)
    # candidates_yielded — берём из финального списка по полю
    # candidate.source_phrase (newsfeed) или triggering_comment.source_phrase
    # (comment). Для group-кандидатов фразы нет — пропускаем.
    for c in candidates:
        ph = c.get("source_phrase") or (c.get("triggering_comment") or {}).get("source_phrase")
        if ph and ph in phrase_perf:
            phrase_perf[ph]["candidates_yielded"] += 1

    if db is not None and phrase_perf:
        try:
            from vk_phrase_optimizer import track_phrase_performance
            await track_phrase_performance(db, category_code, phrase_perf)
        except Exception as e:
            logger.debug(f"track_phrase_performance failed: {e}")

    return {
        "category": {
            "code": cat["code"],
            "name_ru": cat["name_ru"],
            "icon": cat["icon"],
            "audience_brief": cat["audience_brief"],
            "best_send_hours": cat.get("best_send_hours") or [],
        },
        "candidates": candidates,
        "stats": {
            "phrases_used": keyword_stats.get("phrases_used", 0),
            "posts_seen": keyword_stats.get("posts_seen", 0),
            "newsfeed_authors": keyword_stats.get("unique_authors", 0),
            "newsfeed_resolved": keyword_stats.get("fetched", 0),
            "comments_seen": comment_stats.get("comments_seen", 0),
            "comment_authors": comment_stats.get("unique_commenters", 0),
            "comment_resolved": comment_stats.get("fetched", 0),
            "groups_resolved": len(resolved),
            "groups_scanned": len(groups_to_scan),
            "members_fetched": members_fetched,
            "skipped_demo": skipped_demo,
            "rejected_by_reason": rejected_by_reason,
            "after_demo_filter": len(seen),
            "by_source": by_source,
            "override_applied": override_applied,
            "phrases_active": list(seed_phrases),
            "returned": len(candidates),
        },
        "groups_used": groups_to_scan,
    }
