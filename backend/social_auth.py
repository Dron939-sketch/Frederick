"""
social_auth.py — вход в один тап: Telegram, Яндекс ID, VK ID.

Зачем. Аккаунт заводят 2% людей (31 из 1569 за сентябрь 2026), и это
одна причина, по которой не работают пять вещей сразу: пиковое
предложение, память Фреди о разговоре, письма «как прошло», дашборд и
замок разбора — всё это открыто только владельцу аккаунта. Форма с
почтой и пин-кодом стоит ровно на том месте, где человек дописал самое
трудное, и он уходит. Кнопка «Войти через Telegram» — одно нажатие, без
полей, и для российской аудитории это привычнее почты.

Три провайдера, три механики:

- Telegram — Login Widget. Сам виджет живёт на фронте, сюда приходит его
  подпись: HMAC-SHA256 полей на ключе sha256(токен бота). Токен бота уже
  есть (TELEGRAM_TOKEN, им же работает бот), нужно только имя бота
  (TELEGRAM_BOT_USERNAME) и /setdomain в BotFather. Виджет запрашивает
  право писать человеку от имени бота — так вход через Telegram даёт
  ещё и канал возврата: строка в fredi_messenger_links, куда уже умеют
  писать утренние сообщения и письма о подписке.
- Яндекс ID — обычный OAuth 2.0 с client_secret.
- VK ID — OAuth 2.1 с PKCE и device_id.

Сессия ставится та же, что у /login: серверный токен, HttpOnly cookie.
Провайдер, у которого нет ключей в окружении, просто не показывается —
/providers отдаёт только настроенные, фронт рисует кнопки по списку.

Как человек находится или заводится, в порядке приоритета:
  1) уже входил этим провайдером — его аккаунт;
  2) провайдер дал почту и такая почта есть — привязываем к ней (почта
     у Яндекса и VK подтверждена ими; Telegram почту не даёт);
  3) на устройстве анонимный аккаунт без почты — поднимаем его до
     полного, чтобы история разговора не потерялась;
  4) иначе новый аккаунт.
"""

import hashlib
import hmac
import logging
import os
import secrets
import time
from typing import Any, Dict, Optional
from urllib.parse import urlencode, urlparse

logger = logging.getLogger(__name__)

# fastapi, httpx и pydantic импортируются там, где нужны: чистые функции
# выше маршрутов (подпись Telegram, безопасный return) тестируются
# в окружении без веб-стека.

APP_URL = (os.environ.get("APP_URL") or "https://meysternlp.ru/fredi").rstrip("/")
# Адрес бэкенда, на который провайдеры возвращают человека с кодом.
API_PUBLIC_URL = (os.environ.get("API_PUBLIC_URL") or "https://ffred-ddd989.amvera.io").rstrip("/")

TELEGRAM_TOKEN = (os.environ.get("TELEGRAM_TOKEN") or "").strip()
TELEGRAM_BOT_USERNAME = (os.environ.get("TELEGRAM_BOT_USERNAME") or "").strip().lstrip("@")
YANDEX_CLIENT_ID = (os.environ.get("YANDEX_OAUTH_CLIENT_ID") or "").strip()
YANDEX_CLIENT_SECRET = (os.environ.get("YANDEX_OAUTH_CLIENT_SECRET") or "").strip()
VK_APP_ID = (os.environ.get("VK_APP_ID") or "").strip()
VK_APP_SECRET = (os.environ.get("VK_APP_SECRET") or "").strip()

# Подпись виджета Telegram живёт сутки: старую можно было бы переиграть.
TELEGRAM_MAX_AGE_SEC = 24 * 3600
# Состояние OAuth (state + PKCE) — десять минут на то, чтобы нажать
# «Разрешить» у провайдера.
OAUTH_STATE_TTL_SEC = 10 * 60


# -------------------- чистые функции (тестируются без базы) --------------------

