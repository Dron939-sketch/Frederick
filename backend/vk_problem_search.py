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

import httpx

from vk_parser import _call, is_real_active_profile  # rate-limited helper + фильтр живого профиля
from services.problem_categories import get_category

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


def _candidate_dict(u: Dict[str, Any], from_group: Dict[str, Any]) -> Dict[str, Any]:
    name = " ".join(filter(None, [u.get("first_name"), u.get("last_name")])).strip()
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
        "from_group": {
            "id": from_group.get("id"),
            "name": from_group.get("name"),
            "screen_name": from_group.get("screen_name"),
        },
        "vk_url": f"https://vk.com/id{u.get('id')}",
    }


async def search_by_problem(
    category_code: str,
    *,
    max_groups_to_scan: int = 3,
    members_per_group: int = 1000,
    max_candidates: int = 50,
    geo_scope: str = "auto",  # auto | russia | worldwide — сейчас фильтра нет, поле под будущее
) -> Dict[str, Any]:
    """Главная точка: возвращает {category, candidates, stats, groups_used}."""
    cat = get_category(category_code)
    if not cat:
        return {
            "category": None,
            "candidates": [],
            "stats": {},
            "groups_used": [],
            "note": f"unknown category: {category_code}",
        }

    seed_screen_names: List[str] = cat.get("seed_group_screen_names") or []
    demo = cat.get("demographics") or {}

    if not seed_screen_names:
        return {
            "category": cat,
            "candidates": [],
            "stats": {"groups_resolved": 0, "members_fetched": 0, "after_demo_filter": 0},
            "groups_used": [],
            "note": "В категории нет seed_group_screen_names",
        }

    members_fetched = 0
    seen: Dict[int, Dict[str, Any]] = {}
    rejected_by_reason: Dict[str, int] = {}
    skipped_demo = 0

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
                uid = u.get("id")
                if not uid or uid in seen:
                    continue
                if not _matches_demographics(u, demo):
                    skipped_demo += 1
                    continue
                # Отсекаем заблокированных / заброшенных / фейков ДО того,
                # как выгребем буфер max_candidates*3 — иначе хорошие кандидаты
                # не попадут в выборку.
                ok, reason = is_real_active_profile(u)
                if not ok:
                    key = (reason or "unknown").split(":", 1)[0]
                    rejected_by_reason[key] = rejected_by_reason.get(key, 0) + 1
                    continue
                seen[uid] = _candidate_dict(u, g)
                if len(seen) >= max_candidates * 3:
                    # буфер для последующего трюшения; в реальный список выйдут только max_candidates
                    break

    # Сортируем: открытые профили в приоритете, дальше по наличию about/status
    candidates = list(seen.values())
    def _score(c: Dict[str, Any]) -> int:
        s = 0
        if not c.get("is_closed"):
            s += 10
        if c.get("about"):
            s += 5
        if c.get("status"):
            s += 3
        if c.get("city"):
            s += 2
        return s
    candidates.sort(key=_score, reverse=True)
    candidates = candidates[:max_candidates]

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
            "groups_resolved": len(resolved),
            "groups_scanned": len(groups_to_scan),
            "members_fetched": members_fetched,
            "skipped_demo": skipped_demo,
            "rejected_by_reason": rejected_by_reason,
            "after_demo_filter": len(seen),
            "returned": len(candidates),
        },
        "groups_used": groups_to_scan,
    }
