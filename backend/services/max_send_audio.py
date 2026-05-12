#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/services/max_send_audio.py
Отправка аудио (MP3) в MAX-чат через Platform API.

Pipeline (по docs dev.max.ru / dev.tamtam.chat):
  1. POST https://platform-api.max.ru/uploads?type=audio
     Authorization: <MAX_TOKEN>
     → {"url": "<upload_endpoint>"}
  2. POST <upload_endpoint>
     multipart/form-data: file binary
     → {"token": "<media_token>", ...}
  3. POST https://platform-api.max.ru/messages?chat_id=<CHAT_ID>
     Authorization: <MAX_TOKEN>
     Content-Type: application/json
     {"text": "<caption>",
      "attachments": [{"type": "audio", "payload": {"token": "<media_token>"}}]}

Используется из админ-эндпоинта /api/admin/max/send-audio (см. vk_routes.py),
где админ через UI на admin-analytics.html генерирует TTS и шлёт его
в произвольный MAX-чат.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

MAX_API_BASE = "https://platform-api.max.ru"
TIMEOUT_S = 30.0


async def send_audio_to_max(
    chat_id: int,
    audio_bytes: bytes,
    audio_filename: str = "fredi-voice.mp3",
    caption: Optional[str] = None,
) -> Dict[str, Any]:
    """Загружает MP3 в MAX-чат как audio-attachment.

    Raises RuntimeError при любом сбое MAX API — вызывающий код
    перехватывает и превращает в HTTP 502.
    """
    token = (os.environ.get("MAX_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("MAX_TOKEN не задан в env Render")
    if not audio_bytes:
        raise RuntimeError("audio_bytes пустой")
    if chat_id <= 0:
        raise RuntimeError(f"некорректный chat_id: {chat_id}")

    async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
        # --- Шаг 1: получить upload URL ---
        try:
            r1 = await client.post(
                f"{MAX_API_BASE}/uploads",
                params={"type": "audio"},
                headers={"Authorization": token},
            )
        except httpx.HTTPError as e:
            raise RuntimeError(f"MAX uploads request failed: {e}")
        if r1.status_code != 200:
            raise RuntimeError(
                f"MAX uploads init {r1.status_code}: {r1.text[:300]}"
            )
        upload_data = r1.json() if r1.text else {}
        upload_url = upload_data.get("url")
        if not upload_url:
            raise RuntimeError(f"MAX uploads: no url in response: {upload_data}")

        # --- Шаг 2: загрузить mp3 ---
        try:
            r2 = await client.post(
                upload_url,
                files={"data": (audio_filename, audio_bytes, "audio/mpeg")},
            )
        except httpx.HTTPError as e:
            raise RuntimeError(f"MAX upload request failed: {e}")
        if r2.status_code not in (200, 201):
            raise RuntimeError(
                f"MAX upload {r2.status_code}: {r2.text[:300]}"
            )
        upload_resp = r2.json() if r2.text else {}
        # token может лежать на верхнем уровне или внутри 'audio'/'file'
        media_token = (
            upload_resp.get("token")
            or (upload_resp.get("audio") or {}).get("token")
            or (upload_resp.get("file") or {}).get("token")
        )
        if not media_token:
            raise RuntimeError(f"MAX upload: no media token in {upload_resp}")

        # --- Шаг 3: отправить сообщение с attachment ---
        msg_payload: Dict[str, Any] = {
            "attachments": [
                {"type": "audio", "payload": {"token": media_token}},
            ],
        }
        cap = (caption or "").strip()
        if cap:
            msg_payload["text"] = cap[:1000]  # MAX limit на text в attachment-сообщении

        try:
            r3 = await client.post(
                f"{MAX_API_BASE}/messages",
                params={"chat_id": int(chat_id)},
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
                f"MAX messages.send {r3.status_code}: {r3.text[:300]}"
            )

        logger.info(
            f"MAX send-audio ok: chat_id={chat_id} bytes={len(audio_bytes)}"
        )
        msg_resp = r3.json() if r3.text else {}
        return {
            "success": True,
            "chat_id": int(chat_id),
            "audio_size": len(audio_bytes),
            "media_token_preview": str(media_token)[:24] + "…",
            "message": msg_resp.get("message") or msg_resp,
        }