def providers_available() -> Dict[str, Dict[str, str]]:
    """Какие кнопки рисовать. Только те, у кого есть все ключи."""
    out: Dict[str, Dict[str, str]] = {}
    if TELEGRAM_TOKEN and TELEGRAM_BOT_USERNAME:
        out["telegram"] = {"bot": TELEGRAM_BOT_USERNAME}
    if YANDEX_CLIENT_ID and YANDEX_CLIENT_SECRET:
        out["yandex"] = {"client_id": YANDEX_CLIENT_ID}
    if VK_APP_ID:
        out["vk"] = {"app_id": VK_APP_ID}
    return out


def telegram_check(data: Dict[str, Any], bot_token: str, now: Optional[int] = None) -> bool:
    """Подпись Login Widget: HMAC-SHA256 строки «k=v\\n…» (все поля, кроме
    hash, по алфавиту) на ключе sha256(bot_token). Плюс свежесть auth_date."""
    if not bot_token or not isinstance(data, dict):
        return False
    received = str(data.get("hash") or "")
    if not received:
        return False
    pairs = []
    for k in sorted(data.keys()):
        if k == "hash" or data[k] is None:
            continue
        pairs.append(f"{k}={data[k]}")
    check_string = "\n".join(pairs)
    secret = hashlib.sha256(bot_token.encode("utf-8")).digest()
    expected = hmac.new(secret, check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        return False
    try:
        auth_date = int(data.get("auth_date") or 0)
    except (TypeError, ValueError):
        return False
    now = int(now if now is not None else time.time())
    return 0 < auth_date <= now + 60 and now - auth_date <= TELEGRAM_MAX_AGE_SEC


def safe_return_to(raw: Optional[str]) -> str:
    """Куда вернуть человека после провайдера. Только внутрь приложения:
    открытый редирект по параметру return — классическая дыра."""
    default = APP_URL + "/"
    if not raw:
        return default
    try:
        app = urlparse(APP_URL)
        u = urlparse(raw)
    except ValueError:
        return default
    if u.scheme != app.scheme or u.netloc != app.netloc:
        return default
    if not u.path.startswith(app.path or "/"):
        return default
    return raw


def with_query(url: str, **params) -> str:
    """Добавить параметры к URL, не ломая уже стоящие и якорь."""
    u = urlparse(url)
    q = u.query
    add = urlencode({k: v for k, v in params.items() if v is not None})
    q = (q + "&" + add) if (q and add) else (q or add)
    rebuilt = u._replace(query=q)
    return rebuilt.geturl()


def pkce_pair() -> tuple:
    """code_verifier и code_challenge (S256) для VK ID."""
    import base64
    verifier = secrets.token_urlsafe(64)[:96]
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


def oauth_redirect_uri(provider: str) -> str:
    return f"{API_PUBLIC_URL}/api/auth/oauth/{provider}/callback"


def yandex_authorize_url(state: str) -> str:
    return "https://oauth.yandex.ru/authorize?" + urlencode({
        "response_type": "code",
        "client_id": YANDEX_CLIENT_ID,
        "redirect_uri": oauth_redirect_uri("yandex"),
        "state": state,
        "force_confirm": "no",
    })


def vk_authorize_url(state: str, code_challenge: str) -> str:
    return "https://id.vk.com/authorize?" + urlencode({
        "response_type": "code",
        "client_id": VK_APP_ID,
        "redirect_uri": oauth_redirect_uri("vk"),
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "scope": "email",
    })


# -------------------- обмен кода на личность --------------------

async def fetch_yandex_identity(code: str) -> Dict[str, Any]:
    import httpx
    from fastapi import HTTPException
    async with httpx.AsyncClient(timeout=15) as client:
        tok = await client.post("https://oauth.yandex.ru/token", data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": YANDEX_CLIENT_ID,
            "client_secret": YANDEX_CLIENT_SECRET,
        })
        if tok.status_code != 200:
            raise HTTPException(status_code=502, detail={"error": "yandex_token",
                                                          "message": tok.text[:200]})
        access = (tok.json() or {}).get("access_token")
        if not access:
            raise HTTPException(status_code=502, detail={"error": "yandex_token_empty"})
        info = await client.get("https://login.yandex.ru/info?format=json",
                                headers={"Authorization": f"OAuth {access}"})
        if info.status_code != 200:
            raise HTTPException(status_code=502, detail={"error": "yandex_info"})
        j = info.json() or {}
    name = (j.get("first_name") or j.get("display_name") or j.get("real_name") or "").strip()
    return {
        "provider": "yandex",
        "provider_uid": str(j.get("id") or ""),
        "email": (j.get("default_email") or "").strip().lower() or None,
        "name": name[:100],
        "username": (j.get("login") or "")[:100],
    }


