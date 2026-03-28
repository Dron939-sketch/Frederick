# asgi.py
"""
ASGI entrypoint для Daphne
FastAPI приложение запускается через Daphne
"""

from main import app

# Daphne будет использовать эту переменную
application = app
