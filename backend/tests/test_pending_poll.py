# -*- coding: utf-8 -*-
"""Опрос pending-платежей: нераспознанные строки считаются и закрываются.

26.09.2026 в логе стояло «Pending poll: total=5 activated=0 canceled=0
still_pending=0 errors=0» — пять строк ни в одной корзине. Это платежи,
которых ЮKassa не находит или которые принадлежат другому пользователю;
они опрашивались вечно. Проверяется по тексту: отдельный счётчик с
причиной в логе, старые закрываются статусом unresolved, свежие — нет.
"""
import ast
import os

BACKEND = os.path.join(os.path.dirname(__file__), "..")


def _func(source: str, name: str) -> str:
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == name:
            return ast.get_source_segment(source, node) or ""
    raise AssertionError(name)


def test_poll_counts_and_closes_unresolved():
    src = open(os.path.join(BACKEND, "payment.py"), encoding="utf-8").read()
    body = _func(src, "poll_pending_payments")
    assert 'elif not result.get("success"):' in body, "строка без статуса — отдельная корзина"
    assert "unresolved_reasons" in body and "reasons=" in body, "причина в логе"
    assert 'if r["yookassa_id"] in old_ids:' in body, "закрываются только строки старше окна"
    assert "SET status = 'unresolved'" in body and "WHERE status = 'pending'" in body
    assert "unresolved={unresolved}" in body
    i_verify = body.index("verify_payment(")
    i_close = body.index("SET status = 'unresolved'")
    assert i_verify < i_close, "сначала проверка в ЮKassa, потом закрытие"