async def fetch_vk_identity(code: str, device_id: str, code_verifier: str, state: str) -> Dict[str, Any]:
    import httpx
    from fastapi import HTTPException
    async with httpx.AsyncClient(timeout=15) as client:
        form = {
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": code_verifier,
            "client_id": VK_APP_ID,
            "device_id": device_id,
            "redirect_uri": oauth_redirect_uri("vk"),
            "state": state,
        }
        if VK_APP_SECRET:
            form["client_secret"] = VK_APP_SECRET
        tok = await client.post("https://id.vk.com/oauth2/auth", data=form)
        if tok.status_code != 200:
            raise HTTPException(status_code=502, detail={"error": "vk_token",
                                                          "message": tok.text[:200]})
        tj = tok.json() or {}
        access = tj.get("access_token")
        if not access:
            raise HTTPException(status_code=502, detail={"error": "vk_token_empty",
                                                          "message": str(tj)[:200]})
        info = await client.post("https://id.vk.com/oauth2/user_info",
                                 data={"client_id": VK_APP_ID, "access_token": access})
        if info.status_code != 200:
            raise HTTPException(status_code=502, detail={"error": "vk_info"})
        u = (info.json() or {}).get("user") or {}
    return {
        "provider": "vk",
        "provider_uid": str(u.get("user_id") or tj.get("user_id") or ""),
        "email": (u.get("email") or "").strip().lower() or None,
        "name": (u.get("first_name") or "")[:100],
        "username": "",
    }


# -------------------- маршруты --------------------

