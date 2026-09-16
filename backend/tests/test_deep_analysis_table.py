"""Глубокий разбор пишется в свою таблицу, а не в чужую.

16.09.2026 в логе приложения на каждое сохранение разбора падало
«insert or update on table "deep_analyses" violates foreign key constraint
"deep_analyses_user_id_fkey"». В одной базе с Фреди лежит таблица
deep_analyses телеграм-бота: её внешний ключ смотрит в users, а
веб-пользователи Фреди живут в fredi_users. Запись не проходила, чтение
шло из той же чужой таблицы и всегда возвращало пусто — разбор
пересобирался моделью при каждом открытии экрана.

Тест текстовый: поднимать asyncpg ради этого незачем, а имя таблицы в
SQL-строке — ровно то, что сломалось.
"""

import pathlib
import re

REPO = pathlib.Path(__file__).resolve().parents[1] / "repositories" / "user_repo.py"
SOURCE = REPO.read_text(encoding="utf-8")

# Строки SQL без комментариев: имя таблицы в пояснении ловить не нужно.
SQL_ONLY = "\n".join(
    line for line in SOURCE.splitlines() if not line.lstrip().startswith("#")
)


def test_no_foreign_deep_analyses_table():
    """Ни одного обращения к deep_analyses без префикса fredi_."""
    hits = re.findall(r"(?<!fredi_)\bdeep_analyses\b", SQL_ONLY)
    assert not hits, f"чужая таблица deep_analyses в SQL: {len(hits)} вхождений"


def test_all_four_methods_use_own_table():
    """INSERT, два SELECT и деактивация — все по fredi_deep_analyses."""
    assert "INSERT INTO fredi_deep_analyses" in SQL_ONLY
    assert SQL_ONLY.count("FROM fredi_deep_analyses") == 2
    assert SQL_ONLY.count("UPDATE fredi_deep_analyses SET is_active = FALSE") == 3


def test_user_row_is_created_before_insert():
    """Строка в fredi_users заводится до вставки — иначе FK снова упадёт."""
    body = SOURCE.split("async def save_deep_analysis")[1].split("async def")[0]
    assert body.index("create_user_if_not_exists") < body.index(
        "INSERT INTO fredi_deep_analyses"
    )
