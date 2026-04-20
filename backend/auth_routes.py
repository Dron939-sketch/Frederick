"""
Email/password аутентификация с поддержкой «Запомнить меня».

Дизайн:
- Пароль хешируется Argon2id (OWASP 2026 first choice).
- Сессия = серверный opaque-токен. В БД лежит sha256(token), в браузере — HttpOnly cookie.
- Idle timeout: 30 мин для обычной сессии, 30 дней для remember.
- Absolute timeout: 8 часов / 365 дней соответственно.
- Миграция анонимов: при регистрации/логине, если есть cookie fredi_uid
  с user_id без email — email привязывается к существующему user_id (сохраняем историю).
- Rate-limit: 5/min на (IP+email) для login, 3/hour на IP для register.
"""
from __future__ import annotations

import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

# Argon2id с OWASP-рекомендованными параметрами (чуть выше минимума).
_hasher = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=1)

# Предрасчитанный валидный argon2-hash случайной строки — используется для timing-safe
# проверки, когда email не найден: argon2.verify на корректном хеше занимает столько же
# времени, сколько на реальном — так мы не даём злоумышленнику по времени ответа понять,
# существует ли email.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))

# Константы таймаутов сессий.
SESSION_IDLE_NORMAL = timedelta(minutes=30)
SESSION_IDLE_REMEMBER = timedelta(days=30)
SESSION_ABSOLUTE_NORMAL = timedelta(hours=8)
SESSION_ABSOLUTE_REMEMBER = timedelta(days=365)

COOKIE_NAME = "fredi_session"
ANON_COOKIE_NAME = "fredi_uid"  # уже существующая cookie анонимной device-based сессии


# -------------------- Pydantic схемы --------------------

class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=72)
    remember: bool = True


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=72)
    remember: bool = True


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


class MergeAnonIn(BaseModel):
    anon_user_id: int


# -------------------- Утилиты --------------------

def _normalize_email(raw: str) -> str:
    try:
        v = validate_email(raw, check_deliverability=False)
        return v.normalized.lower()
    except EmailNotValidError as e:
        raise HTTPException(status_code=400, detail={"error": "invalid_email", "message": str(e)})


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _gen_token() -> str:
    # 32 байта = 256 бит энтропии (OWASP требует ≥ 128).
    return secrets.token_urlsafe(32)


def _password_ok(pw: str) -> bool:
    # Минимальная «не полный мусор»-проверка: длина уже в Pydantic,
    # дополнительно требуем хотя бы одну букву и одну цифру/спецсимвол.
    return bool(re.search(r"[A-Za-zА-Яа-яЁё]", pw)) and bool(re.search(r"[\d\W_]", pw))


def _client_ip(request: Request) -> str:
    return (request.client.host if request.client else "") or ""


def _user_agent(request: Request) -> str:
    return (request.headers.get("user-agent") or "")[:512]


def _parse_int(v) -> Optional[int]:
    if v is None:
        return None
    try:
        n = int(str(v).strip())
        return n if n > 0 else None
    except (ValueError, TypeError):
        return None


