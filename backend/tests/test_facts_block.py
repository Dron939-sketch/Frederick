"""Сроки и чужие мысли в ответах Фреди — только то, что есть на самом деле.

Выгрузка 26–28.09.2026: в разговоре длиной 18 минут Фреди сказал
«ты уже второй день», «три дня назад» и «уже неделю»; там же выдавал
догадку о мыслях коллеги за факт и советовал смотреть, когда тот онлайн.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASIC = (ROOT / "modes" / "basic.py").read_text(encoding="utf-8")
MAIN = (ROOT / "main.py").read_text(encoding="utf-8")


def _func(src, name):
    i = src.index(f"def {name}(")
    j = src.find("\n    def ", i + 1)
    return src[i:j if j > 0 else len(src)]


def _facts_block(first_seen_days):
    """Исполняет _build_facts_block на подставном self — без импорта
    всего BasicMode с его зависимостями."""
    body = _func(BASIC, "_build_facts_block")
    src = "import textwrap\n" + re.sub(r"^    ", "", body, flags=re.M)
    ns = {}
    exec(src, ns)

    class _Self:
        user_data = {} if first_seen_days is None else {"first_seen_days": first_seen_days}

    return ns["_build_facts_block"](_Self())


def test_facts_block_wired_into_prompt():
    assert "parts.append(self._build_facts_block())" in BASIC


def test_first_day_says_today():
    text = _facts_block(0)
    assert "впервые написал сегодня" in text
    assert "второй день" in text  # как пример запрещённого срока


def test_older_user_gets_real_days():
    assert "впервые написал 5 дн. назад" in _facts_block(5)
    assert "впервые написал вчера" in _facts_block(1)


def test_unknown_history_claims_nothing():
    text = _facts_block(None)
    assert "впервые написал" not in text
    assert "Сроки" in text


def test_third_party_and_surveillance_rules():
    text = _facts_block(0)
    assert "не факт" in text
    assert "онлайн" in text and "Не советуй следить" in text


def test_session_meta_computes_first_seen_days():
    assert "AS first_seen" in MAIN
    assert 'meta["first_seen_days"] = _days_since_msk(row["first_seen"])' in MAIN


def test_days_since_msk_calendar():
    from datetime import datetime, timedelta, timezone
    i = MAIN.index("def _days_since_msk(")
    j = MAIN.index("\nasync def _session_meta", i)
    ns = {"datetime": datetime, "timedelta": timedelta, "timezone": timezone}
    exec(MAIN[i:j], ns)
    f = ns["_days_since_msk"]
    now = datetime.now(timezone.utc)
    assert f(None) == 0
    assert f(now) == 0
    assert f(now - timedelta(days=3)) == 3
    assert f((now - timedelta(days=2)).replace(tzinfo=None)) == 2
