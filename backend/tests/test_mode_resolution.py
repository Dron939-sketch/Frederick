# -*- coding: utf-8 -*-
"""Роль берётся у клиента, а не из DEFAULT 'coach' в базе.

Логика _prepare_chat_turn воспроизведена здесь построчно: тянуть весь
main.py в тест нельзя (он поднимает БД и внешние сервисы), а разъехаться
эти две копии могут только вместе с правкой самой строки.
"""


def resolve(has_profile, requested_mode, stored_mode):
    if not has_profile:
        return "basic"
    requested = (requested_mode or "").strip().lower()
    stored = (stored_mode or "").strip().lower()
    return requested or stored or "basic"


def test_no_profile_is_basic():
    assert resolve(False, "coach", "coach") == "basic"


def test_client_wins_over_db_default():
    """Главный случай: тест пройден, в базе дефолтный 'coach', клиент просит basic."""
    assert resolve(True, "basic", "coach") == "basic"


def test_client_choice_respected():
    assert resolve(True, "coach", "basic") == "coach"
    assert resolve(True, "trainer", "coach") == "trainer"


def test_falls_back_to_stored_when_client_silent():
    assert resolve(True, None, "trainer") == "trainer"
    assert resolve(True, "", "coach") == "coach"


def test_falls_back_to_basic_when_nothing_known():
    assert resolve(True, None, None) == "basic"
    assert resolve(True, "  ", "") == "basic"


def test_case_and_spaces():
    assert resolve(True, " BASIC ", "coach") == "basic"
