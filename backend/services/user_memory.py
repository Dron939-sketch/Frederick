"""
user_memory.py - Simple fact memory for BasicMode.
Extracts and stores facts about user from conversations.
No external APIs - uses DeepSeek via AIService.
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class UserMemory:
    """Stores and retrieves facts about a user from conversations."""

    def __init__(self, db):
        self.db = db

    async def init_table(self):
        """Create facts table if not exists."""
        async with self.db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_user_facts (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    fact TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(user_id, fact)
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_user_facts_user "
                "ON fredi_user_facts(user_id, created_at DESC)"
            )
        logger.info("UserMemory table ready")

    async def store_fact(self, user_id: int, fact: str, category: str = "general"):
        """Store a fact about user. Ignores duplicates."""
        if not fact or len(fact) < 3:
            return
        try:
            async with self.db.get_connection() as conn:
                await conn.execute(
                    "INSERT INTO fredi_user_facts (user_id, fact, category) "
                    "VALUES ($1, $2, $3) ON CONFLICT (user_id, fact) DO NOTHING",
                    user_id, fact.strip()[:500], category
                )
        except Exception as e:
            logger.warning(f"store_fact error: {e}")

    async def get_facts(self, user_id: int, limit: int = 15) -> List[str]:
        """Get stored facts about user, most recent first."""
        try:
            async with self.db.get_connection() as conn:
                rows = await conn.fetch(
                    "SELECT fact FROM fredi_user_facts "
                    "WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
                    user_id, limit
                )
                return [r["fact"] for r in rows]
        except Exception as e:
            logger.warning(f"get_facts error: {e}")
            return []

    async def get_facts_text(self, user_id: int) -> str:
        """Get facts formatted for prompt injection."""
        facts = await self.get_facts(user_id)
        if not facts:
            return ""
        return "Что я помню о собеседнике: " + "; ".join(facts)

    async def forget_recent(self, user_id: int, n: int = 3) -> int:
        """Удаляет N самых свежих фактов о юзере. Используется когда
        собеседник говорит «забудь это / это не моё / это сказала сестра» —
        чтобы Фреди не тащил в следующие сессии услышанное от другого
        человека или ошибочно атрибутированное."""
        if n <= 0:
            return 0
        try:
            async with self.db.get_connection() as conn:
                rows = await conn.fetch(
                    "SELECT id FROM fredi_user_facts "
                    "WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
                    user_id, n,
                )
                if not rows:
                    return 0
                ids = [r["id"] for r in rows]
                await conn.execute(
                    "DELETE FROM fredi_user_facts WHERE id = ANY($1::bigint[])",
                    ids,
                )
                return len(ids)
        except Exception as e:
            logger.warning(f"forget_recent error: {e}")
            return 0

    async def forget_matching(self, user_id: int, keywords: List[str]) -> int:
        """Удаляет факты, содержащие любое из ключевых слов (case-insensitive)."""
        if not keywords:
            return 0
        try:
            kws = [k.strip().lower() for k in keywords if k and k.strip()]
            if not kws:
                return 0
            async with self.db.get_connection() as conn:
                # Собираем условие LIKE %kw% через ANY/ILIKE-цепочку.
                conds = " OR ".join(["LOWER(fact) LIKE $%d" % (i + 2) for i in range(len(kws))])
                params = [user_id] + [f"%{k}%" for k in kws]
                result = await conn.execute(
                    f"DELETE FROM fredi_user_facts WHERE user_id = $1 AND ({conds})",
                    *params,
                )
                # asyncpg execute returns string like "DELETE N"
                try:
                    return int(result.split()[-1])
                except Exception:
                    return 0
        except Exception as e:
            logger.warning(f"forget_matching error: {e}")
            return 0


# Singleton
_instance: Optional[UserMemory] = None

def get_user_memory(db=None) -> Optional[UserMemory]:
    global _instance
    if _instance is None and db is not None:
        _instance = UserMemory(db)
    return _instance
