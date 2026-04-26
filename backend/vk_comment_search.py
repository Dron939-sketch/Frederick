#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/vk_comment_search.py
Поиск кандидатов через КОММЕНТАРИИ к постам на тему (а не через авторов
постов или участников групп).

Идея:
  Пост — initiator, комментарий — реакция. В комментариях люди часто
  открываются сильнее, чем в собственной публикации: «А я тоже ночами
  не сплю, и …», «У меня то же самое было…». Это прямой эмоциональный
  отпечаток, и автор комментария почти гарантированно живой человек,
  не бот (боты в комменты тематических постов не пишут осмысленный текст).

Алгоритм:
  1. newsfeed.search?q=<phrase> — берём посты на тему
  2. Для каждого поста — wall.getComments?owner_id=...&post_id=...
  3. Собираем from_id комментаторов + текст коммента
  4. Резолвим юзеров через users.get
  5. Возвращаем user-dict-ы с встроенным `_triggering_comment`,
     vk_problem_search прокидывает его дальше в карточку.

Триггер-коммент потом виден оператору — он сразу понимает, на что
именно человек реагировал и какая у него боль.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

from vk_parser import _call

logger = logging.getLogger(__name__)


_VK_USER_FIELDS = (
    "city,country,bdate,sex,about,status,is_closed,can_access_closed,"
    "photo_max,has_photo,last_seen"
)


async def search_authors_by_comments(
    phrases: List[str],
    *,
    posts_per_phrase: int = 20,
    comments_per_post: int = 20,
    total_limit: int = 300,
) -> Dict[str, Any]:
    """Возвращает {users: [user_dict, ...], stats: {...}}.

    posts_per_phrase: сколько постов брать из newsfeed.search на каждую фразу.
    comments_per_post: сколько комментариев тащить из каждого поста.
    total_limit: жёсткий потолок числа уникальных коммен­та­то­ров.
    """
    if not phrases:
        return {
            "users": [],
            "stats": {
                "phrases_used": 0, "posts_seen": 0,
                "comments_seen": 0, "unique_commenters": 0, "fetched": 0,
            },
        }

    # Сначала собираем плоский список постов на тему.
    posts: List[Dict[str, Any]] = []
    posts_seen = 0

    async with httpx.AsyncClient() as client:
        for phrase in phrases:
            try:
                resp = await _call(client, "newsfeed.search", {
                    "q": phrase,
                    "count": min(posts_per_phrase, 200),
                    "extended": 0,
                })
            except RuntimeError as e:
                logger.warning(f"newsfeed.search('{phrase}') failed: {e}")
                continue
            items = (resp or {}).get("items") or []
            posts_seen += len(items)
            for p in items:
                pid = p.get("id")
                oid = p.get("owner_id")
                if isinstance(pid, int) and isinstance(oid, int):
                    posts.append({
                        "owner_id": oid,
                        "post_id": pid,
                        "phrase": phrase,
                    })

        # Тащим комменты по каждому посту, пока не наберём total_limit
        # уникальных авторов или пока не пройдём все собранные посты.
        commenters: Dict[int, Dict[str, Any]] = {}
        comments_seen = 0

        for post in posts:
            if len(commenters) >= total_limit:
                break
            try:
                resp = await _call(client, "wall.getComments", {
                    "owner_id": post["owner_id"],
                    "post_id": post["post_id"],
                    "count": min(comments_per_post, 100),
                    "extended": 0,
                    "thread_items_count": 0,
                    "preview_length": 0,
                })
            except RuntimeError as e:
                # owner может быть приватным сообществом / пост удалён — это
                # нормально, идём к следующему.
                logger.debug(
                    f"wall.getComments(owner={post['owner_id']}, "
                    f"post={post['post_id']}) failed: {e}"
                )
                continue
            items = (resp or {}).get("items") or []
            comments_seen += len(items)
            for c in items:
                from_id = c.get("from_id")
                if not isinstance(from_id, int) or from_id <= 0:
                    continue  # отрицательный = пишет от имени паблика, отбрасываем
                text = (c.get("text") or "").strip()
                if not text or len(text) < 8:
                    continue  # «+1», «❤️», эмодзи без смысла
                if from_id in commenters:
                    continue
                commenters[from_id] = {
                    "comment_text": text[:300],
                    "post_url": f"https://vk.com/wall{post['owner_id']}_{post['post_id']}",
                    "source_phrase": post["phrase"],
                }
                if len(commenters) >= total_limit:
                    break

        # Резолвим всех найденных авторов комментов
        ids_list = list(commenters.keys())[:total_limit]
        users: List[Dict[str, Any]] = []
        for batch_start in range(0, len(ids_list), 1000):
            batch = ids_list[batch_start:batch_start + 1000]
            try:
                resp = await _call(client, "users.get", {
                    "user_ids": ",".join(map(str, batch)),
                    "fields": _VK_USER_FIELDS,
                })
            except RuntimeError as e:
                logger.warning(f"users.get(comment_batch={len(batch)}) failed: {e}")
                continue
            if isinstance(resp, list):
                for u in resp:
                    meta = commenters.get(u.get("id"))
                    if meta:
                        # Кладём триггер-коммент прямо в user-dict, чтобы
                        # vk_problem_search потом дотащил в карточку.
                        u["_triggering_comment"] = meta
                users.extend(resp)

    return {
        "users": users,
        "stats": {
            "phrases_used": len(phrases),
            "posts_seen": posts_seen,
            "comments_seen": comments_seen,
            "unique_commenters": len(commenters),
            "fetched": len(users),
        },
    }
