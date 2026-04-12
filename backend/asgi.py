# asgi.py — ASGI entrypoint with security middleware
import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("=" * 60)
logger.info("LOADING ASGI APPLICATION")
logger.info("=" * 60)

try:
    logger.info("Importing main module...")
    from main import app
    logger.info("main module imported")

    # Apply security hardening
    logger.info("Applying security middleware...")
    from security_middleware import apply_security
    apply_security(app)
    logger.info("Security middleware applied")

    application = app

except Exception as e:
    logger.error(f"Failed to load application: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

logger.info("ASGI APPLICATION READY")
logger.info("=" * 60)
