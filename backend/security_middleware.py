"""
security_middleware.py — Security hardening for FastAPI.
Import and call apply_security(app) after app creation in main.py.
"""

import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Max request body size (5MB)
MAX_BODY_SIZE = 5 * 1024 * 1024

# Max prompt/message length
MAX_MESSAGE_LENGTH = 10000


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests with body larger than MAX_BODY_SIZE."""
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get('content-length')
        if content_length and int(content_length) > MAX_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={"error": "Request body too large"}
            )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response


def apply_security(app):
    """Apply security middleware to FastAPI app.

    Call AFTER main.py's CORSMiddleware is added (we don't touch CORS here —
    main.py owns CORS as single source of truth с allow_credentials=True для
    cookie-based session). Раньше тут добавлялся второй CORSMiddleware с
    allow_credentials=False, который в Starlette LIFO-порядке обрабатывался
    ПЕРВЫМ и перебивал ACAC из main.py → весь auth / cookies / messages
    падал на CORS preflight на проде.

    Сейчас apply_security вешает только security headers + size limit.
    """
    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # Request size limit
    app.add_middleware(RequestSizeLimitMiddleware)

    logger.info("Security middleware applied (headers + size limit; CORS owned by main.py)")


def validate_message(text, max_length=MAX_MESSAGE_LENGTH):
    """Validate and truncate user message text."""
    if not text or not isinstance(text, str):
        return ''
    return text.strip()[:max_length]


def validate_user_id(user_id):
    """Validate user_id is a reasonable integer."""
    try:
        uid = int(user_id)
        if uid < 1 or uid > 10**15:
            return None
        return uid
    except (ValueError, TypeError, OverflowError):
        return None
