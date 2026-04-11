"""
bot_service.py — Telegram + Max bot webhook handlers.
Handles /start web_{user_id} for account linking.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
MAX_TOKEN = os.environ.get("MAX_TOKEN", "")
BACKEND_URL = os.environ.get("API_URL", "https://fredi-backend-flz2.onrender.com")


def register_bot_webhooks(app, db):

    @app.post("/api/telegram/webhook")
    async def telegram_webhook(request):
        try:
            body = await request.json()
            message = body.get("message", {})
            if not message:
                return {"ok": True}

            chat_id = str(message.get("chat", {}).get("id", ""))
            text = (message.get("text") or "").strip()
            from_user = message.get("from", {})
            username = from_user.get("username", "")
            first_name = from_user.get("first_name", "")

            if not chat_id or not text:
                return {"ok": True}

            if text.startswith("/start"):
                parts = text.split()
                if len(parts) >= 2 and parts[1].startswith("web_"):
                    web_user_id = parts[1].replace("web_", "")
                    try:
                        web_user_id_int = int(web_user_id)
                    except ValueError:
                        await _tg_send(chat_id, "Nevernaya ssylka privyazki.")
                        return {"ok": True}

                    async with db.get_connection() as conn:
                        await conn.execute(
                            "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                            "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                            web_user_id_int
                        )
                        await conn.execute("""
                            INSERT INTO fredi_messenger_links (user_id, platform, chat_id, username, linked_at, is_active)
                            VALUES ($1, 'telegram', $2, $3, NOW(), TRUE)
                            ON CONFLICT (user_id, platform) DO UPDATE SET
                                chat_id = $2, username = $3, linked_at = NOW(), is_active = TRUE
                        """, web_user_id_int, chat_id, username or first_name)

                    display_name = username or first_name or "friend"
                    await _tg_send(chat_id, f"Privet, {display_name}! Akkaunt uspeshno privyazan k Fredi.")
                    logger.info(f"Telegram linked: user {web_user_id} -> chat {chat_id}")
                else:
                    await _tg_send(chat_id, "Privet! Ya bot Fredi.\n\nChtoby privyazat' akkaunt, otkroyte Nastroyki v prilozhenii Fredi i nazhmite Svyazat' akkaunt.")

            return {"ok": True}
        except Exception as e:
            logger.error(f"Telegram webhook error: {e}")
            return {"ok": True}

    @app.post("/api/max/webhook")
    async def max_webhook(request):
        try:
            body = await request.json()
            update_type = body.get("update_type", "")
            message = body.get("message", {})

            if update_type == "message_created" or message:
                msg_body = message.get("body", {})
                text = (msg_body.get("text") or "").strip() if isinstance(msg_body, dict) else ""
                if not text:
                    text = (body.get("text") or "").strip()

                chat_id = str(message.get("recipient", {}).get("chat_id", "") or body.get("chat_id", ""))
                sender = message.get("sender", {})
                sender_name = sender.get("name", "")
                user_id_max = str(sender.get("user_id", ""))
                if not chat_id:
                    chat_id = user_id_max

                if not text:
                    return {"ok": True}

                if text.startswith("/start"):
                    parts = text.split()
                    if len(parts) >= 2 and parts[1].startswith("web_"):
                        web_user_id = parts[1].replace("web_", "")
                        try:
                            web_user_id_int = int(web_user_id)
                        except ValueError:
                            await _max_send(chat_id, "Nevernaya ssylka privyazki.")
                            return {"ok": True}

                        async with db.get_connection() as conn:
                            await conn.execute(
                                "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                                "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                                web_user_id_int
                            )
                            await conn.execute("""
                                INSERT INTO fredi_messenger_links (user_id, platform, chat_id, username, linked_at, is_active)
                                VALUES ($1, 'max', $2, $3, NOW(), TRUE)
                                ON CONFLICT (user_id, platform) DO UPDATE SET
                                    chat_id = $2, username = $3, linked_at = NOW(), is_active = TRUE
                            """, web_user_id_int, chat_id, sender_name)

                        display_name = sender_name or "friend"
                        await _max_send(chat_id, f"Privet, {display_name}! Akkaunt uspeshno privyazan k Fredi.")
                        logger.info(f"Max linked: user {web_user_id} -> chat {chat_id}")
                    else:
                        await _max_send(chat_id, "Privet! Ya bot Fredi.\n\nChtoby privyazat' akkaunt, otkroyte Nastroyki v prilozhenii Fredi.")

            return {"ok": True}
        except Exception as e:
            logger.error(f"Max webhook error: {e}")
            return {"ok": True}

    async def _tg_send(chat_id, text):
        if not TELEGRAM_TOKEN:
            return
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.post(
                    f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                    json={"chat_id": chat_id, "text": text}
                )
        except Exception as e:
            logger.error(f"Telegram send error: {e}")

    async def _max_send(chat_id, text):
        if not MAX_TOKEN:
            return
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.post(
                    "https://platform-api.max.ru/messages",
                    json={"chat_id": chat_id, "text": text},
                    headers={"Authorization": MAX_TOKEN}
                )
        except Exception as e:
            logger.error(f"Max send error: {e}")

    async def setup_bot_webhooks():
        webhook_base = BACKEND_URL.rstrip("/")
        logger.info(f"Bot webhook base URL: {webhook_base}")

        if TELEGRAM_TOKEN:
            try:
                url = f"{webhook_base}/api/telegram/webhook"
                logger.info(f"Setting Telegram webhook to: {url}")
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/setWebhook",
                        json={"url": url, "allowed_updates": ["message"]}
                    )
                    result = resp.json()
                    if result.get("ok"):
                        logger.info(f"Telegram webhook set OK")
                    else:
                        logger.error(f"Telegram webhook failed: {result}")
            except Exception as e:
                logger.error(f"Telegram webhook setup error: {e}")

        if MAX_TOKEN:
            try:
                url = f"{webhook_base}/api/max/webhook"
                logger.info(f"Setting Max webhook to: {url}")
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        "https://platform-api.max.ru/subscriptions",
                        json={"url": url, "update_types": ["message_created"]},
                        headers={"Authorization": MAX_TOKEN}
                    )
                    if resp.status_code in (200, 201):
                        logger.info(f"Max webhook set OK")
                    else:
                        logger.error(f"Max webhook failed: {resp.status_code} {resp.text[:200]}")
            except Exception as e:
                logger.error(f"Max webhook setup error: {e}")

    return setup_bot_webhooks
