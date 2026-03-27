"""
Сервис для работы с DeepSeek API
Адаптирован для API из бота
"""

import aiohttp
import asyncio
import json
import logging
import os
import re
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
        """
        Генерация ответа через DeepSeek
        
        Args:
            user_id: ID пользователя
            message: Текст сообщения
            context: Контекст пользователя (город, возраст и т.д.)
            profile: Профиль пользователя (результаты теста)
            mode: Режим общения (coach, psychologist, trainer)
        
        Returns:
            Сгенерированный ответ
        """
        
        # Проверяем кэш (на 5 минут)
        cache_key = f"response:{user_id}:{hash(message)}:{mode}"
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
        user_prompt = self._get_user_prompt(message, context, profile)
        
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
                    
                    # Очищаем от Markdown для голосового вывода
                    result = self._clean_for_voice(result)
                    
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
        """
        Генерация интерпретации профиля (мысли психолога)
        
        Args:
            user_id: ID пользователя
            profile: Данные профиля
        
        Returns:
            Текст интерпретации
        """
        if not self.api_key:
            return self._get_profile_fallback(profile)
        
        system_prompt = """Ты психолог-аналитик. На основе данных теста создай глубокую интерпретацию личности.

Структурируй ответ в формате:

🔑 **КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА**
[2-3 предложения о главной особенности]

💪 **СИЛЬНЫЕ СТОРОНЫ**
• [сильная сторона 1]
• [сильная сторона 2]
• [сильная сторона 3]

🎯 **ЗОНЫ РОСТА**
• [зона роста 1]
• [зона роста 2]
• [зона роста 3]

⚠️ **ГЛАВНАЯ ЛОВУШКА**
[1-2 предложения о том, что мешает]

Используй теплый, поддерживающий тон. Обращайся к пользователю на "ты"."""
        
        # Получаем данные профиля
        profile_data = profile.get('profile_data', {})
        scores = profile.get('behavioral_levels', {})
        
        user_prompt = f"""
Профиль пользователя:
- Код профиля: {profile_data.get('display_name', 'не определен')}
- Тип восприятия: {profile.get('perception_type', 'не определен')}
- Уровень мышления: {profile.get('thinking_level', 5)}/9

Поведенческие уровни:
- СБ (реакция на давление): {self._get_avg_score(scores.get('СБ', []))}
- ТФ (деньги и ресурсы): {self._get_avg_score(scores.get('ТФ', []))}
- УБ (понимание мира): {self._get_avg_score(scores.get('УБ', []))}
- ЧВ (отношения): {self._get_avg_score(scores.get('ЧВ', []))}

Глубинные паттерны:
{self._format_deep_patterns(profile.get('deep_patterns', {}))}

Создай психологический портрет пользователя.
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=1500)
        
        if response:
            return response
        return self._get_profile_fallback(profile)
    
    async def generate_psychologist_thought(self, user_id: int, profile: Dict) -> str:
        """
        Генерация краткой мысли психолога (1-2 абзаца)
        
        Args:
            user_id: ID пользователя
            profile: Данные профиля
        
        Returns:
            Текст мысли
        """
        if not self.api_key:
            return self._get_thought_fallback(profile)
        
        system_prompt = """Ты психолог. Напиши одну глубокую, инсайтную мысль о клиенте на основе его профиля.

Мысль должна:
- Быть короткой (2-3 предложения)
- Содержать наблюдение о паттерне
- Завершаться вопросом или приглашением к размышлению

Пример: "Тебе важно, чтобы тебя принимали. Но за этим может стоять страх отвержения. Что будет, если перестать угождать другим?" """
        
        profile_data = profile.get('profile_data', {})
        scores = profile.get('behavioral_levels', {})
        
        # Находим самую слабую зону
        weakest = self._find_weakest_vector(scores)
        
        user_prompt = f"""
Профиль: {profile_data.get('display_name', 'не определен')}
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9

Самая слабая зона: {weakest.get('name', 'не определена')} (уровень {weakest.get('level', 3)})

