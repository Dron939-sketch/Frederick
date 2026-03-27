"""
Планировщик выходных для веб-версии
Генерирует индивидуальные идеи на выходные с учётом профиля пользователя
"""

import logging
import random
import re
from datetime import datetime
from typing import Dict, Optional, List, Any

from services.ai_service import AIService

logger = logging.getLogger(__name__)


class WeekendPlanner:
    """
    Генератор индивидуальных идей на выходные через ИИ
    """
    
    ACTIVITY_TYPES = {
        "СБ": ["спокойные, уединённые, безопасные", "расслабляющие, без стресса", "предсказуемые, комфортные"],
        "ТФ": ["бесплатные или бюджетные", "связанные с саморазвитием и заработком", "практичные и полезные"],
        "УБ": ["интеллектуальные, развивающие", "новые, неизведанные", "глубокие, со смыслом"],
        "ЧВ": ["социальные, в компании", "душевные, тёплые", "для укрепления связей"]
    }
    
    LEVEL_DESCRIPTIONS = {
        1: "очень осторожный, избегающий стресса",
        2: "склонный к безопасному, предсказуемому",
        3: "умеренный, ищущий баланс",
        4: "готовый к экспериментам",
        5: "активный, ищущий новые впечатления",
        6: "экстремальный, жаждущий острых ощущений"
    }
    
    def __init__(self, ai_service: AIService):
        self.ai_service = ai_service
        self.cache = {}
    
    async def get_weekend_ideas(
        self, 
        user_id: int, 
        user_name: str, 
        scores: Dict, 
        profile_data: Dict, 
        context: Dict
    ) -> str:
        """Генерирует идеи на выходные"""
        
        cache_key = f"{user_id}_{datetime.now().strftime('%Y%m%d%H')}"
        if cache_key in self.cache:
            logger.info(f"📦 Использую кэшированные идеи для {user_name}")
            return self.cache[cache_key]
        
        # Определяем основной вектор
        if scores:
            main_vector = min(scores.items(), key=lambda x: x[1])[0]
            main_level = self._level(scores[main_vector])
            sorted_vectors = sorted(scores.items(), key=lambda x: x[1])
            second_vector = sorted_vectors[1][0] if len(sorted_vectors) > 1 else main_vector
        else:
            main_vector = "СБ"
            main_level = 3
            second_vector = "ЧВ"
        
        # Получаем данные пользователя
        city = context.get('city', 'ваш город')
        age = context.get('age', 30)
        gender = context.get('gender', 'other')
        
        # Формируем промпт
        prompt = self._build_prompt(
            user_name=user_name, gender=gender, age=age, city=city,
            main_vector=main_vector, main_level=main_level, second_vector=second_vector,
            scores=scores, profile_data=profile_data
        )
        
        try:
            response = await self.ai_service._call_deepseek(
                system_prompt="Ты психолог Фреди, предлагающий идеи на выходные.",
                user_prompt=prompt,
                max_tokens=1200,
                temperature=0.8
            )
            
            if response:
                formatted = self._format_response(response, user_name, main_vector)
                self.cache[cache_key] = formatted
                if len(self.cache) > 100:
                    oldest_key = min(self.cache.keys())
                    del self.cache[oldest_key]
                return formatted
            else:
                return self._fallback_ideas(main_vector, main_level, city, user_name)
                
        except Exception as e:
            logger.error(f"Ошибка генерации идей: {e}")
            return self._fallback_ideas(main_vector, main_level, city, user_name)
    
    def _build_prompt(self, user_name: str, gender: str, age: int, city: str,
                      main_vector: str, main_level: int, second_vector: str,
                      scores: dict, profile_data: dict) -> str:
        """Строит промпт для ИИ"""
        
        vector_names = {
            "СБ": "страх и безопасность",
            "ТФ": "деньги и ресурсы", 
            "УБ": "мышление и понимание мира",
            "ЧВ": "отношения и эмоциональные связи"
        }
        
        level_activity = self.LEVEL_DESCRIPTIONS.get(main_level, "умеренный")
        main_activities = random.choice(self.ACTIVITY_TYPES.get(main_vector, ["разные"]))
        second_activities = random.choice(self.ACTIVITY_TYPES.get(second_vector, ["разные"]))
        
        if gender == "male":
            address = "брат"
        elif gender == "female":
            address = "сестрёнка"
        else:
            address = "друг"
        
        return f"""
ТЫ - ПСИХОЛОГ ФРЕДИ. Предложи 3-5 индивидуальных идей на выходные для пользователя.

ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:
- Имя: {user_name}
- Возраст: {age} лет
- Город: {city}

ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ:
1. ОСНОВНОЙ ВЕКТОР: {main_vector} ({vector_names.get(main_vector, '')})
   Уровень: {main_level}/6. Характеристика: {level_activity}
   Подходят активности: {main_activities}

2. ВТОРОЙ ВЕКТОР: {second_vector} ({vector_names.get(second_vector, '')})
   Важны также: {second_activities}

Предложи 3-5 КОНКРЕТНЫХ идей на выходные для ЭТОГО ЧЕЛОВЕКА.
Идеи должны быть реальными для города {city}.
Формат: каждая идея с эмодзи и описанием в 1-2 предложения.
Напиши ТОЛЬКО идеи, без предисловий.
"""
    
    def _format_response(self, response: str, user_name: str, main_vector: str) -> str:
        """Форматирует ответ"""
        
        response = re.sub(r'\*\*(.*?)\*\*', r'\1', response)
        response = re.sub(r'__(.*?)__', r'\1', response)
        
        vector_comments = {
            "СБ": "🌿 Для тебя важно чувствовать себя в безопасности, но иногда стоит выходить из зоны комфорта.",
            "ТФ": "💰 Есть идеи на любой бюджет — от бесплатных до тех, где можно себя побаловать.",
            "УБ": "🧠 Идеи, которые заставят твой мозг работать по-новому.",
            "ЧВ": "👥 Для тебя важны люди — здесь есть идеи для компании и для уединения."
        }
        
        comment = vector_comments.get(main_vector, "✨ Выбери то, что откликается именно тебе.")
        
        return f"🌟 **{user_name}, идеи на выходные!**\n\n{comment}\n\n{response}\n\n❓ Какая идея откликается больше всего?"
    
    def _fallback_ideas(self, vector: str, level: int, city: str, user_name: str) -> str:
        """Резервные идеи"""
        
        ideas_db = {
            "СБ": [
                "🌳 Съездить в парк или лес за город — подышать, погулять, послушать тишину",
                "📚 Найти уютную кофейню с книгой и провести там пару часов",
                "🧘 Сходить на йогу или медитацию — отлично снимает напряжение"
            ],
            "ТФ": [
                "💰 Устроить день без денег — найти бесплатные развлечения в городе",
                "📝 Провести ревизию финансов и спланировать бюджет на месяц",
                "🍳 Приготовить сложное блюдо дома вместо ресторана"
            ],
            "УБ": [
                "🎬 Посмотреть фильм, который давно в списке, и записать мысли",
                "📖 Прочитать главу из книги по психологии или философии",
                "🎨 Сходить на выставку современного искусства"
            ],
            "ЧВ": [
                "👥 Организовать встречу с друзьями, с которыми давно не виделись",
                "📞 Позвонить родным просто так, без повода",
                "🤝 Сходить в гости или пригласить кого-то к себе"
            ]
        }
        
        ideas = ideas_db.get(vector, ideas_db["СБ"])
        random.shuffle(ideas)
        
        return f"🌟 **{user_name}, идеи на выходные!**\n\n" + "\n\n".join(ideas[:3]) + "\n\n❓ Хочешь больше идей?"
    
    def _level(self, score: float) -> int:
        if score <= 1.49: return 1
        elif score <= 2.00: return 2
        elif score <= 2.50: return 3
        elif score <= 3.00: return 4
        elif score <= 3.50: return 5
        else: return 6


def create_weekend_planner(ai_service: AIService) -> WeekendPlanner:
    """Создает экземпляр планировщика"""
    return WeekendPlanner(ai_service)
