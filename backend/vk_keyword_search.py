#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_keyword_search.py
Поиск авторов постов в VK по ключевым фразам через newsfeed.search.

Зачем:
  В сообществах ВКонтакте полно ботов-накрутчиков, которых не отличить от
  людей по списку участников. Но боты не пишут осмысленных постов на тему
  своей боли. Поэтому самый качественный сигнал «у этого человека прямо
  сейчас X» — это публикация на эту тему за последний месяц.

Алгоритм:
  1. Для каждой фразы из категории дёргаем newsfeed.search?q=<phrase>
     с count до 200.
  2. Из items берём from_id (или owner_id) — id автора поста. Отфильтровываем
     отрицательные (это паблики/группы, не люди).
  3. Дедупим, режем до total_limit.
  4. Тащим карточки через users.get?user_ids=...&fields=...
  5. Возвращаем список user-dict в той же форме, что отдаёт groups.getMembers.

Ограничения:
  • newsfeed.search требует user-token (не сервисный). Используем тот же
    VK_SERVICE_TOKEN из env — если в нём лежит user-токен (Standalone/Implicit
    flow), всё работает. Если только сервисный — VK вернёт ошибку 27 и мы
    отдадим пустой список.
  • newsfeed.search ищет только в открытых постах за ~30 дней.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set

import httpx

from vk_parser import _call

logger = logging.getLogger(__name__)


_VK_USER_FIELDS = (
    "city,country,bdate,sex,about,status,is_closed,can_access_closed,"
    "photo_max,has_photo,last_seen"
)


async def fetch_newsfeed_posts(
    phrases: List[str],
    *,
    per_phrase: int = 200,
) -> List[Dict[str, Any]]:
    """Один shared проход по newsfeed.search — для всех трёх каналов.

    Возвращает плоский список постов с метаданными. Используется problem_search,
    чтобы не дёргать VK API трижды (keyword + comment + anchor) с одинаковыми
    фразами — это уводит в rate-limit и теряет данные.

    Каждый post-dict дополнен полем `_phrase` — фраза, по которой пост найден.
    """
    posts: List[Dict[str, Any]] = []
    if not phrases:
        return posts
    async with httpx.AsyncClient() as client:
        for phrase in phrases:
            try:
                resp = await _call(client, "newsfeed.search", {
                    "q": phrase,
                    "count": min(per_phrase, 200),
                    "extended": 0,
                })
            except RuntimeError as e:
                logger.warning(f"newsfeed.search('{phrase}') failed: {e}")
                continue
            items = (resp or {}).get("items") or []
            for p in items:
                p["_phrase"] = phrase
                posts.append(p)
    logger.info(
        f"fetch_newsfeed_posts: {len(phrases)} phrases -> {len(posts)} posts"
    )
    return posts


async def search_authors_by_phrases(
    phrases: List[str],
    *,
    per_phrase: int = 200,
    total_limit: int = 300,
    shared_posts: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Возвращает {users: [user_dict, ...], stats: {phrases_used, posts_seen, unique_authors, fetched}}.

    Если передан `shared_posts` — используем его и не дёргаем newsfeed.
    """
    if not phrases:
        return {
            "users": [],
            "stats": {
                "phrases_used": 0, "posts_seen": 0,
                "unique_authors": 0, "fetched": 0,
                "per_phrase": {},
            },
        }

    user_ids: Set[int] = set()
    posts_seen = 0
    # Per-phrase атрибуция нужна для self-correction: какая именно фраза
    # сколько постов вернула и сколько уникальных авторов из неё пошли дальше.
    phrase_breakdown: Dict[str, Dict[str, int]] = {p: {"posts_seen": 0, "authors": 0} for p in phrases}
    # uid → первая фраза, по которой нашли. Чтобы не атрибутировать одного
    # автора нескольким фразам.
    uid_to_phrase: Dict[int, str] = {}
    # uid → текст первого поста этого автора + URL. Copywriter использует
    # реальные слова человека как эхо-зацепку (без прямого цитирования).
    uid_to_post: Dict[int, Dict[str, Any]] = {}

    async with httpx.AsyncClient() as client:
        # Источник постов: либо shared (один проход по newsfeed для всех каналов),
        # либо собираем сами с дублированием запросов.
        if shared_posts is not None:
            posts_to_walk = shared_posts
        else:
            posts_to_walk = []
            for phrase in phrases:
                try:
                    resp = await _call(client, "newsfeed.search", {
                        "q": phrase,
                        "count": min(per_phrase, 200),
                        "extended": 0,
                    })
                except RuntimeError as e:
                    logger.warning(f"newsfeed.search('{phrase}') failed: {e}")
                    continue
                items = (resp or {}).get("items") or []
                for p in items:
                    p["_phrase"] = phrase
                    posts_to_walk.append(p)

        for p in posts_to_walk:
            if len(user_ids) >= total_limit:
                break
            phrase = p.get("_phrase") or ""
            if not phrase or phrase not in phrase_breakdown:
                continue
            posts_seen += 1
            phrase_breakdown[phrase]["posts_seen"] += 1
            fid = p.get("from_id") or p.get("owner_id")
            if isinstance(fid, int) and fid > 0:
                if fid not in uid_to_phrase:
                    uid_to_phrase[fid] = phrase
                    phrase_breakdown[phrase]["authors"] += 1
                    # Сохраняем текст и URL первого поста — copywriter
                    # использует это как «эхо» в крючке.
                    post_owner = p.get("owner_id")
                    post_id = p.get("id")
                    text = (p.get("text") or "").strip()
                    if text:
                        uid_to_post[fid] = {
                            "text": text[:400],
                            "post_url": f"https://vk.com/wall{post_owner}_{post_id}" if post_owner and post_id else "",
                            "source_phrase": phrase,
                        }
                user_ids.add(fid)

        ids_list = list(user_ids)[:total_limit]

        # Резолвим пачками по 1000 (лимит users.get)
        users: List[Dict[str, Any]] = []
        for batch_start in range(0, len(ids_list), 1000):
            batch = ids_list[batch_start:batch_start + 1000]
            try:
                resp = await _call(client, "users.get", {
                    "user_ids": ",".join(map(str, batch)),
                    "fields": _VK_USER_FIELDS,
                })
            except RuntimeError as e:
                logger.warning(f"users.get(batch={len(batch)}) failed: {e}")
                continue
            if isinstance(resp, list):
                for u in resp:
                    src_phrase = uid_to_phrase.get(u.get("id"))
                    if src_phrase:
                        u["_source_phrase"] = src_phrase
                    # Триггер-пост (для post-source кандидатов) — текст
                    # реальной публикации, по которой мы их нашли.
                    post_meta = uid_to_post.get(u.get("id"))
                    if post_meta:
                        u["_triggering_post"] = post_meta
                users.extend(resp)

    return {
        "users": users,
        "stats": {
            "phrases_used": len(phrases),
            "posts_seen": posts_seen,
            "unique_authors": len(user_ids),
            "fetched": len(users),
            "per_phrase": phrase_breakdown,
        },
    }
