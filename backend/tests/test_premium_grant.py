"""Ручная выдача премиума /api/analytics/premium-grant.

Владелец 20.10.2026 попросил кнопку в админке, чтобы дарить подписку без
оплаты. Ручка меняет доступ к платному, поэтому три вещи обязательны:
токен админа до любой работы с базой, подарок без автопродления (иначе
ночной тик попытается списать деньги с чужой карты) и снятие только
подаренной подписки — оплаченную ручка трогать не должна.
"""
import pathlib

SRC = (pathlib.Path(__file__).resolve().parents[1] / "analytics_routes.py").read_text(encoding="utf-8")


def _body() -> str:
    i = SRC.index('@app.post("/api/analytics/premium-grant")')
    j = SRC.index("\n    @app.", i + 1)
    return SRC[i:j]


def test_admin_token_checked_first():
    b = _body()
    assert "_check_admin(x_admin_token)" in b
    assert b.index("_check_admin(") < b.index("db.get_connection()")


def test_gift_never_auto_renews():
    b = _body()
    ins = b[b.index("INSERT INTO fredi_subscriptions"):b.index("ON CONFLICT")]
    assert "FALSE, 'gift'" in ins
    upd = b[b.index("ON CONFLICT"):b.index('""", user_id, days)')]
    # продление подарком не включает автосписание у того, кто его выключил
    assert "auto_renew = TRUE" not in upd


def test_revoke_touches_only_gifts():
    b = _body()
    rv = b[b.index("if revoke:"):b.index("else:", b.index("if revoke:"))]
    assert "plan = 'gift'" in rv


def test_days_are_bounded():
    assert "1 <= days <= 3650" in _body()


def test_email_lookup_covers_social_logins():
    # Вход через Яндекс, VK, Google: почта только в fredi_social_identities
    b = _body()
    assert "fredi_social_identities" in b
    assert "User ID" in b, "ошибка должна подсказать, где взять ID"
