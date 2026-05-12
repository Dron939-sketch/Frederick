#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_fisherman_search.py
Поиск практиков (рыбаков) — наша B2B-аудитория.
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
    counters = user.get("counters") or {}
    return int(counters.get("followers") or 0) + int(counters.get("friends") or 0)


def _audience_known(user: Dict[str, Any]) -> bool:
    counters = user.get("counters")
    if not isinstance(counters, dict) or not counters:
        return False
    return any(
        counters.get(k) is not None for k in ("followers", "friends", "subscriptions")
    )


def _bio_text(user: Dict[str, Any]) -> str:
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
    is_closed = bool(user.get("is_closed"))
    can_access = user.get("can_access_closed")
    if not is_closed:
        return False
    if can_access is False or can_access == 0:
        return True
    if can_access is None:
        about = (user.get("about") or "").strip()
        status = (user.get("status") or "").strip()
        if not about and not status:
            return True
    return False


def _stem_ru(word: str) -> str:
    """Грубый русский стем для маркер-матчера: режем хвостовой гласный.
    «йога» → «йог» (ловит йогу/йогой/йоге/йоги/йогам/йогах).
    «стрижка» → «стрижк» (ловит стрижку/стрижки/стрижке).
    Слова на согласную («массаж», «маникюр») и короче 4 символов
    — не трогаем."""
    if not word or len(word) < 4:
        return word
    if word[-1] in "аяоеёуюыий":
        return word[:-1]
    return word


def _matches_markers(user: Dict[str, Any], markers: List[str]) -> bool:
    """True если bio юзера содержит маркер (с учётом падежных форм через
    стем для однословных) ИЛИ это закрытый профиль.

    Закрытые профили проходят на доверии: VK уже сматчил их на
    service_term, иначе их бы не было в выдаче users.search.

    Падежи: маркер «йога» → стем «йог» → substring ловит «йогу/йоге/йоги».
    Многословные («руководитель студии», «йога-инструктор», «студия йоги»)
    — substring без стема.
    """
    if _is_closed_no_data(user):
        return True
    if not markers:
        return False
    text = _bio_text(user)
    if not text:
        return True
    for m in markers:
        m_lower = (m or "").lower().strip()
        if not m_lower:
            continue
        if " " in m_lower or "-" in m_lower:
            if m_lower in text:
                return True
            continue
        stem = _stem_ru(m_lower)
        if stem in text:
            return True
    return False


def is_alive_profile(u: Dict[str, Any], max_inactivity_days: int = 90) -> bool:
    """Признак «живой» VK-страницы.

    Критерии (все одновременно):
      • не deactivated (юзер не удалён / не забанен)
      • если закрытый — отсеиваем (мы не сможем ни увидеть, ни написать)
      • last_seen не старше max_inactivity_days (по умолчанию 90 дней)

    Используется в search_fishermen с active_only=True и в worker'е
    очереди — нет смысла слать голос «мёртвой» страницы.
    """
    if u.get("deactivated"):
        return False
    if u.get("is_closed") and not u.get("can_access_closed"):
        return False
    ls = (u.get("last_seen") or {}).get("time") or 0
    if ls:
        try:
            import time as _t
            if (_t.time() - int(ls)) > max_inactivity_days * 86400:
                return False
        except (TypeError, ValueError):
            pass
    return True


def _candidate_dict(u: Dict[str, Any], cat_code: str, source: str = "users_search") -> Dict[str, Any]:
    name = " ".join(filter(None, [u.get("first_name"), u.get("last_name")])).strip()
    counters = u.get("counters") or {}
    occupation = u.get("occupation") or {}
    city_obj = u.get("city") if isinstance(u.get("city"), dict) else {}
    return {
        "vk_id": u.get("id"),
        "first_name": u.get("first_name") or "",
        "last_name": u.get("last_name") or "",
        "full_name": name,
        "sex": u.get("sex"),
        "bdate": u.get("bdate") or "",
        "city": city_obj.get("title") if city_obj else None,
        "city_id": city_obj.get("id") if city_obj else None,
        "status": (u.get("status") or "")[:200],
        "about": (u.get("about") or "")[:500],
        "occupation": occupation.get("name") if isinstance(occupation, dict) else None,
        "site": u.get("site") or "",
        "photo_max": u.get("photo_max"),
        "is_closed": bool(u.get("is_closed")),
        "followers": int(counters.get("followers") or 0),
        "friends": int(counters.get("friends") or 0),
        "audience_size": _audience_size(u),
        "audience_known": _audience_known(u),
        "category": cat_code,
        "source": source,
        "vk_url": f"https://vk.com/id{u.get('id')}",
    }


