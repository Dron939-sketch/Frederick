#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/services/vk_group_members.py
Парсинг подписчиков любой VK-группы (groups.getMembers) с фильтрами
по полу / возрасту / городу / активности.

Pipeline:
  1. groups.getById(group_id_or_screen) → resolve real group_id, name
  2. groups.getMembers(group_id, fields=..., offset, count=1000) →
     постранично собираем участников
  3. Локальные фильтры:
       • sex (1/2/None)
       • age — по bdate (если есть и есть год)
       • city — VK не отдаёт city в getMembers без отдельного users.get;
         поэтому полагаемся на is_alive + post-filter
       • active_only — is_alive_profile (last_seen, deactivated, closed)
  4. Возвращаем список в формате _candidate_dict (совместим с
     vk_outreach_queue.add_batch_to_queue)
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

from vk_parser import _call
from vk_fisherman_search import (
    _VK_USER_FIELDS,
    _candidate_dict,
    is_alive_profile,
)

logger = logging.getLogger(__name__)


_GROUP_ID_RE = re.compile(r"^-?\d+$")
_GROUP_URL_RE = re.compile(
    r"^(?:https?://)?(?:[a-z0-9.-]*\.)?vk\.(?:com|ru)/(?P<rest>[^/?#]+)", re.IGNORECASE
)


def _resolve_group_input(raw: str) -> str:
    """Принимает «club12345», «public12345», «12345», ссылку, screen_name.
    Возвращает строку для groups.getById (он сам резолвит и id и screen)."""
    s = (raw or "").strip().strip("«»\"'() \t\n\r")
    if not s:
        return ""
    if s.startswith("@"):
        s = s[1:]
    m = _GROUP_URL_RE.match(s)
    if m:
        s = m.group("rest")
    s = s.split("?", 1)[0].split("#", 1)[0].strip().rstrip("/")
    # Если "-12345" — оставим как есть, vk API съест
    if _GROUP_ID_RE.match(s):
        return s.lstrip("-")
    return s


async def _resolve_group(client: httpx.AsyncClient, raw: str) -> Optional[Dict[str, Any]]:
    """Возвращает {id, name, screen_name} или None."""
    needle = _resolve_group_input(raw)
    if not needle:
        return None
    try:
        resp = await _call(client, "groups.getById", {"group_id": needle})
    except Exception as e:
        logger.warning(f"groups.getById('{needle}') failed: {e}")
        return None
    if not resp:
        return None
    # Старый формат — list. Новый — {groups: [...]}.
    groups = resp.get("groups") if isinstance(resp, dict) else resp
    if isinstance(groups, list) and groups:
        g = groups[0]
        return {
            "id": int(g.get("id") or 0),
            "name": g.get("name") or "",
            "screen_name": g.get("screen_name") or "",
        }
    return None


def _bdate_age(bdate: str) -> Optional[int]:
    """Из '17.6.1985' → возраст. Если нет года — None."""
    if not bdate:
        return None
    parts = str(bdate).split(".")
    if len(parts) < 3:
        return None
    try:
        year = int(parts[2])
    except ValueError:
        return None
    if year < 1900 or year > 2100:
        return None
    import datetime as _dt
    age = _dt.date.today().year - year
    return age if 0 < age < 120 else None


async def parse_group_members(
    *,
    group_raw: str,
    max_members: int = 1000,
    age_min: Optional[int] = None,
    age_max: Optional[int] = None,
    sex: Optional[int] = None,
    city_id: Optional[int] = None,
    active_only: bool = True,
    active_inactivity_days: int = 90,
) -> Dict[str, Any]:
    """Возвращает {group, candidates, stats}."""
    stats: Dict[str, int] = {
        "total_fetched": 0,
        "after_alive": 0,
        "after_sex": 0,
        "after_age": 0,
        "after_city": 0,
        "returned": 0,
    }

    async with httpx.AsyncClient() as client:
        gr = await _resolve_group(client, group_raw)
        if not gr or not gr.get("id"):
            return {
                "group": None,
                "candidates": [],
                "stats": {"error": "group_not_found", **stats},
            }
        gid = gr["id"]

        # Постранично через groups.getMembers
        members: List[Dict[str, Any]] = []
        offset = 0
        per_page = 1000
        max_members = max(1, min(int(max_members), 10000))

        while len(members) < max_members:
            try:
                resp = await _call(client, "groups.getMembers", {
                    "group_id": gid,
                    "fields": _VK_USER_FIELDS,
                    "count": min(per_page, max_members - len(members)),
                    "offset": offset,
                    "sort": "id_asc",
                })
            except Exception as e:
                logger.warning(f"groups.getMembers(gid={gid}, off={offset}) failed: {e}")
                if "9" in str(e).lower() and "flood" in str(e).lower():
                    await asyncio.sleep(5)
                    continue
                break
            items = (resp or {}).get("items") or []
            if not items:
                break
            members.extend(items)
            offset += len(items)
            total_count = (resp or {}).get("count") or 0
            if offset >= total_count:
                break
            # rate-limit между страницами
            await asyncio.sleep(0.4)

        stats["total_fetched"] = len(members)

        # --- ФИЛЬТРЫ ---
        passed: List[Dict[str, Any]] = []
        for u in members:
            # alive
            if active_only and not is_alive_profile(u, max_inactivity_days=active_inactivity_days):
                continue
        # быстрая итерация выше пустая для счётчика — пересоберём корректно:
        passed = [
            u for u in members
            if (not active_only) or is_alive_profile(u, max_inactivity_days=active_inactivity_days)
        ]
        stats["after_alive"] = len(passed)

        if sex in (1, 2):
            passed = [u for u in passed if int(u.get("sex") or 0) == int(sex)]
        stats["after_sex"] = len(passed)

        if age_min or age_max:
            _pass2: List[Dict[str, Any]] = []
            for u in passed:
                age = _bdate_age(u.get("bdate") or "")
                if age is None:
                    # Если возраст неизвестен — пропускаем при строгом фильтре,
                    # иначе можно было бы оставлять. Для безопасной рассылки
                    # лучше пропускать: дальше LLM смотрит профиль, нет смысла
                    # тратить токены на пользователей с не-указанным возрастом
                    # когда требование явно ≥30.
                    continue
                if age_min and age < int(age_min):
                    continue
                if age_max and age > int(age_max):
                    continue
                _pass2.append(u)
            passed = _pass2
        stats["after_age"] = len(passed)

        if city_id and int(city_id) > 0:
            _pass3: List[Dict[str, Any]] = []
            for u in passed:
                uc = u.get("city")
                if isinstance(uc, dict) and uc.get("id") == int(city_id):
                    _pass3.append(u)
                # если city не отдан — пропускаем (нет данных)
            passed = _pass3
        stats["after_city"] = len(passed)

        # --- Сборка в формат _candidate_dict ---
        cat_label = f"group_{gr.get('screen_name') or gid}"
        cands = [
            _candidate_dict(u, cat_label, source="group_member")
            for u in passed
        ]
        for c in cands:
            c["matched_category"] = cat_label
        stats["returned"] = len(cands)

        return {
            "group": gr,
            "candidates": cands,
            "stats": stats,
        }
