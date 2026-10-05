# -*- coding: utf-8 -*-
"""Замок Лектория: первая лекция нового курса открыта, 2–10 — по подписке.

Решение владельца 05.10.2026. На сайте у запертых лекций вместо тела стоит
<div id="lockGate">, тело лежит в data/lektorij_locked/<slug>.html и
отдаётся по /api/lektorij/lecture/<slug> только при активной подписке;
/api/tts/blog/<slug>/status без подписки не выдаёт адрес mp3; конвейер
озвучки подставляет фрагмент обратно перед извлечением текста.

Запуск: python3 -m pytest -q backend/tests/test_lektorij_lock.py
"""
import importlib.util
import pathlib
import re

BACKEND = pathlib.Path(__file__).resolve().parents[1]
TTS = (BACKEND / "blog_tts_routes.py").read_text(encoding="utf-8")
MAIN = (BACKEND / "main.py").read_text(encoding="utf-8")
SITE = BACKEND.parent.parent / "dron939-sketch.github.io"


def _mod(tmp_path=None):
    spec = importlib.util.spec_from_file_location("lektorij_lock_probe", BACKEND / "lektorij_lock.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    if tmp_path is not None:
        m.LOCK_DIR = str(tmp_path)
    return m


def test_inject_replaces_gate_by_canonical(tmp_path):
    m = _mod(tmp_path)
    (tmp_path / "lekciya-x-2-test.html").write_text('<h2 id="s-1">1. Тело</h2><p>лекция</p>', encoding="utf-8")
    page = ('<link rel="canonical" href="https://meysternlp.ru/blog/lekciya-x-2-test.html">'
            '<div class="article-content"><p class="subtitle">врез</p>'
            '<div id="lockGate" data-slug="lekciya-x-2-test" data-first="/blog/lekciya-x-1.html"></div>'
            '<h2>❓ Частые вопросы</h2></div>')
    out = m.inject(page)
    assert "lockGate" not in out and '<h2 id="s-1">1. Тело</h2>' in out
    assert m.is_locked("lekciya-x-2-test") and not m.is_locked("lekciya-x-1")
    assert m.inject("<p>без замка</p>") == "<p>без замка</p>"


def test_uid_rejects_temp_and_garbage():
    m = _mod()
    assert m._uid("1790000000000008") == 1790000000000008
    assert m._uid("temp_1759_abc") is None and m._uid("") is None and m._uid(None) is None
    assert m._uid("1" * 25) is None


def test_tts_status_hides_url_for_locked_without_subscription():
    i = TTS.index("async def blog_tts_status")
    seg = TTS[i:i + 1800]
    assert 'uid: str = ""' in seg, "статус не принимает uid"
    assert "_is_locked(slug) and not await _is_premium(uid)" in seg
    locked_ret = seg[seg.index('"locked": True'):seg.index('"locked": True') + 200]
    assert '"url"' not in locked_ret, "за замком адрес mp3 выдавать нельзя"


def test_tts_text_extraction_injects_fragment():
    i = TTS.index("def _extract_text")
    assert "from lektorij_lock import inject" in TTS[i:i + 600]


def test_routes_registered_after_tts():
    assert "register_lektorij_lock_routes(app, limiter)" in MAIN
    assert MAIN.index("register_blog_tts_routes(app, limiter)") < MAIN.index("register_lektorij_lock_routes(app, limiter)")


def test_site_locked_lectures_have_gate_and_first_is_open():
    if not SITE.exists():
        return
    locked = {p.stem for p in (BACKEND / "data" / "lektorij_locked").glob("*.html")}
    assert locked, "нет фрагментов за замком"
    for slug in locked:
        html = (SITE / "blog" / f"{slug}.html").read_text(encoding="utf-8")
        assert f'id="lockGate" data-slug="{slug}"' in html, slug
        assert '<h2 id="s-1">' not in html, f"{slug}: тело лекции осталось в HTML"
        assert '"isAccessibleForFree": false' in html and '"cssSelector": ".lock-paid"' in html, slug
        assert "/blog/lock.js" in html, slug
        if '"@type": "FAQPage"' in html:
            assert "❓ Частые вопросы" in html, f"{slug}: FAQ обязан остаться видимым"
        assert not re.search(r'<a href="#[^"]*"', html[html.find('<div class="article-content">'):html.find('id="lockGate"')]), \
            f"{slug}: во врезе ссылка на раздел за замком"
    # номер лекции — из карт Лектория; первая лекция каждого курса открыта
    import json
    waves = json.loads((SITE / "blog" / "lektorij" / "waves.json").read_text(encoding="utf-8"))
    courses = json.loads((SITE / "blog" / "lektorij" / "courses.json").read_text(encoding="utf-8"))
    cards = {c["name"]: c for c in json.loads((SITE / "blog" / "lektorij" / "cards.json").read_text(encoding="utf-8"))}
    for slug in locked:
        assert waves.get(slug, 0) >= 2, f"{slug}: первая лекция не запирается"
        first = cards[courses[slug]]["first"]  # «/blog/<slug>.html»
        assert "lockGate" not in (SITE / first.lstrip("/")).read_text(encoding="utf-8"), f"{first}: первая лекция заперта"
        html = (SITE / "blog" / f"{slug}.html").read_text(encoding="utf-8")
        assert f'data-first="{first}"' in html, f"{slug}: ссылка на первую лекцию в замке неверна"
    js = (SITE / "blog" / "lock.js").read_text(encoding="utf-8")
    assert "/api/lektorij/lecture/" in js and "lock-paid" in js and "fredi_user_id" in js
    listen = (SITE / "blog" / "listen.js").read_text(encoding="utf-8")
    assert "/status?uid=" in listen and "d.locked" in listen and "lecture_listen" in listen
