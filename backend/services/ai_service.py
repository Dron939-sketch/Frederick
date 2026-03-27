"""
Сервис для работы с DeepSeek API
"""

import aiohttp
import asyncio
import json
import logging
import os
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class AIService:
    """Сервис для работы с DeepSeek API"""
    
    def __init__(self, cache=None):
        self.api_key = os.environ.get('DEEPSEEK_API_KEY')
        self.cache = cache
        self.session: Optional[aiohttp.ClientSession] = None
        self.base_url = "https://api.deepseek.com/v1"
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Получение HTTP сессии"""
        if not self.session or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def generate_response(
        self,
        user_id: int,
        message: str,
        context: Dict = None,
        profile: Dict = None,
        mode: str = 'psychologist'
    ) -> str:
        """Генерация ответа через DeepSeek"""
        
        # Проверяем кэш
        cache_key = f"response:{user_id}:{hash(message)}"
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                logger.info(f"Cache hit for user {user_id}")
                return cached
        
        # Если нет API ключа, возвращаем fallback
        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY not set, using fallback")
            return self._get_fallback_response(mode)
        
        # Формируем промпты
        system_prompt = self._get_system_prompt(mode, profile)
        user_prompt = self._get_user_prompt(message, context)
        
        try:
            session = await self._get_session()
            
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1000,
                    "top_p": 0.9,
                    "frequency_penalty": 0.5,
                    "presence_penalty": 0.5
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    result = data['choices'][0]['message']['content']
                    
                    # Сохраняем в кэш
                    if self.cache:
                        await self.cache.set(cache_key, result, ttl=300)
                    
                    return result
                else:
                    error_text = await response.text()
                    logger.error(f"DeepSeek API error: {response.status} - {error_text}")
                    return self._get_fallback_response(mode)
                    
        except asyncio.TimeoutError:
            logger.error("DeepSeek API timeout")
            return "Извините, сервер временно перегружен. Попробуйте позже."
        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            return self._get_fallback_response(mode)
    
    async def generate_profile_interpretation(self, user_id: int, profile: Dict) -> str:
        """Генерация интерпретации профиля"""
        if not self.api_key:
            return "Пройдите тест, чтобы получить полную интерпретацию профиля."
        
        system_prompt = """Ты психолог-аналитик. На основе данных теста создай глубокую интерпретацию личности.
Используй мягкий, поддерживающий тон. Структурируй ответ:
1. Ключевые характеристики
2. Сильные стороны
3. Зоны роста
4. Рекомендации"""
        
        user_prompt = f"""
Профиль пользователя:
- Код профиля: {profile.get('display_name', 'не определен')}
- Тип восприятия: {profile.get('perception_type', 'не определен')}
- Уровень мышления: {profile.get('thinking_level', 5)}/9
- Поведенческие уровни: {profile.get('behavioral_levels', {})}

Создай психологический портрет.
"""
        
        return await self._call_deepseek(system_prompt, user_prompt)
    
    async def generate_psychologist_thought(self, user_id: int, profile: Dict) -> str:
        """Генерация мысли психолога"""
        if not self.api_key:
            return "Ваш психологический портрет формируется. Пройдите тест для полного анализа."
        
        system_prompt = "Ты психолог. Напиши одну глубокую, инсайтную мысль о клиенте на основе его профиля."
        
        user_prompt = f"""
Профиль: {profile.get('display_name', 'не определен')}
Тип восприятия: {profile.get('perception_type', 'не определен')}

Напиши одну мысль психолога (2-3 предложения).
"""
        
        return await self._call_deepseek(system_prompt, user_prompt)
    
    async def generate_weekend_ideas(self, user_id: int, profile: Dict, context: Dict) -> List[str]:
        """Генерация идей на выходные"""
        if not self.api_key:
            return ["Прогулка на природе", "Встреча с друзьями", "Чтение книги"]
        
        system_prompt = "Ты психолог. Предложи 5 идей на выходные, которые подходят психотипу человека."
        
        user_prompt = f"""
Профиль: {profile.get('display_name', 'не определен')}
Город: {context.get('city', 'не указан') if context else 'не указан'}