Напиши одну мысль психолога (2-3 предложения).
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=300)
        
        if response:
            return response
        return self._get_thought_fallback(profile)
    
    async def generate_weekend_ideas(
        self, 
        user_id: int, 
        profile: Dict, 
        context: Dict,
        scores: Dict = None
    ) -> List[str]:
        """
        Генерация идей на выходные
        
        Args:
            user_id: ID пользователя
            profile: Профиль
            context: Контекст (город, возраст)
            scores: Баллы по векторам
        
        Returns:
            Список идей
        """
        if not self.api_key:
            return self._get_ideas_fallback(profile)
        
        system_prompt = """Ты психолог и lifestyle-эксперт. Предложи 5 идей на выходные, которые подходят психотипу человека.

Каждая идея должна быть:
- Конкретной и выполнимой
- Учитывать сильные стороны человека
- Помогать прорабатывать зоны роста

Формат ответа: просто список из 5 пунктов, без нумерации, каждый с новой строки."""
        
        if scores is None:
            scores = {}
            for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
                levels = profile.get('behavioral_levels', {}).get(k, [])
                scores[k] = sum(levels) / len(levels) if levels else 3
        
        profile_data = profile.get('profile_data', {})
        city = context.get('city', 'ваш город') if context else 'ваш город'
        age = context.get('age', 'не указан') if context else 'не указан'
        
        user_prompt = f"""
Профиль пользователя: {profile_data.get('display_name', 'не определен')}

Баллы по векторам:
- СБ (реакция на давление): {scores.get('СБ', 3):.1f}
- ТФ (деньги): {scores.get('ТФ', 3):.1f}
- УБ (понимание мира): {scores.get('УБ', 3):.1f}
- ЧВ (отношения): {scores.get('ЧВ', 3):.1f}

Город: {city}
Возраст: {age}

Предложи 5 идей на выходные.
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=500)
        
        if response:
            # Разбиваем на список
            ideas = []
            for line in response.strip().split('\n'):
                line = line.strip()
                # Убираем маркеры списка
                line = re.sub(r'^[\d\-\*•]\s*', '', line)
                if line and len(line) > 10:
                    ideas.append(line)
            return ideas[:5] if ideas else self._get_ideas_fallback(profile)
        
        return self._get_ideas_fallback(profile)
    
    async def generate_goals(
        self, 
        user_id: int, 
        profile: Dict, 
        mode: str = "coach"
    ) -> List[Dict]:
        """
        Генерация персональных целей
        
        Args:
            user_id: ID пользователя
            profile: Данные профиля
            mode: Режим (coach, psychologist, trainer)
        
        Returns:
            Список целей с метаданными
        """
        if not self.api_key:
            return self._get_goals_fallback(profile, mode)
        
        mode_names = {
            "coach": "коуч",
            "psychologist": "психолог",
            "trainer": "тренер"
        }
        
        system_prompt = f"""Ты {mode_names.get(mode, 'коуч')}. Предложи 5 целей для клиента, подходящих его профилю.

Цели должны:
- Быть конкретными и измеримыми
- Учитывать сильные стороны клиента
- Помогать прорабатывать зоны роста

Формат ответа: JSON массив, каждый объект содержит поля:
- id: уникальный идентификатор (например, "goal_1")
- name: название цели (до 50 символов)
- time: предполагаемое время (например, "3-4 недели")
- difficulty: сложность ("easy", "medium", "hard")

Пример:
[{{"id": "fear_work", "name": "Проработать страхи", "time": "3-4 недели", "difficulty": "medium"}}]"""
        
        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = profile.get('behavioral_levels', {}).get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3
        
        profile_data = profile.get('profile_data', {})
        
        user_prompt = f"""
Профиль: {profile_data.get('display_name', 'не определен')}

Баллы:
- СБ (реакция на давление): {scores.get('СБ', 3):.1f}
- ТФ (деньги): {scores.get('ТФ', 3):.1f}
- УБ (понимание мира): {scores.get('УБ', 3):.1f}
- ЧВ (отношения): {scores.get('ЧВ', 3):.1f}

Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9

Режим: {mode_names.get(mode, 'коуч')}

