# -*- coding: utf-8 -*-
"""Приглашение второго человека в разговор (04.10.2026).

Проверяется механика без базы: метка, её снятие, когда подсказка
ставится и когда нет, и что main.py прокидывает флаги и снимает метку
перед записью в историю.

Запуск: python3 -m pytest -q backend/tests/test_invite.py
"""
import importlib.util
import pathlib

BACKEND = pathlib.Path(__file__).resolve().parents[1]
BASIC = (BACKEND / "modes" / "basic.py").read_text(encoding="utf-8")
MAIN = (BACKEND / "main.py").read_text(encoding="utf-8")


def _mod():
    spec = importlib.util.spec_from_file_location(
        "invite_probe", BACKEND / "modes" / "prompts" / "invite.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_mark_is_found_and_stripped():
    m = _mod()
    text = "Хорошо, ссылка появится под этим сообщением. [[INVITE:муж]]"
    assert m.find_mark(text) == "муж"
    assert m.strip_mark(text) == "Хорошо, ссылка появится под этим сообщением."
    assert m.find_mark("обычный ответ без метки") is None
    assert m.strip_mark("без метки") == "без метки"
    # пробелы и регистр внутри метки не ломают разбор
    assert m.find_mark("текст [[ invite : партнёр ]]") == "партнёр"


def test_offer_not_before_sixth_turn_and_not_twice():
    m = _mod()
    assert m.INVITE_MIN_TURNS == 6
    assert m.offer_block(5, False) == ""
    assert m.offer_block(6, False) != ""
    assert m.offer_block(12, True) == "", "ссылка уже выдана — не предлагать снова"
    assert m.offer_block(12, False, "муж") == "", "приглашённый сам никого не приглашает"


def test_offer_text_keeps_the_three_promises():
    b = _mod().offer_block(6, False)
    for must in ("одну половину", "отдельным", "не увидит", "[[INVITE:кто]]", "ОДИН раз"):
        assert must in b
    assert "насилие" in b and "кризисном" in b and "подростку" in b


def test_invitee_block_forbids_relaying_words():
    b = _mod().invitee_block("мама")
    assert "мама" in b
    assert "не передаёшь ничьи слова" in b
    assert "не пересказывай" in b.lower()


def test_basic_mode_wires_block_and_flags():
    assert "self._build_invite_block()" in BASIC
    assert "from .prompts.invite import offer_block, invitee_block" in BASIC
    assert '"invite_sent": bool(user_data.get("invite_sent"))' in BASIC


def test_main_passes_flags_and_strips_mark_before_saving():
    assert "from invite_routes import invite_flags" in MAIN
    assert "**invite_ctx," in MAIN
    i = MAIN.index("async def _finish_chat_turn(")
    j = MAIN.index('await message_repo.save(user_id, "assistant", response_text', i)
    assert "_strip_invite(response_text)" in MAIN[i:j], \
        "метка должна сниматься до записи ответа в историю"
    assert "register_invite_routes(app, db, limiter)" in MAIN
