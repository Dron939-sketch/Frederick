#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_anchor_search.py
«Рыбохищный» источник кандидатов: используем чужие маркетинговые посты как
магниты, и забираем их улов — лайкеров и репостеров.

Идея:
  Психологи / коучи / эзотерики пишут посты «5 признаков выгорания» специально
  чтобы попадать в ленту страдальцев. Страдальцы ставят лайк или репостят
  («это про меня»). То есть психолог уже сделал за нас фильтрацию аудитории.
  Мы просто забираем тех, кто узнал себя в его посте.

Алгоритм:
  1. newsfeed.search?q=<phrase> — собираем посты + счётчики.
  2. Скоринг «магнитности»: likes + 5*comments + 10*reposts. Чем выше —
     тем сильнее пост ловит целевую аудиторию.
  3. Берём топ-N якорей (default 15).
  4. Для каждого якоря:
     • likes.getList(type='post', owner_id, item_id, count=1000)
     • wall.getReposts(owner_id, post_id, count=200)
  5. Объединяем уникальных юзеров → users.get.
  6. На юзере прикрепляем `_anchor` с ссылкой на пост и типом действия.

Stats (для UI-диагностики):
  • anchors_total — сколько постов рассмотрено
  • anchors_used — сколько из них использованы как магниты
  • likes_attempted/success/failed_reasons
  • reposts_attempted/success/failed_reasons
  • likers_unique / reposters_unique
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from vk_parser import _call

logger = logging.getLogger(__name__)


_VK_USER_FIELDS = (
    "city,country,bdate,sex,about,status,is_closed,can_access_closed,"
    "photo_max,has_photo,last_seen"
)


# Маркетинговые сигналы — пост написан рыбаком (психолог/коуч/блогер),
# а не страдальцем. Это ровно те же паттерны, по которым в brightness
# мы штрафуем кандидатов; здесь — наоборот, СИГНАЛ что это якорь.
_MARKETING_ANCHOR_RE = re.compile(
    r"(\bко\s+мне\s+(приход|обращ|на\s+консульт)|"
    r"\bна\s+консультаци|\bмо[еих]+\s+клиент[а-я]*|"
    r"\bодн[аои][а-я]*\s+из\s+клиент[а-я]+|"
    r"\bпомога[юе]\s+(людям|вам|выйти|найти|выбраться|маме|женщин)|"
    r"\bкак\s+психолог|\bкак\s+коуч|\bкак\s+эксперт|\bя\s+психолог|\bя\s+коуч|"
    r"\bвытаскива[юе]\s+из|"
    r"\bстать[яи]\s+\d|\bчасть\s+\d|"
    r"\b\d+\s+(правил|столп|шаг|причин|секрет|способ|урок|ошиб|закон)|"
    r"ridero\.ru|"
    r"\bзапис[аы]ться\s+на\s+консультаци|"
    r"\bтехник[аи]\s+АСТ|\bКПТ|\bкогнитивно[\-\s]поведенческ|"
    r"\bпровод[ия][тл]?\s+игр[ыу]|трансформацион[а-я]+\s+игр)",
    re.IGNORECASE,
)


def _engagement_score(post: Dict[str, Any]) -> int:
    """Магнитность поста: likes + 5*comments + 10*reposts."""
    likes = ((post.get("likes") or {}).get("count")) or 0
    comments = ((post.get("comments") or {}).get("count")) or 0
    reposts = ((post.get("reposts") or {}).get("count")) or 0
    return int(likes) + 5 * int(comments) + 10 * int(reposts)


def _is_fisherman_post(post: Dict[str, Any]) -> bool:
    """Это маркетинг-якорь? Текст поста содержит сигналы рыбака."""
    text = (post.get("text") or "").lower()
    return bool(_MARKETING_ANCHOR_RE.search(text))


