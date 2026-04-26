"""
vk_twin_finder.py — поиск «близнецов» в VK по слепку признаков (Phase 4).

На вход берёт результат `vk_feature_extractor.extract_features`:
  - marker_groups[].id  → groups.getMembers
  - demographics{sex, age_range, city_id}  → фильтр
  - marker_keywords     → пока не используем (нужно для users.search в Phase 4b)

Стратегия:
  1) groups.getMembers для топ-N marker_groups (по умолчанию 3, по 1000 членов)
  2) Объединяем участников, считаем пересечения (сколько marker-групп пересекается)
  3) Фильтр по demographics (закрытые профили отсекаем)
  4) Скоринг = 10 × число_пересечений + бонус 20 если 2+ пересечений
  5) Возвращаем топ-N по score (по умолчанию 50)

Использует те же rate-limit (3 rps) и in-memory кэш (7 дней) что и парсер —
импортируем приватный `_call` из vk_parser, чтобы не плодить два HTTP-клиента
с разными лимитами на одну VK-учётку.
"""

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from vk_parser import _call, is_real_active_profile  # type: ignore[attr-defined]

logger = logging.getLogger(__name__)

# В список полей добавлены last_seen и has_photo — они нужны фильтру
# «живой профиль» (заблокирован/заброшен/фейк). Без них фильтр не сможет
# отличить рабочую страницу от пустой заглушки.
_VK_USER_FIELDS = (
    "city,country,bdate,sex,about,status,is_closed,can_access_closed,"
    "photo_max,has_photo,last_seen"
)


def _normalise_sex(s: Any) -> Optional[int]:
    """Берёт ИИ-вывод 'm'/'f' и переводит в VK-код (1=ж, 2=м)."""
    if s is None:
        return None
    if isinstance(s, int):
        return s if s in (1, 2) else None
    s = str(s).strip().lower()
    if s in ("f", "ж", "женский", "female", "1"):
        return 1
    if s in ("m", "м", "мужской", "male", "2"):
        return 2
    return None


def _parse_birth_year(bdate: str) -> Optional[int]:
    """VK bdate — '24.1.1984' или '24.1' (без года, если юзер скрыл)."""
    if not bdate:
        return None
    parts = bdate.split(".")
    if len(parts) != 3:
        return None
    try:
        y = int(parts[2])
        if 1900 < y < 2100:
            return y
    except ValueError:
        pass
    return None


def _matches_demographics(
    u: Dict[str, Any],
    target_sex: Optional[int],
    age_range: Optional[List[int]],
    city_id: Optional[int],
    city_name: Optional[str],
    geo_scope: str = "same_city",
    country_id: Optional[int] = None,
) -> bool:
    """Возвращает True если кандидат подходит под demographics + geo_scope.

    geo_scope:
      - "same_city": нужен совпадающий city_id или city_name
      - "russia":    нужен country_id == 1
      - "worldwide": geo не фильтруем
    """
    # Закрытый профиль — outreach всё равно невозможен
    if u.get("is_closed") and not u.get("can_access_closed"):
        return False

    if target_sex:
        u_sex = u.get("sex")
        if u_sex and u_sex != target_sex:
            return False

    if age_range and isinstance(age_range, list) and len(age_range) == 2:
        year = _parse_birth_year(u.get("bdate") or "")
        if year:
            cur = time.gmtime().tm_year
            age = cur - year
            # ±2 года толерантности — у людей разный месяц рождения
            if age < int(age_range[0]) - 2 or age > int(age_range[1]) + 2:
                return False
        # Если года нет — не отбрасываем, просто без штрафа

    # Geo-scope: same_city → city match; russia → country match; worldwide → пропускаем
    if geo_scope == "same_city" and (city_id or city_name):
        uc = u.get("city") or {}
        if isinstance(uc, dict):
            uc_id = uc.get("id")
            uc_title = uc.get("title")
            if city_id and uc_id and int(uc_id) != int(city_id):
                return False
            if not city_id and city_name and uc_title and \
               str(uc_title).strip().lower() != str(city_name).strip().lower():
                return False
        else:
            return False
    elif geo_scope == "russia":
        # country.id == 1 — Россия в VK справочнике стран.
        cc = u.get("country") or {}
        target_country = country_id or 1
        if isinstance(cc, dict):
            cc_id = cc.get("id")
            if cc_id and int(cc_id) != int(target_country):
                return False
            # Если country отсутствует у юзера — не отбрасываем, не накажем тех у кого скрыто
    # geo_scope == "worldwide" — geo фильтр не применяется
    return True


