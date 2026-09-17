"""Письма тем, у кого кончились минуты: три варианта и честный замер.

Владелец 17.09.2026: «сделай несколько вариантов писем и разошли, и
контроль после каких писем возвращаются, что-то вроде А/Б теста».

Почему это вообще понадобилось: с 15.09 разговоры удлинились (медиана
с одной реплики до четырёх), и в стену стало упираться больше людей,
чем пишет первое сообщение — 22 против 15 за 17.09. Стена конвертирует
в районе процента, так что позвать обратно можно только письмом.
"""

import pathlib
import re
import sys

BACKEND = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import limit_reached_mail as lrm  # noqa: E402

MAIN = (BACKEND / "main.py").read_text(encoding="utf-8")


def test_three_variants_differ():
    """Варианты различаются темой и зовом, а не случайными словами."""
    subjects, ctas = set(), set()
    for v in lrm.VARIANTS:
        _, subject, text, _ = lrm.build_email("x@example.com", variant=v)
        subjects.add(subject)
        ctas.add(text.split("\n\n")[4].split(":")[0])
    assert len(subjects) == 3, f"темы совпадают: {subjects}"
    assert len(ctas) == 3, f"кнопки совпадают: {ctas}"


def test_variant_is_stable_per_address():
    """Один адрес — всегда одно письмо, иначе замер бессмыслен."""
    for addr in ("anna@mail.ru", "OLEG@Yandex.RU", "x@example.com"):
        assert lrm.variant_for(addr) == lrm.variant_for(addr.lower().strip())
    assert lrm.variant_for("anna@mail.ru") == lrm.variant_for("anna@mail.ru")


def test_variants_are_spread():
    """Хеш раскладывает адреса по всем трём, а не сваливает в один."""
    seen = {lrm.variant_for(f"user{i}@mail.ru") for i in range(60)}
    assert seen == set(lrm.VARIANTS), f"разложилось только в {seen}"


def test_link_carries_variant():
    """По метке в ссылке и считаем возвраты."""
    for v in lrm.VARIANTS:
        _, _, text, html = lrm.build_email("x@example.com", variant=v)
        assert f"v={v}" in text and f"v={v}" in html
        assert "from=mail_limit" in text


def test_no_selling_in_letters():
    """Человека оборвали на середине — денег у него в этот момент не просят."""
    for v in lrm.VARIANTS:
        _, subject, text, html = lrm.build_email("x@example.com", variant=v)
        blob = (subject + text + html).lower()
        for word in ("подписк", "оплат", "купить", "₽", "premium", "тариф"):
            assert word not in blob, f"вариант {v} продаёт: «{word}»"


def test_shortcut_instructions_present():
    """Ярлык на экране — просьба владельца, он есть во всех вариантах."""
    for v in lrm.VARIANTS:
        _, _, text, html = lrm.build_email("x@example.com", variant=v)
        for platform in ("Айфон", "Андроид", "Компьютер"):
            assert platform in text and platform in html


def test_test_title_not_invented():
    """Без названия теста письмо не выдумывает его."""
    _, _, text, _ = lrm.build_email("x@example.com", test_title=None)
    assert "«»" not in text
    assert "тест" not in text.split("Здравствуйте")[1].split("\n\n")[1].lower()
    _, _, with_test, _ = lrm.build_email("x@example.com", test_title="Тревога")
    assert "«Тревога»" in with_test


def test_optout_only_when_given():
    """Ссылка «отписаться» не выдумывается."""
    _, _, _, html = lrm.build_email("x@example.com")
    assert "отписаться" not in html
    _, _, _, html2 = lrm.build_email("x@example.com", optout_link="https://x/y")
    assert "отписаться" in html2


def test_send_endpoint_is_dry_by_default():
    """Рассылка живым людям не уходит с опечатки: dry_run по умолчанию."""
    assert '@app.post("/api/admin/followup/limit")' in MAIN
    block = MAIN.split('@app.post("/api/admin/followup/limit")')[1][:2000]
    assert 'body.get("dry_run", True)' in block, "dry_run не по умолчанию"
    assert "_require_admin_token(request)" in block


def test_report_counts_conversations_not_clicks():
    """Возврат — это написанное сообщение, а не открытая ссылка."""
    block = MAIN.split('"/api/admin/followup/limit/report"')[1][:2500]
    assert "m.role = 'user'" in block
    assert "m.created_at > l.followed_up_at" in block