Предложи 5 целей в формате JSON.
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=1000)
        
        if response:
            try:
                # Извлекаем JSON из ответа
                json_match = re.search(r'\[.*\]', response, re.DOTALL)
                if json_match:
                    goals = json.loads(json_match.group())
                    return goals[:6] if isinstance(goals, list) else self._get_goals_fallback(profile, mode)
            except json.JSONDecodeError:
                logger.error("Failed to parse goals JSON")
        
        return self._get_goals_fallback(profile, mode)
    
    async def generate_questions(self, user_id: int, profile: Dict) -> List[str]:
        """
        Генерация умных вопросов для размышления
        
        Args:
            user_id: ID пользователя
            profile: Данные профиля
        
        Returns:
            Список вопросов
        """
        if not self.api_key:
            return self._get_questions_fallback()
        
        system_prompt = """Ты психолог. Сформулируй 5 глубоких вопросов для саморефлексии.

Вопросы должны:
- Быть открытыми (начинаться с "как", "почему", "что")
- Помогать человеку заглянуть внутрь себя
- Учитывать профиль пользователя

Формат ответа: просто список из 5 вопросов, каждый с новой строки."""
        
        profile_data = profile.get('profile_data', {})
        scores = profile.get('behavioral_levels', {})
        
        # Находим слабые зоны для персонализации
        weakest = self._find_weakest_vector(scores)
        
        user_prompt = f"""
Профиль: {profile_data.get('display_name', 'не определен')}
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9

Зона роста: {weakest.get('name', 'не определена')}

Сформулируй 5 вопросов для размышления.
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=500)
        
        if response:
            questions = [q.strip() for q in response.split('\n') if q.strip() and '?' in q]
            return questions[:5] if questions else self._get_questions_fallback()
        
        return self._get_questions_fallback()
    
    async def _call_deepseek(
        self, 
        system_prompt: str, 
        user_prompt: str, 
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> Optional[str]:
        """Вызов DeepSeek API"""
        if not self.api_key:
            return None
        
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
                    "temperature": temperature,
                    "max_tokens": max_tokens
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    return data['choices'][0]['message']['content']
                else:
                    logger.error(f"DeepSeek error: {response.status}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error("DeepSeek timeout")
            return None
        except Exception as e:
            logger.error(f"DeepSeek call error: {e}")
            return None
    
    def _get_system_prompt(self, mode: str, profile: Dict) -> str:
        """Формирование системного промпта"""
        prompts = {
            'coach': """Ты Фреди, коуч. Помогаешь клиенту найти ответы внутри себя.

Правила:
- Задавай открытые вопросы
- Направляй, но не давай готовых решений
- Используй техники коучинга
- Говори короткими предложениями, готовыми для озвучивания""",
            
            'psychologist': """Ты Фреди, психолог. Исследуешь глубинные паттерны, защитные механизмы, прошлый опыт.

Правила:
- Используй мягкий, поддерживающий тон
- Помогай разобраться в причинах
- Не давай советов, а помогай увидеть
- Говори короткими предложениями, готовыми для озвучивания""",
            
            'trainer': """Ты Фреди, тренер. Даёшь чёткие инструменты, алгоритмы, формируешь навыки.

Правила:
- Структурируй ответы
- Давай конкретные шаги
- Используй нумерацию для действий
- Говори ясно и по делу"""
        }
        
        prompt = prompts.get(mode, prompts['psychologist'])
        
        if profile:
            profile_code = profile.get('profile_data', {}).get('display_name', 'не определен')
            prompt += f"\n\nПрофиль клиента: {profile_code}"
        
        return prompt
    
    def _get_user_prompt(self, message: str, context: Dict, profile: Dict) -> str:
        """Формирование пользовательского промпта"""
        prompt = message
        
        if context:
            context_parts = []
            if context.get('city'):
                context_parts.append(f"город {context['city']}")
            if context.get('age'):
                context_parts.append(f"возраст {context['age']}")
            if context_parts:
                prompt += f"\n\nКонтекст: {', '.join(context_parts)}"
        
        if profile:
            profile_code = profile.get('profile_data', {}).get('display_name')
            if profile_code:
                prompt += f"\n\nПрофиль: {profile_code}"
        
        return prompt
    
    def _clean_for_voice(self, text: str) -> str:
        """Очистка текста для голосового вывода"""
        # Убираем Markdown
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)
        
        # Убираем эмодзи
        emoji_pattern = re.compile(
            "["
            u"\U0001F600-\U0001F64F"  # смайлики
            u"\U0001F300-\U0001F5FF"  # символы
            u"\U0001F680-\U0001F6FF"  # транспорт
            u"\U0001F700-\U0001F77F"  # алхимия
            u"\U0001F780-\U0001F7FF"  # геометрические
            u"\U0001F800-\U0001F8FF"  # стрелки
            u"\U0001F900-\U0001F9FF"  # доп. символы
            u"\U0001FA00-\U0001FA6F"  # шахматы
            u"\U0001FA70-\U0001FAFF"  # доп. символы
            u"\U00002702-\U000027B0"  # символы
            u"\U000024C2-\U0001F251"
            "]+", flags=re.UNICODE
        )
        text = emoji_pattern.sub(r'', text)
        
        # Убираем лишние пробелы
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def _get_fallback_response(self, mode: str) -> str:
        """Ответ при ошибке"""
        fallbacks = {
            'coach': "Я здесь. Давайте вместе подумаем над этим. Что вы чувствуете?",
            'psychologist': "Я с вами. Расскажите подробнее, что вас беспокоит?",
            'trainer': "Готов к работе. Сформулируйте задачу, и мы сделаем план."
        }
        return fallbacks.get(mode, fallbacks['psychologist'])
    
    def _get_profile_fallback(self, profile: Dict) -> str:
        """Запасной профиль"""
        profile_code = profile.get('profile_data', {}).get('display_name', 'СБ-4_ТФ-4_УБ-4_ЧВ-4')
        return f"""