def _score(intersections: int) -> int:
    s = intersections * 10
    if intersections >= 2:
        s += 20
    return s


def _candidate_dict(uid: int, u: Dict[str, Any], matched_groups: List[Dict[str, Any]]) -> Dict[str, Any]:
    city = u.get("city") if isinstance(u.get("city"), dict) else None
    return {
        "vk_id": uid,
        "url": f"https://vk.com/id{uid}",
        "first_name": u.get("first_name"),
        "last_name": u.get("last_name"),
        "sex": u.get("sex"),
        "bdate": u.get("bdate"),
        "city": (city or {}).get("title"),
        "city_id": (city or {}).get("id"),
        "status": (u.get("status") or "")[:200],
        "about": (u.get("about") or "")[:200],
        "photo": u.get("photo_max") or "",
        "is_closed": bool(u.get("is_closed")),
        "matched_groups": [
            {"id": g.get("id"), "name": g.get("name"), "screen_name": g.get("screen_name")}
            for g in matched_groups
        ],
        "match_score": _score(len(matched_groups)),
    }


async def find_twins(
    seed_vk_id: int,
    features: Dict[str, Any],
    *,
    max_groups_to_scan: int = 3,
    members_per_group: int = 1000,
    max_candidates: int = 50,
    geo_scope: str = "auto",
    min_intersections: int = 3,
) -> Dict[str, Any]:
    """Возвращает {candidates: [...], stats: {...}, groups_used: [...]}.

    Этап 1 (этот модуль): поиск по интересам (пересечение marker-групп).
    Этап 2 (опциональный, vk_twin_reranker): re-scoring по тематике постов.

    min_intersections — минимальное число marker-групп, в которых должен
    одновременно состоять кандидат, чтобы считаться «подходящим по интересам».
    Default 3 — даёт точное попадание ценой меньшего числа кандидатов.

    geo_scope:
      - "auto"      → берём search_recommendation.geo_scope из features (если есть),
                      иначе same_city если есть city_id, иначе russia
      - "same_city" → искать только в городе seed-юзера
      - "russia"    → искать по всей России
      - "worldwide" → без географического фильтра
    """
    marker_groups = features.get("marker_groups") or []
    demo = features.get("demographics") or {}

    target_sex = _normalise_sex(demo.get("sex"))
    age_range = demo.get("age_range") if isinstance(demo.get("age_range"), list) else None
    city_id = demo.get("city_id") if isinstance(demo.get("city_id"), int) else None
    city_name = demo.get("city") if isinstance(demo.get("city"), str) else None
    country_id = demo.get("country_id") if isinstance(demo.get("country_id"), int) else None

    if geo_scope == "auto":
        rec = (features.get("search_recommendation") or {}).get("geo_scope")
        if rec in ("same_city", "russia", "worldwide"):
            geo_scope = rec
        elif city_id or city_name:
            geo_scope = "same_city"
        else:
            geo_scope = "russia"

    groups_to_scan: List[Dict[str, Any]] = []
    for g in marker_groups[:max_groups_to_scan]:
        if isinstance(g, dict) and g.get("id"):
            groups_to_scan.append(g)

    if not groups_to_scan:
        return {
            "candidates": [],
            "stats": {
                "groups_scanned": 0,
                "members_fetched": 0,
                "after_intersection_filter": 0,
                "after_demo_filter": 0,
                "returned": 0,
            },
            "groups_used": [],
            "note": (
                "В слепке нет marker_groups с числовыми id — поиск близнецов через "
                "groups.getMembers невозможен. Можно дополнить через users.search "
                "(Phase 4b) или повторить «Признаки» когда появятся группы в VK."
            ),
        }

    # uid → user_dict, uid → list of group dicts where they appear
    members: Dict[int, Dict[str, Any]] = {}
    member_groups: Dict[int, List[Dict[str, Any]]] = {}
    members_fetched = 0

    async with httpx.AsyncClient() as client:
        for g in groups_to_scan:
            gid = g["id"]
            try:
                resp = await _call(client, "groups.getMembers", {
                    "group_id": gid,
                    "count": members_per_group,
                    "offset": 0,
                    "fields": _VK_USER_FIELDS,
                    "sort": "id_desc",  # свежие участники первыми — обычно активнее
                })
            except RuntimeError as e:
                logger.warning(f"groups.getMembers({gid}) failed: {e}")
                continue
            items = (resp or {}).get("items") or []
            members_fetched += len(items)
            for u in items:
                uid = u.get("id")
                if not uid or uid == seed_vk_id:
                    continue
                if uid not in members:
                    members[uid] = u
                    member_groups[uid] = [g]
                else:
                    # тот же юзер в нескольких целевых группах — пересечение
                    member_groups[uid].append(g)

    # Phase 7: фильтр по min_intersections (минимум N marker-групп пересеклось).
    # Резко режет шум: при min=1 кандидатов тысячи, при min=3 — десятки/сотни.
    min_int = max(1, int(min_intersections))
    after_intersect: Dict[int, Dict[str, Any]] = {
        uid: u for uid, u in members.items()
        if len(member_groups[uid]) >= min_int
    }

    # Затем фильтр по demographics
    after_demo: List[Tuple[int, Dict[str, Any]]] = []
    for uid, u in after_intersect.items():
        if _matches_demographics(u, target_sex, age_range, city_id, city_name,
                                  geo_scope=geo_scope, country_id=country_id):
            after_demo.append((uid, u))

    # Фильтр «живой профиль»: убираем заблокированных / заброшенных /
    # без аватарки / пустые. С детализацией причин — оператор видит,
    # сколько отлетело и почему.
    rejected_by_reason: Dict[str, int] = {}
    after_real: List[Tuple[int, Dict[str, Any]]] = []
    for uid, u in after_demo:
        ok, reason = is_real_active_profile(u)
        if ok:
            after_real.append((uid, u))
        else:
            key = (reason or "unknown").split(":", 1)[0]
            rejected_by_reason[key] = rejected_by_reason.get(key, 0) + 1

    # Скорим, сортируем
    scored = [
        (uid, u, _score(len(member_groups[uid])))
        for uid, u in after_real
    ]
    scored.sort(key=lambda t: t[2], reverse=True)
    top = scored[:max_candidates]

    candidates = [_candidate_dict(uid, u, member_groups[uid]) for uid, u, _ in top]

    return {
        "candidates": candidates,
        "stats": {
            "groups_scanned": len(groups_to_scan),
            "members_fetched": members_fetched,
            "unique_members": len(members),
            "min_intersections": min_int,
            "after_intersection_filter": len(after_intersect),
            "after_demo_filter": len(after_demo),
            "after_quality_filter": len(after_real),
            "rejected_by_reason": rejected_by_reason,
            "returned": len(candidates),
        },
        "groups_used": [
            {"id": g.get("id"), "name": g.get("name"), "screen_name": g.get("screen_name")}
            for g in groups_to_scan
        ],
        "demographics_used": {
            "sex": target_sex,
            "age_range": age_range,
            "city_id": city_id,
            "city": city_name,
            "country_id": country_id,
            "geo_scope": geo_scope,
        },
    }
