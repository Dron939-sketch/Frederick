"""
Сервис для работы с погодой (OpenWeatherMap)
Адаптирован для API из бота
"""

import aiohttp
import asyncio
import logging
import os
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class WeatherService:
    """Сервис для получения погоды"""
    
    def __init__(self, cache=None):
        self.api_key = os.environ.get('OPENWEATHER_API_KEY')
        self.cache = cache
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Получение HTTP сессии"""
        if not self.session or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def get_weather(self, city: str, language: str = "ru") -> Optional[Dict[str, Any]]:
        """
        Получение погоды для города
        
        Args:
            city: Название города
            language: Язык (ru, en)
        
        Returns:
            Словарь с погодой или None
        """
        if not self.api_key:
            logger.warning("OPENWEATHER_API_KEY not set")
            return None
        
        # Проверяем кэш
        cache_key = f"weather:{city.lower()}"
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                logger.info(f"Weather cache hit for {city}")
                return cached
        
        try:
            session = await self._get_session()
            
            async with session.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "q": city,
                    "appid": self.api_key,
                    "units": "metric",
                    "lang": language
                },
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    
                    weather = {
                        "city": data.get('name', city),
                        "temperature": round(data['main']['temp']),
                        "feels_like": round(data['main']['feels_like']),
                        "description": data['weather'][0]['description'].capitalize(),
                        "icon": self._get_icon(data['weather'][0]['icon']),
                        "humidity": data['main']['humidity'],
                        "wind_speed": data['wind']['speed'],
                        "pressure": data['main']['pressure'],
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
                    # Сохраняем в кэш на 30 минут
                    if self.cache:
                        await self.cache.set(cache_key, weather, ttl=1800)
                    
                    return weather
                    
                elif response.status == 404:
                    logger.warning(f"City not found: {city}")
                    return None
                else:
                    error = await response.text()
                    logger.error(f"Weather API error: {response.status} - {error}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error(f"Weather API timeout for {city}")
            return None
        except Exception as e:
            logger.error(f"Weather error: {e}")
            return None
    
    def _get_icon(self, icon_code: str) -> str:
        """Преобразование кода иконки в эмодзи"""
        icons = {
            "01d": "☀️",
            "01n": "🌙",
            "02d": "⛅",
            "02n": "☁️",
            "03d": "☁️",
            "03n": "☁️",
            "04d": "☁️",
            "04n": "☁️",
            "09d": "🌧️",
            "09n": "🌧️",
            "10d": "🌦️",
            "10n": "🌧️",
            "11d": "⛈️",
            "11n": "⛈️",
            "13d": "❄️",
            "13n": "❄️",
            "50d": "🌫️",
            "50n": "🌫️"
        }
        return icons.get(icon_code, "🌡️")
    
    async def get_forecast(self, city: str, days: int = 5) -> Optional[Dict[str, Any]]:
        """
        Получение прогноза погоды на несколько дней
        
        Args:
            city: Название города
            days: Количество дней (1-5)
        
        Returns:
            Словарь с прогнозом
        """
        if not self.api_key:
            return None
        
        try:
            session = await self._get_session()
            
            async with session.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={
                    "q": city,
                    "appid": self.api_key,
                    "units": "metric",
                    "lang": "ru",
                    "cnt": days * 8  # 8 записей в день (каждые 3 часа)
                },
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    
                    forecast = []
                    for item in data.get('list', [])[:days * 8]:
                        forecast.append({
                            "datetime": item['dt_txt'],
                            "temperature": round(item['main']['temp']),
                            "description": item['weather'][0]['description'].capitalize(),
                            "icon": self._get_icon(item['weather'][0]['icon'])
                        })
                    
                    return {
                        "city": data.get('city', {}).get('name', city),
                        "forecast": forecast
                    }
                else:
                    return None
                    
        except Exception as e:
            logger.error(f"Forecast error: {e}")
            return None
    
    async def close(self):
        """Закрытие сессии"""
        if self.session and not self.session.closed:
            await self.session.close()