🔑 **КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА**

Вы человек с высоким уровнем адаптивности. Умеете подстраиваться под обстоятельства и находить общий язык с разными людьми.

💪 **СИЛЬНЫЕ СТОРОНЫ**

• Высокоразвитые социальные навыки
• Способность видеть системные связи
• Устойчивость к стрессу
• Прагматизм в вопросах ресурсов

🎯 **ЗОНЫ РОСТА**

• Развитие навыков отстаивания личных границ
• Работа со спонтанностью и гибкостью
• Углубление самопонимания

⚠️ **ГЛАВНАЯ ЛОВУШКА**

Склонность к излишнему контролю. Иногда вы слишком много анализируете вместо того, чтобы действовать.

Ваш профиль: {profile_code}
"""
    
    def _get_thought_fallback(self, profile: Dict) -> str:
        """Запасная мысль психолога"""
        return "Ты часто ставишь интересы других выше своих. Но где та грань, за которой забота о других превращается в забывание о себе? Что будет, если сегодня сделать что-то только для себя?"
    
    def _get_ideas_fallback(self, profile: Dict) -> List[str]:
        """Запасные идеи на выходные"""
        return [
            "Прогулка по новому маршруту в твоём городе",
            "Встреча с друзьями в неформальной обстановке",
            "Чтение книги, которая давно ждёт своего часа",
            "Мастер-класс или воркшоп по интересной теме",
            "День без гаджетов — посвяти время себе"
        ]
    
    def _get_goals_fallback(self, profile: Dict, mode: str) -> List[Dict]:
        """Запасные цели"""
        return [
            {"id": "purpose", "name": "Найти предназначение", "time": "5-7 недель", "difficulty": "hard"},
            {"id": "balance", "name": "Обрести баланс", "time": "4-6 недель", "difficulty": "medium"},
            {"id": "growth", "name": "Личностный рост", "time": "6-8 недель", "difficulty": "medium"}
        ]
    
    def _get_questions_fallback(self) -> List[str]:
        """Запасные вопросы"""
        return [
            "Что для вас сейчас самое важное?",
            "Куда вы хотите прийти через год?",
            "Что мешает вам двигаться к цели?",
            "Какие ресурсы у вас уже есть?",
            "Что вы можете сделать уже сегодня?"
        ]
    
    def _get_avg_score(self, levels: List) -> float:
        """Среднее значение по списку уровней"""
        if not levels:
            return 3.0
        return sum(levels) / len(levels)
    
    def _find_weakest_vector(self, scores: Dict) -> Dict:
        """Находит самый слабый вектор"""
        vectors = {
            "СБ": {"name": "Реакция на давление", "level": 3},
            "ТФ": {"name": "Деньги и ресурсы", "level": 3},
            "УБ": {"name": "Понимание мира", "level": 3},
            "ЧВ": {"name": "Отношения", "level": 3}
        }
        
        for k, v in vectors.items():
            levels = scores.get(k, [])
            if levels:
                vectors[k]["level"] = sum(levels) / len(levels)
        
        weakest = min(vectors.items(), key=lambda x: x[1]["level"])
        return {"name": weakest[1]["name"], "level": weakest[1]["level"]}
    
    def _format_deep_patterns(self, patterns: Dict) -> str:
        """Форматирование глубинных паттернов"""
        if not patterns:
            return "Данные отсутствуют"
        
        lines = []
        if patterns.get('attachment'):
            lines.append(f"- Тип привязанности: {patterns['attachment']}")
        if patterns.get('defense_mechanisms'):
            lines.append(f"- Защитные механизмы: {', '.join(patterns['defense_mechanisms'])}")
        if patterns.get('core_beliefs'):
            lines.append(f"- Глубинные убеждения: {', '.join(patterns['core_beliefs'])}")
        
        return "\n".join(lines) if lines else "Данные отсутствуют"
    
    async def close(self):
        """Закрытие сессии"""
        if self.session and not self.session.closed:
            await self.session.close()
