"""
Модуль для работы с PostgreSQL базой данных
Асинхронный пул соединений с автоматическим восстановлением
"""

import asyncpg
import logging
import os
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import time

logger = logging.getLogger(__name__)


class Database:
    """Асинхронный пул соединений PostgreSQL"""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.dsn: Optional[str] = None
        self._closed = False
        self._reconnecting = False
        self._last_health_check = 0
        self._health_check_interval = 30  # секунд
    
    async def connect(self, dsn: str = None, min_size: int = 5, max_size: int = 20):
        """
        Создание пула соединений
        
        Args:
            dsn: Строка подключения к PostgreSQL
            min_size: Минимальное количество соединений
            max_size: Максимальное количество соединений
        """
        self.dsn = dsn or os.environ.get('DATABASE_URL')
        
        if not self.dsn:
            raise Exception("DATABASE_URL not set")
        
        try:
            logger.info(f"🔄 Creating database pool (min={min_size}, max={max_size})...")
            
            self.pool = await asyncpg.create_pool(
                self.dsn,
                min_size=min_size,
                max_size=max_size,
                command_timeout=30,
                max_inactive_connection_lifetime=300,
                max_queries=50000,
                setup=self._setup_connection
            )
            
            # Проверяем соединение
            async with self.pool.acquire() as conn:
                await conn.execute("SELECT 1")
            
            logger.info(f"✅ Database pool created successfully")
            self._closed = False
            return True
            
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            self.pool = None
            raise
    
    async def _setup_connection(self, conn: asyncpg.Connection):
        """Настройка соединения при создании"""
        # Устанавливаем временную зону
        await conn.execute("SET timezone = 'UTC'")
        
        # Устанавливаем таймауты
        await conn.execute("SET statement_timeout = '30s'")
        await conn.execute("SET idle_in_transaction_session_timeout = '60s'")
        
        # Для production: включаем расширения
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements")
        except Exception:
            pass  # Может не хватать прав
    
    async def health_check(self) -> bool:
        """Проверка здоровья соединения"""
        now = time.time()
        if now - self._last_health_check < self._health_check_interval:
            return self.pool is not None and not self._closed
        
        self._last_health_check = now
        
        if not self.pool or self.pool._closed or self._closed:
            return await self.reconnect()
        
        try:
            async with self.pool.acquire() as conn:
                await conn.execute("SELECT 1")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Health check failed: {e}")
            return await self.reconnect()
    
    async def reconnect(self) -> bool:
        """Принудительное переподключение"""
        if self._reconnecting:
            return False
        
        self._reconnecting = True
        try:
            logger.info("🔄 Reconnecting to database...")
            
            if self.pool and not self.pool._closed:
                await self.pool.close()
                self.pool = None
            
            await self.connect()
            self._closed = False
            logger.info("✅ Reconnected successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Reconnection failed: {e}")
            self.pool = None
            self._closed = True
            return False
            
        finally:
            self._reconnecting = False
    
    @asynccontextmanager
    async def get_connection(self):
        """Получение соединения из пула"""
        if not await self.health_check():
            raise Exception("Database connection is not available")
        
        try:
            async with self.pool.acquire() as conn:
                yield conn
                
        except (asyncpg.exceptions.ConnectionDoesNotExistError,
        asyncpg.exceptions.InterfaceError) as e:
            logger.warning(f"⚠️ Connection error: {e}")
            # Пытаемся переподключиться
            if await self.reconnect():
                async with self.pool.acquire() as conn:
                    yield conn
            else:
                raise
    
    async def execute(self, query: str, *args) -> str:
        """Выполнение запроса"""
        async with self.get_connection() as conn:
            return await conn.execute(query, *args)
    
    async def fetch(self, query: str, *args) -> List[asyncpg.Record]:
        """Выполнение запроса с возвратом списка строк"""
        async with self.get_connection() as conn:
            return await conn.fetch(query, *args)
    
    async def fetchrow(self, query: str, *args) -> Optional[asyncpg.Record]:
        """Выполнение запроса с возвратом одной строки"""
        async with self.get_connection() as conn:
            return await conn.fetchrow(query, *args)
    
    async def fetchval(self, query: str, *args) -> Any:
        """Выполнение запроса с возвратом одного значения"""
        async with self.get_connection() as conn:
            return await conn.fetchval(query, *args)
    
    async def close(self):
        """Закрытие пула соединений"""
        if self.pool and not self.pool._closed:
            await self.pool.close()
            self.pool = None
            self._closed = True
            logger.info("🔌 Database pool closed")
