# asgi.py
import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("=" * 60)
logger.info("🚀 LOADING ASGI APPLICATION")
logger.info("=" * 60)

try:
    logger.info("📦 Importing main module...")
    from main import app
    logger.info("✅ main module imported successfully")
    
    logger.info("📦 Creating application instance...")
    application = app
    logger.info(f"✅ Application created: {application}")
    
except Exception as e:
    logger.error(f"❌ Failed to load application: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

logger.info("=" * 60)
logger.info("✅ ASGI APPLICATION READY")
logger.info("=" * 60)