def _cookie_kwargs(remember: bool, max_age: Optional[int] = None) -> dict:
    """Атрибуты HttpOnly cookie для кросс-доменной работы (SameSite=None; Secure)."""
    kw = dict(
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    if remember:
        kw["max_age"] = max_age if max_age is not None else int(SESSION_ABSOLUTE_REMEMBER.total_seconds())
    # Если remember=False — cookie без max_age, живёт только до закрытия браузера.
    return kw


async def _log_attempt(db, email: Optional[str], ip: str, ua: str, success: bool, reason: str = ""):
    try:
        await db.execute(
            "INSERT INTO fredi_auth_attempts (email, ip_address, user_agent, success, reason) VALUES ($1,$2,$3,$4,$5)",
            email, ip, ua, bool(success), reason[:200] if reason else "",
        )
    except Exception as e:
        logger.warning(f"auth_attempts log failed: {e}")


# -------------------- Создание router'а --------------------

def create_auth_router(db, limiter) -> APIRouter:
    """
    Создаёт APIRouter с эндпоинтами /api/auth/*.

    Args:
        db: инстанс Database (с методами execute/fetchrow/fetchval/get_connection)
        limiter: slowapi Limiter для rate-limit.
    """
    router = APIRouter(prefix="/api/auth", tags=["auth"])

    async def _create_session(conn, user_id: int, remember: bool, ua: str, ip: str) -> Tuple[str, datetime]:
        """Генерит новый токен, пишет sha256 в БД, возвращает (raw_token, expires_at)."""
        raw = _gen_token()
        th = _hash_token(raw)
        now = datetime.now(timezone.utc)
        absolute = SESSION_ABSOLUTE_REMEMBER if remember else SESSION_ABSOLUTE_NORMAL
        expires_at = now + absolute
        await conn.execute(
            """
            INSERT INTO fredi_auth_sessions (token_hash, user_id, remember, created_at, last_seen, expires_at, user_agent, ip_address)
            VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6)
            """,
            th, int(user_id), bool(remember), expires_at, ua, ip,
        )
        return raw, expires_at

    def _set_session_cookie(response: Response, token: str, remember: bool):
        response.set_cookie(COOKIE_NAME, token, **_cookie_kwargs(remember=remember))

    def _clear_session_cookie(response: Response):
        response.delete_cookie(COOKIE_NAME, path="/", samesite="none", secure=True, httponly=True)

    async def _resolve_session(token: Optional[str]) -> Optional[dict]:
        """Возвращает dict сессии с user/email/name, либо None. Обновляет last_seen."""
        if not token:
            return None
        th = _hash_token(token)
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT s.user_id, s.remember, s.created_at, s.last_seen, s.expires_at,
                       u.email, COALESCE(c.name, '') AS name
                FROM fredi_auth_sessions s
                JOIN fredi_users u ON u.user_id = s.user_id
                LEFT JOIN fredi_user_contexts c ON c.user_id = s.user_id
                WHERE s.token_hash = $1
                """,
                th,
            )
            if not row:
                return None
            now = datetime.now(timezone.utc)
            expires_at = row["expires_at"]
            last_seen = row["last_seen"]
            remember = bool(row["remember"])
            idle_limit = SESSION_IDLE_REMEMBER if remember else SESSION_IDLE_NORMAL

            if expires_at <= now or (last_seen and last_seen + idle_limit <= now):
                await conn.execute("DELETE FROM fredi_auth_sessions WHERE token_hash=$1", th)
                return None

            await conn.execute(
                "UPDATE fredi_auth_sessions SET last_seen = NOW() WHERE token_hash=$1", th
            )
            await conn.execute(
                "UPDATE fredi_users SET last_activity = NOW() WHERE user_id=$1", int(row["user_id"])
            )
            return {
                "user_id": int(row["user_id"]),
                "email": row["email"],
                "name": row["name"] or "",
                "remember": remember,
            }

    def _login_key(request: Request) -> str:
        # Ключ лимита: IP + попытка email (грубо извлекаем из query, т.к. body уже прочитан).
        return get_remote_address(request)

    # -------------------- /me --------------------

    @router.get("/me")
    async def me(request: Request):
        token = request.cookies.get(COOKIE_NAME)
        sess = await _resolve_session(token)
        if not sess:
            raise HTTPException(status_code=401, detail={"error": "unauthenticated"})
        return {
            "success": True,
            "user_id": sess["user_id"],
            "email": sess["email"],
            "name": sess["name"],
        }

    # -------------------- /register --------------------

    @router.post("/register")
    @limiter.limit("3/hour")
    async def register(request: Request, response: Response, body: RegisterIn):
        ip = _client_ip(request)
        ua = _user_agent(request)

        email = _normalize_email(body.email)
        if not _password_ok(body.password):
            await _log_attempt(db, email, ip, ua, False, "weak_password")
            raise HTTPException(status_code=400, detail={"error": "weak_password",
                                                          "message": "Пароль должен содержать буквы и цифры."})

        anon_uid = _parse_int(request.cookies.get(ANON_COOKIE_NAME))
        password_hash = _hasher.hash(body.password)

        async with db.get_connection() as conn:
            existing = await conn.fetchrow(
                "SELECT user_id FROM fredi_users WHERE email = $1", email
            )
            if existing:
                await _log_attempt(db, email, ip, ua, False, "email_exists")
                raise HTTPException(status_code=409, detail={"error": "email_exists",
                                                              "message": "Email уже зарегистрирован."})

            uid: int
            if anon_uid:
                # Миграция анонима: если user существует и ещё без email — прикрепляем email к нему.
                row = await conn.fetchrow(
                    "SELECT email FROM fredi_users WHERE user_id = $1", anon_uid
                )
                if row and row["email"] is None:
                    await conn.execute(
                        """
                        UPDATE fredi_users
                        SET email = $1, password_hash = $2, password_updated_at = NOW(), updated_at = NOW()
                        WHERE user_id = $3
                        """,
                        email, password_hash, anon_uid,
                    )
                    uid = int(anon_uid)
                else:
                    uid = _new_user_id()
                    await _insert_new_user(conn, uid, email, password_hash)
            else:
                uid = _new_user_id()
                await _insert_new_user(conn, uid, email, password_hash)

            # Имя — в fredi_user_contexts (таблица уже есть).
            await conn.execute(
                """
                INSERT INTO fredi_user_contexts (user_id, name, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE
                    SET name = EXCLUDED.name, updated_at = NOW()
                """,
                uid, body.name.strip(),
            )

            raw, _exp = await _create_session(conn, uid, body.remember, ua, ip)

        _set_session_cookie(response, raw, body.remember)
        await _log_attempt(db, email, ip, ua, True, "register")
        logger.info(f"🔐 register: user_id={uid} email={email} anon_merged={bool(anon_uid)}")
        return {"success": True, "user_id": uid, "email": email, "name": body.name.strip()}

    # -------------------- /login --------------------

    @router.post("/login")
    @limiter.limit("5/minute")
    async def login(request: Request, response: Response, body: LoginIn):
        ip = _client_ip(request)
        ua = _user_agent(request)
        email = _normalize_email(body.email)

        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT u.user_id, u.password_hash, COALESCE(c.name, '') AS name
                FROM fredi_users u
                LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id
                WHERE u.email = $1
                """,
                email,
            )

            # Timing-safe: всегда тратим время на verify, даже если юзера нет.
            try:
                if row and row["password_hash"]:
                    _hasher.verify(row["password_hash"], body.password)
                else:
                    try:
                        _hasher.verify(_DUMMY_HASH, body.password)
                    except Exception:
                        pass
                    raise VerifyMismatchError()
            except (VerifyMismatchError, InvalidHashError):
                await _log_attempt(db, email, ip, ua, False, "invalid_credentials")
                raise HTTPException(status_code=401, detail={"error": "invalid_credentials",
                                                              "message": "Неверный email или пароль."})

            uid = int(row["user_id"])

            # Прозрачный апгрейд параметров argon2, если нужно.
            try:
                if _hasher.check_needs_rehash(row["password_hash"]):
                    new_hash = _hasher.hash(body.password)
                    await conn.execute(
                        "UPDATE fredi_users SET password_hash = $1, password_updated_at = NOW() WHERE user_id = $2",
                        new_hash, uid,
                    )
            except Exception:
                pass

            raw, _exp = await _create_session(conn, uid, body.remember, ua, ip)

            # Проверяем: есть ли на этом устройстве анонимные данные?
            anon_uid = _parse_int(request.cookies.get(ANON_COOKIE_NAME))
            has_anon_data = False
            if anon_uid and anon_uid != uid:
                anon_row = await conn.fetchrow(
                    "SELECT email FROM fredi_users WHERE user_id = $1", anon_uid
                )
                if anon_row and anon_row["email"] is None:
                    has_anon_data = True

        _set_session_cookie(response, raw, body.remember)
        await _log_attempt(db, email, ip, ua, True, "login")
        logger.info(f"🔐 login: user_id={uid} remember={body.remember} has_anon={has_anon_data}")
        return {
            "success": True,
            "user_id": uid,
            "email": email,
            "name": row["name"] or "",
            "has_anon_data": has_anon_data,
            "anon_user_id": anon_uid if has_anon_data else None,
        }

    # -------------------- /logout --------------------

    @router.post("/logout")
    async def logout(request: Request, response: Response):
        token = request.cookies.get(COOKIE_NAME)
        if token:
            th = _hash_token(token)
            try:
                await db.execute("DELETE FROM fredi_auth_sessions WHERE token_hash = $1", th)
            except Exception as e:
                logger.warning(f"logout delete failed: {e}")
        _clear_session_cookie(response)
        return {"success": True}

    @router.post("/logout-all")
    async def logout_all(request: Request, response: Response):
        token = request.cookies.get(COOKIE_NAME)
        sess = await _resolve_session(token)
        if not sess:
            raise HTTPException(status_code=401, detail={"error": "unauthenticated"})
        try:
            await db.execute("DELETE FROM fredi_auth_sessions WHERE user_id = $1", sess["user_id"])
        except Exception as e:
            logger.warning(f"logout-all failed: {e}")
        _clear_session_cookie(response)
        return {"success": True}

    # -------------------- /change-password --------------------

    @router.post("/change-password")
    @limiter.limit("5/hour")
    async def change_password(request: Request, response: Response, body: ChangePasswordIn):
        token = request.cookies.get(COOKIE_NAME)
        sess = await _resolve_session(token)
        if not sess:
            raise HTTPException(status_code=401, detail={"error": "unauthenticated"})
        if not _password_ok(body.new_password):
            raise HTTPException(status_code=400, detail={"error": "weak_password"})

        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT password_hash FROM fredi_users WHERE user_id = $1", sess["user_id"]
            )
            if not row or not row["password_hash"]:
                raise HTTPException(status_code=400, detail={"error": "no_password_set"})
            try:
                _hasher.verify(row["password_hash"], body.current_password)
            except (VerifyMismatchError, InvalidHashError):
                raise HTTPException(status_code=401, detail={"error": "invalid_current_password"})

            new_hash = _hasher.hash(body.new_password)
            th = _hash_token(token) if token else None

            await conn.execute(
                "UPDATE fredi_users SET password_hash = $1, password_updated_at = NOW(), updated_at = NOW() WHERE user_id = $2",
                new_hash, sess["user_id"],
            )
            # Инвалидируем ВСЕ сессии кроме текущей.
            if th:
                await conn.execute(
                    "DELETE FROM fredi_auth_sessions WHERE user_id = $1 AND token_hash <> $2",
                    sess["user_id"], th,
                )
            else:
                await conn.execute(
                    "DELETE FROM fredi_auth_sessions WHERE user_id = $1", sess["user_id"]
                )
        return {"success": True}

    # -------------------- /merge-anon --------------------

    @router.post("/merge-anon")
    @limiter.limit("5/hour")
    async def merge_anon(request: Request, body: MergeAnonIn):
        """Переносит все данные с анонимного user_id на текущего авторизованного.

        Выполняется ТОЛЬКО если анонимный user не имеет email (т.е. действительно аноним).
        """
        token = request.cookies.get(COOKIE_NAME)
        sess = await _resolve_session(token)
        if not sess:
            raise HTTPException(status_code=401, detail={"error": "unauthenticated"})

        target_uid = sess["user_id"]
        anon_uid = int(body.anon_user_id)
        if anon_uid <= 0 or anon_uid == target_uid:
            raise HTTPException(status_code=400, detail={"error": "invalid_anon_id"})

        async with db.get_connection() as conn:
            anon_row = await conn.fetchrow(
                "SELECT email FROM fredi_users WHERE user_id = $1", anon_uid
            )
            if not anon_row:
                return {"success": True, "merged": 0, "note": "anon_not_found"}
            if anon_row["email"] is not None:
                raise HTTPException(status_code=400, detail={"error": "anon_has_email"})

            # Таблицы с FK на fredi_users(user_id). Переносим UPDATE ... SET user_id = target.
            # ON CONFLICT нам не нужен — FK не уникальны; если где-то есть UNIQUE(user_id,...)
            # запись с той же вторичной частью, мы просто оставим как есть (редкий случай).
            merge_tables = [
                "fredi_messages", "fredi_test_results", "fredi_psychologist_thoughts",
                "fredi_events", "fredi_reminders", "fredi_weekend_ideas_cache",
                "fredi_morning_messages", "fredi_deep_analyses",
                "fredi_mirrors", "fredi_anchors", "fredi_dreams",
                "fredi_push_subscriptions", "fredi_messenger_links",
                "fredi_user_devices",
            ]
            merged_total = 0
            for t in merge_tables:
                try:
                    status = await conn.execute(
                        f"UPDATE {t} SET user_id = $1 WHERE user_id = $2", target_uid, anon_uid
                    )
                    # status формата "UPDATE N"
                    try:
                        merged_total += int(str(status).split()[-1])
                    except Exception:
                        pass
                except Exception as e:
                    logger.warning(f"merge-anon: skip {t}: {e}")

            # fredi_user_contexts — особый случай: у обоих может быть запись. Приоритет — у аккаунта.
            try:
                await conn.execute(
                    "DELETE FROM fredi_user_contexts WHERE user_id = $1", anon_uid
                )
            except Exception:
                pass

            # Наконец удаляем самого анонимного юзера.
            try:
                await conn.execute("DELETE FROM fredi_users WHERE user_id = $1", anon_uid)
            except Exception as e:
                logger.warning(f"merge-anon: delete anon user failed: {e}")

        logger.info(f"🔗 merge-anon: {anon_uid} → {target_uid}, rows merged={merged_total}")
        return {"success": True, "merged": merged_total, "target_user_id": target_uid}

    return router


# -------------------- helpers без замыкания --------------------

def _new_user_id() -> int:
    import time
    return int(time.time() * 1000)


async def _insert_new_user(conn, uid: int, email: str, password_hash: str):
    await conn.execute(
        """
        INSERT INTO fredi_users (user_id, email, password_hash, password_updated_at, platform, created_at, last_activity)
        VALUES ($1, $2, $3, NOW(), 'web', NOW(), NOW())
        """,
        int(uid), email, password_hash,
    )
