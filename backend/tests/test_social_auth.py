# -*- coding: utf-8 -*-
"""Вход в один тап: Telegram, Яндекс ID, VK ID.

Проверяется то, в чём можно ошибиться молча и дорого: подпись виджета
Telegram (подделанный вход = чужой аккаунт), открытый редирект через
параметр return, и то, что провайдер без ключей не обещается фронту.
Обмен кода у Яндекса и VK ходит в сеть, его здесь нет.
"""
import hashlib
import hmac
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("TELEGRAM_TOKEN", "")
import social_auth as sa  # noqa: E402


def _sign(data: dict, token: str) -> dict:
    check = "\n".join(f"{k}={data[k]}" for k in sorted(data) if k != "hash")
    secret = hashlib.sha256(token.encode()).digest()
    out = dict(data)
    out["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return out


TOKEN = "123456:test-bot-token"


def test_telegram_signature_accepts_fresh_valid_payload():
    now = int(time.time())
    data = _sign({"id": 42, "first_name": "Аня", "username": "anya", "auth_date": now}, TOKEN)
    assert sa.telegram_check(data, TOKEN, now=now)


def test_telegram_signature_rejects_tampered_field():
    now = int(time.time())
    data = _sign({"id": 42, "first_name": "Аня", "auth_date": now}, TOKEN)
    data["id"] = 43  # подменили пользователя, подпись осталась от 42
    assert not sa.telegram_check(data, TOKEN, now=now)


def test_telegram_signature_rejects_wrong_bot_token():
    now = int(time.time())
    data = _sign({"id": 42, "auth_date": now}, "другой:токен")
    assert not sa.telegram_check(data, TOKEN, now=now)


def test_telegram_signature_expires_after_a_day():
    """Старую подпись можно было бы переиграть — сутки и хватит."""
    now = int(time.time())
    data = _sign({"id": 42, "auth_date": now - sa.TELEGRAM_MAX_AGE_SEC - 5}, TOKEN)
    assert not sa.telegram_check(data, TOKEN, now=now)


def test_telegram_signature_ignores_none_fields_like_the_widget_does():
    """Виджет не шлёт отсутствующие поля; pydantic отдаёт их как None.
    Подпись должна сходиться с тем, что подписал Telegram, — без них."""
    now = int(time.time())
    signed = _sign({"id": 7, "first_name": "Пётр", "auth_date": now}, TOKEN)
    signed["last_name"] = None
    signed["username"] = None
    signed["photo_url"] = None
    assert sa.telegram_check(signed, TOKEN, now=now)


def test_telegram_check_without_token_never_passes():
    now = int(time.time())
    data = _sign({"id": 42, "auth_date": now}, TOKEN)
    assert not sa.telegram_check(data, "", now=now)


def test_return_to_stays_inside_the_app(monkeypatch):
    monkeypatch.setattr(sa, "APP_URL", "https://meysternlp.ru/fredi")
    assert sa.safe_return_to("https://meysternlp.ru/fredi/?m=test") == "https://meysternlp.ru/fredi/?m=test"
    # Чужой хост, чужая схема, соседний путь — всё на главную приложения.
    assert sa.safe_return_to("https://evil.example/fredi/") == "https://meysternlp.ru/fredi/"
    assert sa.safe_return_to("http://meysternlp.ru/fredi/") == "https://meysternlp.ru/fredi/"
    assert sa.safe_return_to("https://meysternlp.ru/blog/") == "https://meysternlp.ru/fredi/"
    assert sa.safe_return_to(None) == "https://meysternlp.ru/fredi/"
    assert sa.safe_return_to("javascript:alert(1)") == "https://meysternlp.ru/fredi/"


def test_with_query_keeps_existing_params_and_hash():
    assert sa.with_query("https://meysternlp.ru/fredi/?m=test#x", auth="ok", provider="vk") == \
        "https://meysternlp.ru/fredi/?m=test&auth=ok&provider=vk#x"
    assert sa.with_query("https://meysternlp.ru/fredi/", auth_error="state") == \
        "https://meysternlp.ru/fredi/?auth_error=state"


def test_providers_only_when_fully_configured(monkeypatch):
    monkeypatch.setattr(sa, "TELEGRAM_TOKEN", "t")
    monkeypatch.setattr(sa, "TELEGRAM_BOT_USERNAME", "")
    monkeypatch.setattr(sa, "YANDEX_CLIENT_ID", "id")
    monkeypatch.setattr(sa, "YANDEX_CLIENT_SECRET", "")
    monkeypatch.setattr(sa, "VK_APP_ID", "")
    assert sa.providers_available() == {}, "полключей — не провайдер: кнопка вела бы в ошибку"

    monkeypatch.setattr(sa, "TELEGRAM_BOT_USERNAME", "fredi_bot")
    monkeypatch.setattr(sa, "YANDEX_CLIENT_SECRET", "s")
    monkeypatch.setattr(sa, "VK_APP_ID", "99")
    p = sa.providers_available()
    assert p["telegram"] == {"bot": "fredi_bot"}
    assert p["yandex"] == {"client_id": "id"}
    assert p["vk"] == {"app_id": "99"}
    assert "secret" not in str(p).lower(), "секреты на фронт не уходят"


def test_pkce_pair_is_s256_of_verifier():
    import base64
    v, c = sa.pkce_pair()
    assert 43 <= len(v) <= 128
    expect = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).decode().rstrip("=")
    assert c == expect