_CITY_RESOLVE_CACHE: Dict[str, Dict[str, Any]] = {}


async def resolve_city(name: str) -> Optional[Dict[str, Any]]:
    if not name or not name.strip():
        return None
    key = name.strip().lower()
    if key in _CITY_RESOLVE_CACHE:
        return _CITY_RESOLVE_CACHE[key]
    try:
        async with httpx.AsyncClient() as client:
            resp = await _call(client, "database.getCities", {
                "country_id": 1, "q": name.strip(), "count": 5, "need_all": 0,
            })
        items = (resp or {}).get("items") or []
        if not items:
            async with httpx.AsyncClient() as client:
                resp2 = await _call(client, "database.getCities", {
                    "country_id": 1, "q": name.strip(), "count": 5, "need_all": 1,
                })
            items = (resp2 or {}).get("items") or []
        if not items:
            _CITY_RESOLVE_CACHE[key] = None
            return None
        c = items[0]
        result = {
            "id": int(c.get("id")),
            "title": c.get("title") or "",
            "region": c.get("region") or "",
        }
        _CITY_RESOLVE_CACHE[key] = result
        logger.info(f"🏙️ resolved city '{name}' → id={result['id']} ({result['title']}, {result['region']})")
        return result
    except Exception as e:
        logger.warning(f"resolve_city('{name}') failed: {e}")
        return None


def _city_matches(cand: Dict[str, Any], target_id: int, target_name: str) -> bool:
    cand_city_id = cand.get("city_id")
    cand_city_title = (cand.get("city") or "").lower()
    if cand_city_id and target_id and int(cand_city_id) == int(target_id):
        return True
    if target_name and cand_city_title:
        if target_name.lower() in cand_city_title or cand_city_title in target_name.lower():
            return True
    return False