async def search_engagers_of_anchor_posts(
    phrases: List[str],
    *,
    posts_per_phrase: int = 30,
    max_anchors: int = 15,
    likes_per_anchor: int = 1000,
    reposts_per_anchor: int = 200,
    total_limit: int = 300,
    shared_posts: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Возвращает {users, stats}.

    posts_per_phrase: сколько постов брать из newsfeed.search per phrase.
    max_anchors: сколько топ-якорей использовать (по engagement_score).
    likes_per_anchor / reposts_per_anchor: VK API limits per call.
    total_limit: жёсткий потолок уникальных engager'ов.
    """
    if not phrases:
        return {
            "users": [],
            "stats": {
                "phrases_used": 0, "anchors_total": 0, "anchors_used": 0,
                "likes_attempted": 0, "likes_success": 0,
                "reposts_attempted": 0, "reposts_success": 0,
                "likers_unique": 0, "reposters_unique": 0, "fetched": 0,
            },
        }

    # Этап 1: собираем все посты с метаданными.
    all_posts: List[Dict[str, Any]] = []

    likes_attempted = 0
    likes_success = 0
    likes_failed_reasons: Dict[str, int] = {}
    reposts_attempted = 0
    reposts_success = 0
    reposts_failed_reasons: Dict[str, int] = {}
    likers_unique = 0
    reposters_unique = 0

    async with httpx.AsyncClient() as client:
        if shared_posts is not None:
            # Используем shared pool — без повторного запроса newsfeed.
            for p in shared_posts:
                pid = p.get("id")
                oid = p.get("owner_id")
                if not (isinstance(pid, int) and isinstance(oid, int)):
                    continue
                if "_engagement" not in p:
                    p["_engagement"] = _engagement_score(p)
                all_posts.append(p)
        else:
            for phrase in phrases:
                try:
                    resp = await _call(client, "newsfeed.search", {
                        "q": phrase,
                        "count": min(posts_per_phrase, 200),
                        "extended": 0,
                    })
                except RuntimeError as e:
                    logger.warning(f"newsfeed.search('{phrase}') for anchor failed: {e}")
                    continue
                items = (resp or {}).get("items") or []
                for p in items:
                    pid = p.get("id")
                    oid = p.get("owner_id")
                    if not (isinstance(pid, int) and isinstance(oid, int)):
                        continue
                    p["_phrase"] = phrase
                    p["_engagement"] = _engagement_score(p)
                    all_posts.append(p)

        # Этап 2: фильтруем только маркетинговые посты (рыбаков), сортируем
        # по engagement, берём топ-N. Без этой фильтрации в anchors попадают
        # любые виральные посты — рассказы, мемы, новости, — а их лайкеры
        # не нужны нам как страдальцы. Нам нужны лайкеры именно постов
        # психологов/коучей/блогеров про боль.
        fishermen_posts = [
            p for p in all_posts
            if p.get("_engagement", 0) >= 10 and _is_fisherman_post(p)
        ]
        fishermen_posts.sort(key=lambda p: p.get("_engagement", 0), reverse=True)
        anchors = fishermen_posts[:max_anchors]
        marketing_total = sum(1 for p in all_posts if _is_fisherman_post(p))

        logger.info(
            f"anchor_search: collected {len(all_posts)} posts, "
            f"{marketing_total} look like marketing, "
            f"top-{len(anchors)} anchors used (engagement>=10 + fisherman)"
        )

        # uid → meta анкорной активности (ставим первый пойманный action).
        engagers: Dict[int, Dict[str, Any]] = {}

        # Этап 3: лайкеры + репостеры каждого якоря.
        for post in anchors:
            if len(engagers) >= total_limit:
                break
            owner = post["owner_id"]
            pid = post["id"]
            post_url = f"https://vk.com/wall{owner}_{pid}"
            excerpt = (post.get("text") or "")[:200]
            engagement = post.get("_engagement", 0)

            # Репостеры — самый горячий сигнал, ставим первыми.
            reposts_attempted += 1
            try:
                resp = await _call(client, "wall.getReposts", {
                    "owner_id": owner,
                    "post_id": pid,
                    "count": min(reposts_per_anchor, 1000),
                })
                reposts_success += 1
            except RuntimeError as e:
                key = str(e).split(":")[0][:60]
                reposts_failed_reasons[key] = reposts_failed_reasons.get(key, 0) + 1
                if sum(reposts_failed_reasons.values()) <= 3:
                    logger.warning(f"wall.getReposts({owner}_{pid}) failed: {e}")
                resp = None
            if resp:
                profiles = (resp or {}).get("profiles") or []
                for u in profiles:
                    uid = u.get("id")
                    if not isinstance(uid, int) or uid <= 0:
                        continue
                    if uid in engagers:
                        continue
                    engagers[uid] = {
                        "action": "repost",
                        "post_url": post_url,
                        "post_excerpt": excerpt,
                        "source_phrase": post.get("_phrase"),
                        "engagement": engagement,
                    }
                    reposters_unique += 1
                    if len(engagers) >= total_limit:
                        break
            if len(engagers) >= total_limit:
                break

            # Лайкеры — массовый сигнал.
            likes_attempted += 1
            try:
                resp = await _call(client, "likes.getList", {
                    "type": "post",
                    "owner_id": owner,
                    "item_id": pid,
                    "count": min(likes_per_anchor, 1000),
                    "extended": 0,
                })
                likes_success += 1
            except RuntimeError as e:
                key = str(e).split(":")[0][:60]
                likes_failed_reasons[key] = likes_failed_reasons.get(key, 0) + 1
                if sum(likes_failed_reasons.values()) <= 3:
                    logger.warning(f"likes.getList({owner}_{pid}) failed: {e}")
                resp = None
            if resp:
                items = (resp or {}).get("items") or []
                for uid in items:
                    if not isinstance(uid, int) or uid <= 0:
                        continue
                    if uid in engagers:
                        continue
                    engagers[uid] = {
                        "action": "like",
                        "post_url": post_url,
                        "post_excerpt": excerpt,
                        "source_phrase": post.get("_phrase"),
                        "engagement": engagement,
                    }
                    likers_unique += 1
                    if len(engagers) >= total_limit:
                        break

        # Этап 4: резолвим юзеров через users.get (лимит 1000 на запрос).
        ids_list = list(engagers.keys())[:total_limit]
        users: List[Dict[str, Any]] = []
        for batch_start in range(0, len(ids_list), 1000):
            batch = ids_list[batch_start:batch_start + 1000]
            try:
                resp = await _call(client, "users.get", {
                    "user_ids": ",".join(map(str, batch)),
                    "fields": _VK_USER_FIELDS,
                })
            except RuntimeError as e:
                logger.warning(f"users.get(anchor_batch={len(batch)}) failed: {e}")
                continue
            if isinstance(resp, list):
                for u in resp:
                    meta = engagers.get(u.get("id"))
                    if meta:
                        u["_anchor"] = meta
                        u["_source_phrase"] = meta.get("source_phrase")
                users.extend(resp)

        logger.info(
            f"anchor_search: anchors_used={len(anchors)} "
            f"likes_ok={likes_success}/{likes_attempted} "
            f"reposts_ok={reposts_success}/{reposts_attempted} "
            f"engagers_unique={len(engagers)} fetched={len(users)} "
            f"like_reasons={likes_failed_reasons} "
            f"repost_reasons={reposts_failed_reasons}"
        )

    return {
        "users": users,
        "stats": {
            "phrases_used": len(phrases),
            "anchors_total": len(all_posts),
            "fishermen_posts": marketing_total,
            "anchors_used": len(anchors),
            "likes_attempted": likes_attempted,
            "likes_success": likes_success,
            "likes_failed_reasons": likes_failed_reasons,
            "reposts_attempted": reposts_attempted,
            "reposts_success": reposts_success,
            "reposts_failed_reasons": reposts_failed_reasons,
            "likers_unique": likers_unique,
            "reposters_unique": reposters_unique,
            "fetched": len(users),
        },
    }
