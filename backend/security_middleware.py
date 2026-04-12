"""
security_middleware.py — Security hardening for FastAPI.
Import and call apply_security(app) after app creation in main.py.
"""

import logging
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Allowed origins for CORS
ALLOWED_ORIGINS = [
    "https://fredi-frontend.onrender.com",
    "https://meysternlp.ru",
    "https://www.meysternlp.ru",
    "https://dron939-sketch.github.io",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
]

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
    
    Call BEFORE other middleware. Example:
        from security_middleware import apply_security
        apply_security(app)
    """
    # Remove existing CORS middleware if any
    # (FastAPI adds it via app.add_middleware, we replace it)
    
    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)
    
    # Request size limit
    app.add_middleware(RequestSizeLimitMiddleware)
    
    # Strict CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
        max_age=3600,
    )
    
    logger.info(f"Security middleware applied. CORS origins: {len(ALLOWED_ORIGINS)}")


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
