# -*- coding: utf-8 -*-
"""Коуч и тренер: три бесплатных ответа, четвёртый — текст про подписку.

Решение владельца 12.09.2026. Проверяем счётчик по fredi_messages (замок в
историю пишется под тем же режимом, но в счёт не идёт), правило замка и
подмену режима, которая не зовёт модель.

Запуск: python3 backend/tests/test_premium_gate.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import premium_gate as pg  # noqa: E402


class FakeDB:
    def __init__(self, n=0, fail=False):
        self.n, self.fail, self.calls = n, fail, []

    async def fetchrow(self, sql, *args):
        self.calls.append((" ".join(sql.split()), args))
        if self.fail:
            raise RuntimeError("db down")
        return {"n": self.n}


def test_lock_rule():
    assert not pg.should_lock("coach", False, 0)
    assert not pg.should_lock("coach", False, 2)
    assert pg.should_lock("coach", False, 3)
    assert pg.should_lock("trainer", False, 7)
    assert not pg.should_lock("coach", True, 100), "подписчика замок не касается"
    assert not pg.should_lock("psychologist", False, 100), "психолог живёт по старым правилам"
    assert not pg.should_lock("basic", False, 100)


def test_lock_text_is_recognisable_and_names_the_mode():
    t = pg.lock_text("coach")
    assert pg.is_lock_text(t)
    assert "Коуч" in t and "290" in t and "990" in t
    assert "Тренер" in pg.lock_text("trainer")
    assert not pg.is_lock_text("Стоп. Ты гадаешь о чувствах другого человека")
    assert not pg.is_lock_text("")


def test_counter_query_excludes_lock_replies_and_other_modes():
    db = FakeDB(n=2)
    used = asyncio.run(pg.free_answers_used(db, 7))
    assert used == 2
    sql, args = db.calls[0]
    assert "role = 'assistant'" in sql
    assert "metadata->>'mode'" in sql
    assert "content NOT LIKE $3" in sql
    assert args[0] == 7 and set(args[1]) == set(pg.LOCK_MODES) and args[2] == pg.LOCK_PREFIX + "%"


def test_counter_never_locks_on_db_failure():
    assert asyncio.run(pg.free_answers_used(FakeDB(fail=True), 7)) == 0


def test_locked_mode_answers_without_model():
    m = pg.LockedMode("trainer")

    async def collect():
        return [c async for c in m.process_question_streaming("что дальше?")]

    chunks = asyncio.run(collect())
    assert chunks == [pg.lock_text("trainer")]
    assert asyncio.run(m.process_question_full("ещё")) == pg.lock_text("trainer")
    assert m.name == "trainer" and m.last_tools_used == []
    m.save_to_history("q", "a"); m.save_method_state()


if __name__ == "__main__":
    names = [n for n in dir() if n.startswith("test_")]
    for n in names:
        globals()[n]()
        print("ok", n)
    print(f"{len(names)} tests passed")
