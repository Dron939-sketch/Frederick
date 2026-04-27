#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_fisherman_search.py
Поиск практиков (рыбаков) — наша B2B-аудитория.

Алгоритм:
  1. Для каждого service_term категории зовём users.search?q=<term>.
     VK ищет в полях first/last name + статус + интересы. Получаем потенциальных
     рыбаков с учётом доп.фильтров (страна, has_photo).
  2. Для каждого topic_phrase зовём groups.search?q=<phrase> — находим
     тематические сообщества; их администраторы — тоже рыбаки.
     (упрощение: пока берём только групп-метаданные, админов оставляем
      на следующую итерацию).
  3. Уникальные user_ids → users.get с расширенными полями.
  4. Фильтр «реальный практик»: bio содержит маркеры категории + минимум
     followers / friends — отсекает фейков и мёртвых.
  5. Возвращаем список с метриками аудитории и стилем работы.

Stats для UI:
  • search_attempts / search_success (users.search calls)
  • candidates_total — найдено уникальных
  • after_marker_filter — прошли проверку bio_markers
  • after_audience_filter — прошли минимум подписчиков
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from vk_parser import _call, is_real_active_profile
from services.fisherman_categories import get_fisherman

logger = logging.getLogger(__name__)


_VK_USER_FIELDS = (
    "city,country,bdate,sex,about,status,is_closed,can_access_closed,"
    "photo_max,has_photo,last_seen,counters,site,occupation,career,"
    "interests,activities"
)


def _audience_size(user: Dict[str, Any]) -> int:
    """Размер аудитории: followers + friends (грубая оценка)."""
    counters = user.get("counters") or {}
    return int(counters.get("followers") or 0) + int(counters.get("friends") or 0)


def _bio_text(user: Dict[str, Any]) -> str:
    """Склейка всех bio-полей + имя/фамилия для regex-проверки маркеров.

    Имя и фамилия включены сознательно: эзотерики/тарологи часто пишут
    профессию прямо в display-name («Алёна-Таролог», «Astro Анна»).
    """
    parts = [
        (user.get("first_name") or ""),
        (user.get("last_name") or ""),
        (user.get("about") or ""),
        (user.get("status") or ""),
        (user.get("activities") or ""),
        (user.get("occupation") or {}).get("name", "")
        if isinstance(user.get("occupation"), dict) else "",
        (user.get("career") or [{}])[0].get("position", "")
        if isinstance(user.get("career"), list) and user.get("career") else "",
        (user.get("interests") or ""),
    ]
    return " ".join(p for p in parts if p).lower()


def _is_closed_no_data(user: Dict[str, Any]) -> bool:
    """Закрытый профиль, к которому у нас нет доступа.

    Для таких VK возвращает только id/first_name/last_name/photo — bio пустой.
    Раз VK сматчил их на наш service_term, считаем рыбаком на доверии.
    """
    is_closed = bool(user.get("is_closed"))
    can_access = user.get("can_access_closed")
    if not is_closed:
        return False
    if can_access is False or can_access == 0:
        return True
    if can_access is None:
        # VK не вернул поле — вероятнее закрытый.
        about = (user.get("about") or "").strip()
        status = (user.get("status") or "").strip()
        if not about and not status:
            return True
    return False


def _matches_markers(user: Dict[str, Any], markers: List[str]) -> bool:
    """True если bio юзера содержит маркер ИЛИ это закрытый профиль.

    Закрытые профили проходят на доверии: VK уже сматчил их на
    service_term, иначе их бы не было в выдаче users.search.
    """
    if _is_closed_no_data(user):
        return True
    if not markers:
        return False
    text = _bio_text(user)
    if not text:
        # Не закрытый, но VK не вернул bio — тоже доверяем VK-индексу.
        return True
    for m in markers:
        if (m or "").lower() in text:
            return True
    return False


