"""Ручка /api/admin/users-premium закрыта X-Admin-Token.

До 28.09.2026 она отвечала без токена: при исправном запросе отдала бы
любому почты и статусы подписок последних 30 пользователей.
"""
import pathlib
import re

SRC = (pathlib.Path(__file__).resolve().parents[1] / "payment_routes.py").read_text(encoding="utf-8")


def _handler_body() -> str:
    i = SRC.index('@app.get("/api/admin/users-premium")')
    j = SRC.index("\n    @app.", i + 1) if "\n    @app." in SRC[i + 1:] else len(SRC)
    return SRC[i:j]


def test_users_premium_checks_admin_token():
    body = _handler_body()
    assert "_check_admin(" in body, "ручка с почтами пользователей должна требовать X-Admin-Token"


def test_admin_check_runs_before_try():
    body = _handler_body()
    # Проверка до try: иначе HTTPException 401 глотает except Exception
    # и наружу уходит «internal error» вместо отказа.
    assert body.index("_check_admin(") < body.index("try:")