def test_oauth_urls_point_back_to_our_callback(monkeypatch):
    monkeypatch.setattr(sa, "API_PUBLIC_URL", "https://api.example")
    monkeypatch.setattr(sa, "YANDEX_CLIENT_ID", "ya")
    monkeypatch.setattr(sa, "VK_APP_ID", "vk")
    y = sa.yandex_authorize_url("st")
    v = sa.vk_authorize_url("st", "ch")
    assert y.startswith("https://oauth.yandex.ru/authorize?")
    assert "redirect_uri=https%3A%2F%2Fapi.example%2Fapi%2Fauth%2Foauth%2Fyandex%2Fcallback" in y
    assert v.startswith("https://id.vk.com/authorize?")
    assert "code_challenge_method=S256" in v and "code_challenge=ch" in v
    assert "redirect_uri=https%3A%2F%2Fapi.example%2Fapi%2Fauth%2Foauth%2Fvk%2Fcallback" in v


def test_auth_router_wires_social_routes():
    """Маршруты подключаются изнутри create_auth_router — с теми же
    сессиями и cookie, что у /login. Отдельный роутер дал бы второй
    аккаунт вместо того же."""
    src = open(os.path.join(os.path.dirname(__file__), "..", "auth_routes.py"), encoding="utf-8").read()
    assert "register_social_routes(router, db, limiter" in src
    for key in ("create_session", "set_session_cookie", "insert_new_user", "anon_cookie_name"):
        assert f'"{key}"' in src


def test_env_keys_accept_common_aliases(monkeypatch):
    """26.09.2026: ключи VK ID лежали в окружении под другим именем, и
    /providers молчал. Каждый ключ читается по нескольким именам."""
    for n in sa.ENV_ALIASES["VK_APP_ID"]:
        monkeypatch.delenv(n, raising=False)
    assert sa.env_first(*sa.ENV_ALIASES["VK_APP_ID"]) == ""
    monkeypatch.setenv("VK_ID_CLIENT_ID", " 52011 ")
    assert sa.env_first(*sa.ENV_ALIASES["VK_APP_ID"]) == "52011"
    monkeypatch.setenv("VK_APP_ID", "1")
    assert sa.env_first(*sa.ENV_ALIASES["VK_APP_ID"]) == "1", "каноническое имя побеждает"
    assert "VK_APP_ID" == sa.ENV_ALIASES["VK_APP_ID"][0]
    assert "YANDEX_OAUTH_CLIENT_ID" == sa.ENV_ALIASES["YANDEX_CLIENT_ID"][0]


def test_env_diag_names_only(monkeypatch):
    monkeypatch.setenv("VK_ID_CLIENT_ID", "secret-value-123")
    d = sa.env_diag()
    assert "VK_ID_CLIENT_ID" in d["env_names_present"]
    assert "secret-value-123" not in str(d), "значения наружу не уходят"
    assert set(d["configured"]) == {"TELEGRAM_TOKEN", "TELEGRAM_BOT_USERNAME", "YANDEX_CLIENT_ID",
                                    "YANDEX_CLIENT_SECRET", "VK_APP_ID", "VK_APP_SECRET"}
    src = open(os.path.join(os.path.dirname(__file__), "..", "social_auth.py"), encoding="utf-8").read()
    i = src.index('"/providers/diag"')
    assert "ADMIN_TOKEN" in src[i:i + 700] and "status_code=401" in src[i:i + 700]


def test_telegram_button_waits_for_setdomain():
    """Виджет Telegram без /setdomain рисует «Bot domain invalid» —
    кнопку с таким виджетом показывать нельзя."""
    assert sa.telegram_widget_verdict(200, "<html><script>...</script></html>") is True
    assert sa.telegram_widget_verdict(200, "Bot domain invalid") is False
    assert sa.telegram_widget_verdict(500, "") is False
    assert sa.DEFAULT_TELEGRAM_BOT == "Frederick777bot"
    src = open(os.path.join(os.path.dirname(__file__), "..", "social_auth.py"), encoding="utf-8").read()
    i = src.index('@router.get("/providers")')
    assert "telegram_widget_ready" in src[i:i + 400], "список провайдеров фильтрует Telegram по привязке домена"
    assert sa.app_origin().startswith("https://")