def _candidate_dict(u: Dict[str, Any], cat_code: str) -> Dict[str, Any]:
    name = " ".join(filter(None, [u.get("first_name"), u.get("last_name")])).strip()
    counters = u.get("counters") or {}
    occupation = u.get("occupation") or {}
    return {
        "vk_id": u.get("id"),
        "first_name": u.get("first_name") or "",
        "last_name": u.get("last_name") or "",
        "full_name": name,
        "sex": u.get("sex"),
        "bdate": u.get("bdate") or "",
        "city": (u.get("city") or {}).get("title") if isinstance(u.get("city"), dict) else None,
        "status": (u.get("status") or "")[:200],
        "about": (u.get("about") or "")[:500],
        "occupation": occupation.get("name") if isinstance(occupation, dict) else None,
        "site": u.get("site") or "",
        "photo_max": u.get("photo_max"),
        "is_closed": bool(u.get("is_closed")),
        "followers": int(counters.get("followers") or 0),
        "friends": int(counters.get("friends") or 0),
        "audience_size": _audience_size(u),
        "category": cat_code,
        "vk_url": f"https://vk.com/id{u.get('id')}",
    }


async def search_fishermen(
    category_code: str,
    *,
    max_per_term: int = 100,
    min_audience: int = 100,
    max_results: int = 30,
) -> Dict[str, Any]:
    """Возвращает {category, candidates, stats}."""
    cat = get_fisherman(category_code)
    if not cat:
        return {
            "category": None,
            "candidates": [],
            "stats": {"reason": f"unknown category: {category_code}"},
        }

    service_terms: List[str] = cat.get("service_terms") or []
    bio_markers: List[str] = cat.get("bio_markers") or []

    seen: Dict[int, Dict[str, Any]] = {}
    search_attempts = 0
    search_success = 0
    search_failed_reasons: Dict[str, int] = {}

    async with httpx.AsyncClient() as client:
        # users.search по сервисным термам.
        for term in service_terms:
            search_attempts += 1
            try:
                resp = await _call(client, "users.search", {
                    "q": term,
                    "count": min(max_per_term, 1000),
                    "fields": _VK_USER_FIELDS,
                    "country": 1,  # Россия (для VK Россия = 1)
                    "has_photo": 1,
                })
                search_success += 1
            except RuntimeError as e:
                key = str(e).split(":")[0][:60]
                search_failed_reasons[key] = search_failed_reasons.get(key, 0) + 1
                logger.warning(f"users.search('{term}') failed: {e}")
                continue
            items = (resp or {}).get("items") or []
            for u in items:
                uid = u.get("id")
                if not isinstance(uid, int) or uid <= 0:
                    continue
                if uid in seen:
                    continue
                seen[uid] = u

        candidates_total = len(seen)

        # Фильтрация: bio_markers (или закрытый профиль) + реальность.
        after_markers: Dict[int, Dict[str, Any]] = {}
        rejected_reasons: Dict[str, int] = {}
        for uid, u in seen.items():
            if not _matches_markers(u, bio_markers):
                rejected_reasons["no_marker"] = rejected_reasons.get("no_marker", 0) + 1
                continue
            ok, reason = is_real_active_profile(u)
            if not ok:
                rejected_reasons[reason or "unreal"] = rejected_reasons.get(reason or "unreal", 0) + 1
                continue
            after_markers[uid] = u

        after_audience = [
            u for u in after_markers.values()
            if _audience_size(u) >= min_audience
        ]
        rejected_audience = len(after_markers) - len(after_audience)
        if rejected_audience > 0:
            rejected_reasons[f"audience<{min_audience}"] = rejected_audience

        # Сортируем по размеру аудитории — крупные «рыбаки» наверху.
        after_audience.sort(key=_audience_size, reverse=True)
        after_audience = after_audience[:max_results]

        logger.info(
            f"fisherman_search({category_code}): "
            f"VK={candidates_total} → markers/real={len(after_markers)} → "
            f"audience>={min_audience}={len(after_audience)} → "
            f"returned={min(len(after_audience), max_results)} "
            f"(rejects: {rejected_reasons})"
        )

    candidates = [_candidate_dict(u, category_code) for u in after_audience]

    return {
        "category": {
            "code": cat["code"],
            "name_ru": cat["name_ru"],
            "icon": cat["icon"],
            "description": cat["description"],
            "product_hint": cat["product_hint"],
        },
        "candidates": candidates,
        "stats": {
            "search_attempts": search_attempts,
            "search_success": search_success,
            "search_failed_reasons": search_failed_reasons,
            "candidates_total": candidates_total,
            "after_marker_filter": len(after_markers),
            "after_audience_filter": len(after_audience),
            "returned": len(candidates),
            "min_audience": min_audience,
            "rejected_reasons": rejected_reasons,
        },
    }
