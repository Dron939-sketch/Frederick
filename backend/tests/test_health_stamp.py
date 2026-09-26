# -*- coding: utf-8 -*-
"""/health несёт отметки сборки и старта.

26.09.2026 после двух мержей подряд подарок час отдавал два вложения вместо
трёх, и снаружи было не понять, идёт ли сборка или упала. Проверяется по
тексту main.py: поля build и started есть в модели и в ответе, отметка
сборки берётся из mtime файла образа.
"""
import os
import re

MAIN = os.path.join(os.path.dirname(__file__), "..", "main.py")


def test_health_has_build_and_started():
    src = open(MAIN, encoding="utf-8").read()
    model = src[src.index("class HealthResponse"):src.index("class MorningMessageRequest")]
    assert "build: Optional[str]" in model and "started: Optional[str]" in model
    body = src[src.index("async def health_check"):src.index("async def health_check") + 1500]
    assert '"build": _BUILD_STAMP' in body and '"started": _STARTED_AT' in body
    assert re.search(r"os\.path\.getmtime\(__file__\)", src), "отметка сборки — mtime файла образа"
