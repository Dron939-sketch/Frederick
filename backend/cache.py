"""
Модуль для работы с Redis кэшем
Асинхронный клиент с автоматическим переподключением
"""

import aioredis
import json
import logging
import os
from typing import Optional, Any, Callable

logger = logging.getLogger(__name__)


class RedisCache:
    """Асинхронный Redis кэш"""
    
    def __init__(self):
        self.redis = None
        self._connected = False
        self.url: Optional[str] = None
    
    async def connect(self, url: str = None):
        """Подключение к Redis"""
        self.url = url or os.environ.get('REDIS_URL')
        
        if not self.url:
            logger.warning("⚠️ REDIS_URL not set, caching disabled")
            self._connected = False
            return
        
        try:
            self.redis = await aioredis.from_url(
                self.url,
                decode_responses=True,
                max_connections=20,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True
            )
            await self.redis.ping()
            self._connected = True
            logger.info("✅ Redis connected")
            
        except Exception as e:
            logger.warning(f"⚠️ Redis connection failed: {e}")
            self._connected = False
            self.redis = None
    
    @property
    def is_connected(self) -> bool:
        """Проверка подключения"""
        return self._connected and self.redis is not None
    
    async def health_check(self) -> bool:
        """Проверка здоровья"""
        if not self.is_connected:
            return False
        
        try:
            await self.redis.ping()
            return True
        except Exception:
            # Пытаемся переподключиться
            await self.connect()
            return self._connected
    
    async def get(self, key: str) -> Optional[Any]:
        """Получение значения из кэша"""
        if not self.is_connected:
            return None
        
        try:
            data = await self.redis.get(key)
            if data:
                try:
                    return json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    return data
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        Сохранение значения в кэш
        
        Args:
            key: Ключ
            value: Значение
            ttl: Время жизни в секундах (по умолчанию 5 минут)
        """
        if not self.is_connected:
            return False
        
        try:
            # Сериализуем в JSON
            if isinstance(value, (dict, list)):
                value = json.dumps(value, default=str, ensure_ascii=False)
            elif not isinstance(value, str):
                value = str(value)
            
            await self.redis.setex(key, ttl, value)
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    async def get_or_set(self, key: str, fetcher: Callable, ttl: int = 300) -> Any:
        """
        Получить значение из кэша или вычислить и сохранить
        
        Args:
            key: Ключ
            fetcher: Асинхронная функция для получения значения
            ttl: Время жизни в секундах
        """
        cached = await self.get(key)
        if cached is not None:
            return cached
        
        value = await fetcher()
        if value is not None:
            await self.set(key, value, ttl)
        return value
    
    async def delete(self, key: str) -> bool:
        """Удаление значения из кэша"""
        if not self.is_connected:
            return False
        
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Удаление всех ключей по паттерну"""
        if not self.is_connected:
            return 0
        
        try:
            keys = await self.redis.keys(pattern)
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Redis delete_pattern error: {e}")
            return 0
    
    async def incr(self, key: str, amount: int = 1) -> Optional[int]:
        """Инкремент значения"""
        if not self.is_connected:
            return None
        
        try:
            return await self.redis.incrby(key, amount)
        except Exception as e:
            logger.error(f"Redis incr error: {e}")
            return None
    
    async def expire(self, key: str, ttl: int) -> bool:
        """Установка времени жизни"""
        if not self.is_connected:
            return False
        
        try:
            return await self.redis.expire(key, ttl)
        except Exception as e:
            logger.error(f"Redis expire error: {e}")
            return False
    
    async def close(self):
        """Закрытие соединения"""
        if self.redis:
            await self.redis.close()
            self.redis = None
            self._connected = False
            logger.info("🔌 Redis connection closed")