Предложи 5 идей на выходные. Каждая идея - одно предложение.
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt)
        # Разбиваем на список
        ideas = [line.strip() for line in response.split('\n') if line.strip() and len(line) > 10]
        return ideas[:5] if ideas else ["Отдых на природе", "Встреча с друзьями", "Саморазвитие"]
    
    async def generate_goals(self, user_id: int, profile: Dict, mode: str) -> List[Dict]:
        """Генерация целей"""
        if not self.api_key:
            return [
                {"name": "Личностный рост", "time": "3-4 недели", "difficulty": "medium"},
                {"name": "Баланс в жизни", "time": "4-6 недель", "difficulty": "hard"}
            ]
        
        system_prompt = f"Ты {mode}. Предложи 5 целей для клиента, подходящих его профилю."
        
        user_prompt = f"""
Профиль: {profile.get('display_name', 'не определен')}

Предложи 5 целей в формате JSON:
[{{"name": "название", "time": "срок", "difficulty": "easy/medium/hard"}}]
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt)
        
        try:
            # Пытаемся распарсить JSON
            import re
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass
        
        return [
            {"name": "Личностный рост", "time": "3-4 недели", "difficulty": "medium"},
            {"name": "Баланс в жизни", "time": "4-6 недель", "difficulty": "hard"}
        ]
    
    async def generate_questions(self, user_id: int, profile: Dict) -> List[str]:
        """Генерация умных вопросов"""
        if not self.api_key:
            return [
                "Что для вас сейчас самое важное?",
                "Чего вы хотите достичь в ближайшее время?",
                "Что вас сейчас беспокоит?"
            ]
        
        system_prompt = "Ты психолог. Сформулируй 5 глубоких вопросов для саморефлексии."
        
        user_prompt = f"""
Профиль: {profile.get('display_name', 'не определен')}

Сформулируй 5 вопросов для размышления.
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt)
        questions = [q.strip() for q in response.split('\n') if q.strip() and '?' in q]
        return questions[:5] if questions else ["Что для вас сейчас важно?", "Куда вы хотите прийти?"]
    
    async def _call_deepseek(self, system_prompt: str, user_prompt: str) -> str:
        """Вызов DeepSeek API"""
        try:
            session = await self._get_session()
            
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.8,
                    "max_tokens": 500
                },
                timeout=aiohttp.ClientTimeout(total=20)
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    return data['choices'][0]['message']['content']
                else:
                    logger.error(f"DeepSeek error: {response.status}")
                    return ""
                    
        except Exception as e:
            logger.error(f"DeepSeek call error: {e}")
            return ""
    
    def _get_system_prompt(self, mode: str, profile: Dict) -> str:
        """Формирование системного промпта"""
        prompts = {
            'coach': "Ты Фреди, коуч. Помогаешь клиенту найти ответы внутри себя. Задаешь открытые вопросы, направляешь, но не даешь готовых решений. Используешь техники коучинга.",
            'psychologist': "Ты Фреди, психолог. Исследуешь глубинные паттерны, защитные механизмы, прошлый опыт. Помогаешь разобраться в причинах. Используешь мягкий, поддерживающий тон.",
            'trainer': "Ты Фреди, тренер. Даешь четкие инструменты, алгоритмы, формируешь навыки. Конкретные шаги к результату. Структурируешь ответы."
        }
        
        prompt = prompts.get(mode, prompts['psychologist'])
        
        if profile:
            prompt += f"\n\nПрофиль клиента: {profile.get('display_name', 'не определен')}"
        
        return prompt
    
    def _get_user_prompt(self, message: str, context: Dict) -> str:
        """Формирование пользовательского промпта"""
        prompt = message
        
        if context and context.get('city'):
            prompt += f"\n\nКонтекст: город {context.get('city')}"
        if context and context.get('age'):
            prompt += f", возраст {context.get('age')}"
        
        return prompt
    
    def _get_fallback_response(self, mode: str) -> str:
        """Ответ при ошибке"""
        fallbacks = {
            'coach': "Я здесь. Давайте вместе подумаем над этим. Что вы чувствуете?",
            'psychologist': "Я с вами. Расскажите подробнее, что вас беспокоит?",
            'trainer': "Готов к работе. Сформулируйте задачу, и мы сделаем план."
        }
        return fallbacks.get(mode, fallbacks['psychologist'])
    
    async def close(self):
        """Закрытие сессии"""
        if self.session and not self.session.closed:
            await self.session.close()
