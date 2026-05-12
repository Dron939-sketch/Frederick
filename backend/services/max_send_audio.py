#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/services/max_send_audio.py
Отправка аудио (MP3) в MAX-чат через Platform API.

Pipeline (по docs dev.max.ru / dev.tamtam.chat):
  1. GET https://platform-api.max.ru/uploads?type=audio
     (Authorization: <MAX_TOKEN>)
     → {"url": "<upload_endpoint>"}
  2. POST <upload_endpoint>
     multipart/form-data: file binary
     → {"token": "<media_token>", ...} (формат может варьироваться)
  3. POST https://platform-api.max.ru/messages?chat_id=<CHAT_ID>
     Authorization: <MAX_TOKEN>
     Content-Type: application/json
     {"text": "<caption>",
      "attachments": [{"type": "audio", "payload": {"token": "<media_token>"}}]}

Особенности:
  • MAX API не всегда возвращает JSON — при ошибке/CDN-прокси может
    прийти HTML. Поэтому везде используем _safe_json + поднимаем
    RuntimeError с понятным сообщением и обрезанным телом ответа
    для диагностики в Render logs.
  • Используется из admin-эндпоинта /api/admin/max/send-audio
    (см. vk_routes.py).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

MAX_API_BASE = "https://platform-api.max.ru"
TIMEOUT_S = 30.0


def _safe_json(r: httpx.Response) -> Dict[str, Any]:
    """Безопасный парсинг JSON-ответа MAX API.

    MAX может вернуть HTML/plain при сбое CDN/прокси. r.json() в этом
    случае падает с JSONDecodeError ('Expecting value: line 1 column 1').
    Возвращаем {} вместо исключения — вызывающий код проверит наличие
    ожидаемых полей и поднимет понятную ошибку с дампом r.text.
    """
    try:
        return r.json()
    except Exception:
        return {}


async def send_audio_to_max(
    chat_id: int,
    audio_bytes: bytes,
    audio_filename: str = "fredi-voice.mp3",
    caption: Optional[str] = None,
) -> Dict[str, Any]:
    """Загружает MP3 в MAX-чат как audio-attachment.

    Raises RuntimeError при любом сбое MAX API — вызывающий код
    перехватывает и превращает в HTTP 502 с понятным detail.message.
    """
    token = (os.environ.get("MAX_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("MAX_TOKEN не задан в env Render")
    if not audio_bytes:
        raise RuntimeError("audio_bytes пустой")
    if chat_id <= 0:
        raise RuntimeError(f"некорректный chat_id: {chat_id}")

    async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
        # --- Шаг 1: получить upload URL (GET по docs MAX) ---
        try:
            r1 = await client.get(
                f"{MAX_API_BASE}/uploads",
                params={"type": "audio", "access_token": token},
            )
        except httpx.HTTPError as e:
            raise RuntimeError(f"MAX uploads request failed: {e}")
        if r1.status_code != 200:
            raise RuntimeError(
                f"MAX uploads init HTTP {r1.status_code}: {r1.text[:300]}"
            )
        upload_data = _safe_json(r1)
        upload_url = upload_data.get("url")
        if not upload_url:
            raise RuntimeError(
                f"MAX uploads: no 'url' в ответе. "
                f"status={r1.status_code} body={r1.text[:300]!r}"
            )

        # --- Шаг 2: загрузить mp3 на полученный upload URL ---
        try:
            r2 = await client.post(
                upload_url,
                files={"data": (audio_filename, audio_bytes, "audio/mpeg")},
            )
        except httpx.HTTPError as e:
            raise RuntimeError(f"MAX upload request failed: {e}")
        if r2.status_code not in (200, 201):
            raise RuntimeError(
                f"MAX upload HTTP {r2.status_code}: {r2.text[:300]}"
            )
        upload_resp = _safe_json(r2)
        # token может лежать на верхнем уровне или внутри 'audio'/'file'
        media_token = (
            upload_resp.get("token")
            or (upload_resp.get("audio") or {}).get("token")
            or (upload_resp.get("file") or {}).get("token")
        )
        if not media_token:
            raise RuntimeError(
                f"MAX upload: no media token. "
                f"status={r2.status_code} body={r2.text[:400]!r}"
            )

        # --- Шаг 3: отправить сообщение с attachment ---
        msg_payload: Dict[str, Any] = {
            "attachments": [
                {"type": "audio", "payload": {"token": media_token}},
            ],
        }
        cap = (caption or "").strip()
        if cap:
            msg_payload["text"] = cap[:1000]

        try:
            r3 = await client.post(
                f"{MAX_API_BASE}/messages",
                params={"chat_id": int(chat_id), "access_token": token},
                headers={
                    "Authorization": token,
                    "Content-Type": "application/json",
                },
                json=msg_payload,
            )
        except httpx.HTTPError as e:
            raise RuntimeError(f"MAX messages.send request failed: {e}")
        if r3.status_code != 200:
            raise RuntimeError(
                f"MAX messages.send HTTP {r3.status_code}: {r3.text[:300]}"
            )

        msg_resp = _safe_json(r3)
        logger.info(
            f"MAX send-audio ok: chat_id={chat_id} bytes={len(audio_bytes)} "
            f"media_token={str(media_token)[:16]}…"
        )
        return {
            "success": True,
            "chat_id": int(chat_id),
            "audio_size": len(audio_bytes),
            "media_token_preview": str(media_token)[:24] + "…",
            "message": msg_resp.get("message") or msg_resp,
        }
