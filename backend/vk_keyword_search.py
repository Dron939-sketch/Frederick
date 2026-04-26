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
from typing import Any, Dict, List, Set

import httpx

from vk_parser import _call

logger = logging.getLogger(__name__)


_VK_USER_FIELDS = (
    "city,country,bdate,sex,about,status,is_closed,can_access_closed,"
    "photo_max,has_photo,last_seen"
)


async def search_authors_by_phrases(
    phrases: List[str],
    *,
    per_phrase: int = 200,
    total_limit: int = 300,
) -> Dict[str, Any]:
    """Возвращает {users: [user_dict, ...], stats: {phrases_used, posts_seen, unique_authors, fetched}}.

    На вход список фраз — обычно из category.seed_search_phrases.
    """
    if not phrases:
        return {
            "users": [],
            "stats": {
                "phrases_used": 0, "posts_seen": 0,
                "unique_authors": 0, "fetched": 0,
            },
        }

    user_ids: Set[int] = set()
    posts_seen = 0

    async with httpx.AsyncClient() as client:
        for phrase in phrases:
            if len(user_ids) >= total_limit:
                break
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
            posts_seen += len(items)
            for p in items:
                # Сначала from_id — он и есть автор. owner_id может быть стеной
                # сообщества (отрицательное).
                fid = p.get("from_id") or p.get("owner_id")
                if isinstance(fid, int) and fid > 0:
                    user_ids.add(fid)
                if len(user_ids) >= total_limit:
                    break

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
                users.extend(resp)

    return {
        "users": users,
        "stats": {
            "phrases_used": len(phrases),
            "posts_seen": posts_seen,
            "unique_authors": len(user_ids),
            "fetched": len(users),
        },
    }