async def search_fishermen(
    category_code: str,
    *,
    max_per_term: int = 100,
    min_audience: int = 100,
    max_results: int = 30,
    include_newsfeed: bool = False,
    include_groups: bool = False,
    city_id: Optional[int] = None,
    city_name: Optional[str] = None,
    age_min: Optional[int] = None,
    age_max: Optional[int] = None,
    sex: Optional[int] = None,  # 1=female, 2=male, None=any
    active_only: bool = False,
    active_inactivity_days: int = 90,
) -> Dict[str, Any]:
    cat = get_fisherman(category_code)
    if not cat:
        return {
            "category": None,
            "candidates": [],
            "stats": {"reason": f"unknown category: {category_code}"},
        }

    service_terms: List[str] = cat.get("service_terms") or []
    bio_markers: List[str] = cat.get("bio_markers") or []
    topic_phrases: List[str] = cat.get("topic_phrases") or []

    seen: Dict[int, Dict[str, Any]] = {}
    source_by_uid: Dict[int, str] = {}
    search_attempts = 0
    search_success = 0
    search_failed_reasons: Dict[str, int] = {}
    newsfeed_stats = {"phrases_used": 0, "posts_seen": 0, "users_fetched": 0, "error": None}

    async with httpx.AsyncClient() as client:
        # Rate-limit для users.search: 0.4 сек между запросами (≈2.5/сек,
        # ниже VK-лимита 3/сек на user-token). При первой ошибке 9
        # «Flood control» — пауза до 5 сек на остаток.
        _sleep_between = 0.4
        _flood_seen = False
        import asyncio as _asyncio_rl

        for idx, term in enumerate(service_terms):
            if idx > 0:
                await _asyncio_rl.sleep(_sleep_between)
            search_attempts += 1
            try:
                _us_params = {
                    "q": term,
                    "count": min(max_per_term, 1000),
                    "fields": _VK_USER_FIELDS,
                    "country": 1,
                    "has_photo": 1,
                }
                if city_id and int(city_id) > 0:
                    _us_params["city"] = int(city_id)
                if age_min and int(age_min) > 0:
                    _us_params["age_from"] = int(age_min)
                if age_max and int(age_max) > 0:
                    _us_params["age_to"] = int(age_max)
                if sex in (1, 2):
                    _us_params["sex"] = int(sex)
                resp = await _call(client, "users.search", _us_params)
                search_success += 1
            except RuntimeError as e:
                key = str(e).split(":")[0][:60]
                search_failed_reasons[key] = search_failed_reasons.get(key, 0) + 1
                logger.warning(f"users.search('{term}') failed: {e}")
                # Flood control: error 9 — увеличиваем паузу
                if "9" in str(e) and ("flood" in str(e).lower() or "Too many" in str(e)):
                    if not _flood_seen:
                        _flood_seen = True
                        _sleep_between = 5.0
                        logger.warning(
                            f"VK flood-control hit on '{term}' — увеличиваю "
                            f"паузу между запросами до {_sleep_between}s"
                        )
                continue
            items = (resp or {}).get("items") or []
            for u in items:
                uid = u.get("id")
                if not isinstance(uid, int) or uid <= 0:
                    continue
                if uid in seen:
                    continue
                seen[uid] = u
                source_by_uid[uid] = "users_search"

        if include_newsfeed and topic_phrases:
            try:
                from_newsfeed_uids: List[int] = []
                posts_seen = 0
                for phrase in topic_phrases:
                    try:
                        nf_resp = await _call(client, "newsfeed.search", {
                            "q": phrase, "count": 200, "extended": 0,
                        })
                    except RuntimeError as e:
                        msg = str(e)
                        if not newsfeed_stats["error"]:
                            newsfeed_stats["error"] = msg[:120]
                        logger.warning(f"newsfeed.search('{phrase}') failed: {e}")
                        continue
                    items = (nf_resp or {}).get("items") or []
                    posts_seen += len(items)
                    for p in items:
                        fid = p.get("from_id") or p.get("owner_id")
                        if isinstance(fid, int) and fid > 0 and fid not in seen:
                            from_newsfeed_uids.append(fid)
                newsfeed_stats["phrases_used"] = len(topic_phrases)
                newsfeed_stats["posts_seen"] = posts_seen

                CHUNK = 500
                from_newsfeed_uids = list(dict.fromkeys(from_newsfeed_uids))
                fetched = 0
                for i in range(0, len(from_newsfeed_uids), CHUNK):
                    chunk = from_newsfeed_uids[i:i + CHUNK]
                    try:
                        ug_resp = await _call(client, "users.get", {
                            "user_ids": ",".join(str(x) for x in chunk),
                            "fields": _VK_USER_FIELDS,
                        })
                    except RuntimeError as e:
                        logger.warning(f"users.get(newsfeed chunk) failed: {e}")
                        continue
                    if isinstance(ug_resp, list):
                        for u in ug_resp:
                            uid = u.get("id")
                            if not isinstance(uid, int) or uid <= 0:
                                continue
                            if uid in seen:
                                continue
                            seen[uid] = u
                            source_by_uid[uid] = "newsfeed"
                            fetched += 1
                newsfeed_stats["users_fetched"] = fetched
                logger.info(
                    f"fisherman_search({category_code}): newsfeed source "
                    f"+{fetched} candidates (from {posts_seen} posts in "
                    f"{len(topic_phrases)} phrases)"
                )
            except Exception as e:
                logger.warning(f"newsfeed source failed: {e}")
                if not newsfeed_stats["error"]:
                    newsfeed_stats["error"] = str(e)[:120]

        groups_stats = {"groups_seen": 0, "members_fetched": 0, "error": None}
        if include_groups:
            try:
                from_groups_uids: List[int] = []
                terms_for_groups = (service_terms or [])[:3]
                for term in terms_for_groups:
                    gs_params = {
                        "q": term, "type": "group", "count": 5, "sort": 6,
                    }
                    if city_id and int(city_id) > 0:
                        gs_params["city_id"] = int(city_id)
                        gs_params["country_id"] = 1
                    try:
                        gs_resp = await _call(client, "groups.search", gs_params)
                    except RuntimeError as e:
                        logger.warning(f"groups.search('{term}') failed: {e}")
                        if not groups_stats["error"]:
                            groups_stats["error"] = str(e)[:120]
                        continue
                    grps = (gs_resp or {}).get("items") or []
                    groups_stats["groups_seen"] += len(grps)
                    for g in grps[:5]:
                        gid = g.get("id")
                        if not gid:
                            continue
                        try:
                            gm_resp = await _call(client, "groups.getMembers", {
                                "group_id": int(gid),
                                "count": 200,
                                "fields": _VK_USER_FIELDS,
                                "sort": "time_desc",
                            })
                        except RuntimeError as e:
                            logger.warning(f"groups.getMembers(gid={gid}) failed: {e}")
                            continue
                        members = (gm_resp or {}).get("items") or []
                        for u in members:
                            if not isinstance(u, dict):
                                continue
                            uid = u.get("id")
                            if not isinstance(uid, int) or uid <= 0:
                                continue
                            if uid in seen:
                                continue
                            if u.get("deactivated"):
                                continue
                            from_groups_uids.append(uid)
                            seen[uid] = u
                            source_by_uid[uid] = "group_member"
                groups_stats["members_fetched"] = len(from_groups_uids)
                logger.info(
                    f"fisherman_search({category_code}): groups source "
                    f"+{len(from_groups_uids)} candidates "
                    f"(from {groups_stats['groups_seen']} groups, "
                    f"city_id={city_id or 'any'})"
                )
            except Exception as e:
                logger.warning(f"groups source failed: {e}")
                if not groups_stats["error"]:
                    groups_stats["error"] = str(e)[:120]

        candidates_total = len(seen)

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

        unknown_uids = [uid for uid, u in after_markers.items() if not _audience_known(u)]
        if unknown_uids:
            CHUNK = 500
            enriched = 0
            for i in range(0, len(unknown_uids), CHUNK):
                chunk = unknown_uids[i:i + CHUNK]
                try:
                    resp = await _call(client, "users.get", {
                        "user_ids": ",".join(str(x) for x in chunk),
                        "fields": "counters",
                    })
                except RuntimeError as e:
                    logger.warning(f"users.get(counters) chunk failed: {e}")
                    continue
                if isinstance(resp, list):
                    for u_full in resp:
                        uid_full = u_full.get("id")
                        if uid_full in after_markers:
                            c = u_full.get("counters")
                            if isinstance(c, dict) and c:
                                after_markers[uid_full]["counters"] = c
                                enriched += 1
            logger.info(
                f"fisherman_search({category_code}): enriched counters "
                f"for {enriched}/{len(unknown_uids)} candidates"
            )

        after_audience: List[Dict[str, Any]] = []
        audience_unknown = 0
        rejected_audience = 0
        for u in after_markers.values():
            if _audience_known(u):
                if _audience_size(u) >= min_audience:
                    after_audience.append(u)
                else:
                    rejected_audience += 1
            else:
                after_audience.append(u)
                audience_unknown += 1

        if rejected_audience > 0:
            rejected_reasons[f"audience<{min_audience}"] = rejected_audience

        after_audience.sort(key=_audience_size, reverse=True)
        after_audience = after_audience[:max_results]

        logger.info(
            f"fisherman_search({category_code}): "
            f"VK={candidates_total} → markers/real={len(after_markers)} → "
            f"audience>={min_audience}={len(after_audience)} "
            f"(of which {audience_unknown} unknown) → "
            f"returned={min(len(after_audience), max_results)} "
            f"(rejects: {rejected_reasons})"
        )

    # Фильтр «живых» страниц — отсев deactivated / closed / неактивных
    # дольше N дней. Делаем ДО _candidate_dict (на сырых VK-объектах,
    # где доступны last_seen, deactivated и т.п.).
    alive_filtered_out = 0
    if active_only:
        _before = len(after_audience)
        after_audience = [
            u for u in after_audience
            if is_alive_profile(u, max_inactivity_days=active_inactivity_days)
        ]
        alive_filtered_out = _before - len(after_audience)

    candidates = [
        _candidate_dict(u, category_code, source_by_uid.get(u.get("id"), "users_search"))
        for u in after_audience
    ]

    city_filtered_out = 0
    if city_id and int(city_id) > 0:
        target_id = int(city_id)
        target_name = (city_name or "").strip()
        before = len(candidates)
        candidates = [c for c in candidates if _city_matches(c, target_id, target_name)]
        city_filtered_out = before - len(candidates)
        logger.info(
            f"🏙️ city post-filter: target_id={target_id} ({target_name or '-'}) "
            f"kept {len(candidates)}/{before} (filtered out {city_filtered_out})"
        )

    source_counts = {"users_search": 0, "newsfeed": 0, "group_member": 0}
    for c in candidates:
        s = c.get("source") or "users_search"
        source_counts[s] = source_counts.get(s, 0) + 1

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
            "audience_unknown": audience_unknown,
            "returned": len(candidates),
            "min_audience": min_audience,
            "rejected_reasons": rejected_reasons,
            "newsfeed": newsfeed_stats if include_newsfeed else None,
            "groups": groups_stats if include_groups else None,
            "source_counts": source_counts,
            "city_id_used": city_id if city_id else None,
            "city_name_used": city_name if city_name else None,
            "city_filtered_out": city_filtered_out if (city_id and int(city_id) > 0) else 0,
        },
    }