def register_social_routes(router, db, limiter, deps: Dict[str, Any]):
    """Подключается изнутри create_auth_router: сессии, cookie, трекинг и
    заведение пользователя — те же функции, что у /login и /register."""
    from fastapi import HTTPException, Request, Response
    from fastapi.responses import RedirectResponse
    from pydantic import BaseModel

    class TelegramIn(BaseModel):
        id: int
        first_name: Optional[str] = None
        last_name: Optional[str] = None
        username: Optional[str] = None
        photo_url: Optional[str] = None
        auth_date: int
        hash: str
        source: Optional[str] = None

    create_session = deps["create_session"]
    set_session_cookie = deps["set_session_cookie"]
    track = deps["track"]
    log_attempt = deps["log_attempt"]
    new_user_id = deps["new_user_id"]
    insert_new_user = deps["insert_new_user"]
    hasher = deps["hasher"]
    anon_cookie = deps["anon_cookie_name"]
    client_ip = deps["client_ip"]
    user_agent = deps["user_agent"]
    parse_int = deps["parse_int"]

    async def _ensure_tables():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_social_identities (
                    provider TEXT NOT NULL,
                    provider_uid TEXT NOT NULL,
                    user_id BIGINT NOT NULL REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                    email TEXT,
                    name TEXT,
                    username TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    PRIMARY KEY (provider, provider_uid)
                )
            """)
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_social_identities_user "
                               "ON fredi_social_identities(user_id)")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_oauth_states (
                    state TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    code_verifier TEXT,
                    return_to TEXT,
                    anon_uid BIGINT,
                    source TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)

    _tables_ready = {"ok": False}

    async def _tables():
        if not _tables_ready["ok"]:
            try:
                await _ensure_tables()
                _tables_ready["ok"] = True
            except Exception as e:  # noqa: BLE001
                logger.error(f"social_auth: миграция не прошла: {e}")

    async def _find_or_create_user(conn, ident: Dict[str, Any], anon_uid: Optional[int]) -> tuple:
        provider, puid = ident["provider"], ident["provider_uid"]
        email, name = ident.get("email"), (ident.get("name") or "").strip()
        row = await conn.fetchrow(
            "SELECT user_id FROM fredi_social_identities WHERE provider=$1 AND provider_uid=$2",
            provider, puid,
        )
        if row:
            uid, flow = int(row["user_id"]), "existing"
            await conn.execute(
                "UPDATE fredi_social_identities SET last_login_at = NOW(), "
                "email = COALESCE($3, email), name = COALESCE(NULLIF($4,''), name) "
                "WHERE provider=$1 AND provider_uid=$2", provider, puid, email, name)
        else:
            uid = None
            flow = "new"
            if email:
                r = await conn.fetchrow("SELECT user_id FROM fredi_users WHERE email = $1", email)
                if r:
                    uid, flow = int(r["user_id"]), "linked_by_email"
            if uid is None and anon_uid:
                r = await conn.fetchrow("SELECT email FROM fredi_users WHERE user_id = $1", anon_uid)
                if r and r["email"] is None:
                    # Пин не выдаём: почты у Telegram нет, а без неё пин
                    # некуда прислать. Случайный хеш — чтобы колонка не
                    # была пустой, войти по нему нельзя.
                    await conn.execute(
                        """
                        UPDATE fredi_users
                        SET email = COALESCE($1, email), password_hash = $2,
                            password_updated_at = NOW(), registered_at = NOW(), updated_at = NOW()
                        WHERE user_id = $3
                        """,
                        email, hasher.hash(secrets.token_urlsafe(12)), anon_uid,
                    )
                    uid, flow = int(anon_uid), "anon_upgraded"
            if uid is None:
                uid = new_user_id()
                await insert_new_user(conn, uid, email, hasher.hash(secrets.token_urlsafe(12)))
            await conn.execute(
                """
                INSERT INTO fredi_social_identities (provider, provider_uid, user_id, email, name, username)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (provider, provider_uid) DO UPDATE SET last_login_at = NOW()
                """,
                provider, puid, uid, email, name or None, (ident.get("username") or None),
            )
        if name:
            # Имя от провайдера — только если Фреди ещё не знает своего.
            await conn.execute(
                """
                INSERT INTO fredi_user_contexts (user_id, name) VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE
                SET name = COALESCE(NULLIF(fredi_user_contexts.name, ''), EXCLUDED.name)
                """,
                uid, name,
            )
        return uid, flow

    async def _finish_login(request: Request, response: Response, ident: Dict[str, Any],
                            anon_uid: Optional[int], source: Optional[str]) -> Dict[str, Any]:
        ip, ua = client_ip(request), user_agent(request)
        async with db.get_connection() as conn:
            async with conn.transaction():
                uid, flow = await _find_or_create_user(conn, ident, anon_uid)
                raw, _exp = await create_session(conn, uid, True, ua, ip)
        set_session_cookie(response, raw, True)
        await log_attempt(db, ident.get("email"), ip, ua, True, f"social_{ident['provider']}")
        await track(uid, "auth_social_success", {
            "provider": ident["provider"], "flow": flow,
            "anon_merged": flow == "anon_upgraded", "source": source or "",
        })
        logger.warning(f"🔐 social login: provider={ident['provider']} user_id={uid} flow={flow}")
        return {"success": True, "user_id": uid, "email": ident.get("email"),
                "name": ident.get("name") or "", "provider": ident["provider"], "flow": flow}

    @router.get("/providers")
    async def providers():
        return {"providers": providers_available()}

    @router.post("/telegram")
    @limiter.limit("10/minute")
    async def telegram_login(request: Request, response: Response, body: TelegramIn):
        await _tables()
        if not TELEGRAM_TOKEN:
            raise HTTPException(status_code=503, detail={"error": "telegram_disabled"})
        data = body.model_dump(exclude={"source"})
        if not telegram_check(data, TELEGRAM_TOKEN):
            await log_attempt(db, None, client_ip(request), user_agent(request), False, "telegram_bad_hash")
            raise HTTPException(status_code=401, detail={"error": "bad_signature",
                                                          "message": "Подпись Telegram не сошлась."})
        ident = {
            "provider": "telegram",
            "provider_uid": str(body.id),
            "email": None,
            "name": (body.first_name or "").strip()[:100],
            "username": (body.username or "")[:100],
        }
        anon_uid = parse_int(request.cookies.get(anon_cookie))
        result = await _finish_login(request, response, ident, anon_uid, body.source)
        # Виджет просил право писать от имени бота — значит, есть канал
        # возврата. Та же строка, что ставит бот при /start web_<id>.
        try:
            async with db.get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO fredi_messenger_links (user_id, platform, chat_id, username, linked_at, is_active)
                    VALUES ($1, 'telegram', $2, $3, NOW(), TRUE)
                    ON CONFLICT (user_id, platform) DO UPDATE SET
                        chat_id = $2, username = $3, linked_at = NOW(), is_active = TRUE
                    """,
                    int(result["user_id"]), str(body.id), body.username or body.first_name,
                )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"social_auth: привязка Telegram-чата не записалась: {e}")
        return result

    @router.get("/oauth/{provider}/start")
    @limiter.limit("20/minute")
    async def oauth_start(request: Request, provider: str, ret: Optional[str] = None,
                          source: Optional[str] = None):
        await _tables()
        avail = providers_available()
        if provider not in ("yandex", "vk") or provider not in avail:
            raise HTTPException(status_code=404, detail={"error": "provider_not_configured"})
        state = secrets.token_urlsafe(32)
        verifier = challenge = None
        if provider == "vk":
            verifier, challenge = pkce_pair()
        anon_uid = parse_int(request.cookies.get(anon_cookie))
        async with db.get_connection() as conn:
            await conn.execute(
                "DELETE FROM fredi_oauth_states WHERE created_at < NOW() - INTERVAL '1 hour'")
            await conn.execute(
                "INSERT INTO fredi_oauth_states (state, provider, code_verifier, return_to, anon_uid, source) "
                "VALUES ($1, $2, $3, $4, $5, $6)",
                state, provider, verifier, safe_return_to(ret), anon_uid, (source or "")[:40],
            )
        url = yandex_authorize_url(state) if provider == "yandex" else vk_authorize_url(state, challenge)
        return RedirectResponse(url, status_code=302)

    @router.get("/oauth/{provider}/callback")
    async def oauth_callback(request: Request, provider: str, code: Optional[str] = None,
                             state: Optional[str] = None, device_id: Optional[str] = None,
                             error: Optional[str] = None):
        await _tables()
        async with db.get_connection() as conn:
            st = await conn.fetchrow(
                "DELETE FROM fredi_oauth_states WHERE state = $1 AND provider = $2 "
                "AND created_at > NOW() - make_interval(secs => $3) RETURNING *",
                state or "", provider, OAUTH_STATE_TTL_SEC,
            )
        return_to = safe_return_to(st["return_to"] if st else None)
        if not st:
            return RedirectResponse(with_query(return_to, auth_error="state"), status_code=302)
        if error or not code:
            return RedirectResponse(with_query(return_to, auth_error=error or "no_code"), status_code=302)
        try:
            if provider == "yandex":
                ident = await fetch_yandex_identity(code)
            elif provider == "vk":
                ident = await fetch_vk_identity(code, device_id or "", st["code_verifier"] or "", state or "")
            else:
                raise HTTPException(status_code=404, detail={"error": "provider_not_configured"})
        except HTTPException as e:
            logger.error(f"social_auth: {provider} обмен кода не удался: {e.detail}")
            return RedirectResponse(with_query(return_to, auth_error=f"{provider}_exchange"), status_code=302)
        except Exception as e:  # noqa: BLE001
            logger.error(f"social_auth: {provider}: {e}")
            return RedirectResponse(with_query(return_to, auth_error=f"{provider}_network"), status_code=302)
        if not ident.get("provider_uid"):
            return RedirectResponse(with_query(return_to, auth_error=f"{provider}_no_id"), status_code=302)

        resp = RedirectResponse(with_query(return_to, auth="ok", provider=provider), status_code=302)
        await _finish_login(request, resp, ident, st["anon_uid"], st["source"])
        return resp

    return router
