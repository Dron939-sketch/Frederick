"""
Модуль для утренних вдохновляющих сообщений (3 дня)
Адаптирован для веб-версии (без aiogram)
"""

import logging
import random
import re
from datetime import datetime, timedelta
from typing import Dict, Optional, List

from services.ai_service import AIService

logger = logging.getLogger(__name__)


class MorningMessageManager:
    """Менеджер утренних сообщений для веб-версии"""
    
    def __init__(self, ai_service: AIService):
        self.ai_service = ai_service
        self.scheduled_tasks = {}
    
    async def generate_morning_message(
        self, 
        user_id: int, 
        user_name: str, 
        scores: Dict, 
        profile_data: Dict,
        context: Dict,
        day: int = 1
    ) -> str:
        """
        Генерирует утреннее сообщение для пользователя
        
        Args:
            user_id: ID пользователя
            user_name: имя
            scores: баллы по векторам
            profile_data: данные профиля
            context: контекст (город, погода, пол)
            day: день сообщения (1, 2 или 3)
        
        Returns:
            текст сообщения
        """
        # Получаем время
        now = datetime.now()
        hour = now.hour
        weekday = now.weekday()
        
        # Определяем основной вектор
        if scores:
            min_vector = min(scores.items(), key=lambda x: x[1])
            main_vector = min_vector[0]
            level = self._level(min_vector[1])
        else:
            main_vector = "СБ"
            level = 3
        
        # Описание вектора
        vector_names = {
            "СБ": "страх конфликтов и защиту границ",
            "ТФ": "отношения с деньгами и ресурсами",
            "УБ": "понимание мира и поиск смыслов",
            "ЧВ": "отношения с людьми и эмоциональные связи"
        }
        
        # Пол для обращения
        gender = context.get('gender', 'other')
        address = self._get_address(gender)
        
        # Погода
        weather_text = self._get_weather_text(context, hour)
        
        # Генерация в зависимости от дня
        if day == 1:
            greeting = self._get_greeting(hour, user_name, address)
            inspiration = self._get_profile_inspiration(scores)
            daily_tip = self._get_daily_tip(scores)
            
            return f"""
🌅 **{greeting}**

{weather_text}

{inspiration}

💡 **Совет на сегодня:**
{daily_tip}

✨ Хорошего дня!
""".strip()
        
        else:
            # Дни 2 и 3 - через ИИ
            theme = "маленькие действия и эксперименты" if day == 2 else "интеграция опыта и взгляд в будущее"
            
            prompt = self._build_ai_prompt(
                user_name=user_name,
                address=address,
                main_vector=main_vector,
                vector_desc=vector_names.get(main_vector, ""),
                level=level,
                weekday=weekday,
                hour=hour,
                weather_text=weather_text,
                day=day,
                theme=theme
            )
            
            try:
                response = await self.ai_service._call_deepseek(
                    system_prompt="Ты психолог Фреди. Напиши утреннее мотивационное сообщение.",
                    user_prompt=prompt,
                    max_tokens=800,
                    temperature=0.8
                )
                
                if response:
                    return self._format_ai_response(response, day, address)
                
            except Exception as e:
                logger.error(f"Ошибка генерации ИИ: {e}")
            
            # Запасной вариант
            return self._get_fallback_text(day, address)
    
    def _build_ai_prompt(self, user_name: str, address: str, main_vector: str,
                         vector_desc: str, level: int, weekday: int, hour: int,
                         weather_text: str, day: int, theme: str) -> str:
        """Строит промпт для ИИ"""
        
        weekdays = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
        weekday_name = weekdays[weekday] if weekday < 7 else "день"
        
        return f"""
Ты - психолог Фреди. Напиши утреннее мотивационное сообщение для пользователя.

ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:
- Имя: {user_name}
- Обращение: {address}
- Основной вектор: {main_vector} ({vector_desc})
- Уровень: {level}/6
- День недели: {weekday_name}
- Время суток: {hour} часов
- {weather_text}

КОНТЕКСТ:
- Это ДЕНЬ {day} из 3-дневной серии
- Тема дня: {theme}

ТРЕБОВАНИЯ:
1. Тёплое, поддерживающее, без нравоучений
2. Учитывай профиль пользователя
3. Используй обращение "{address}" в тексте
4. Добавь 1-2 риторических вопроса
5. Длина: 3-5 абзацев
6. НЕ ИСПОЛЬЗУЙ звёздочки, решётки, markdown

Напиши сообщение:
"""
    
    def _format_ai_response(self, text: str, day: int, address: str) -> str:
        """Форматирует ответ ИИ"""
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        
        emoji = "⚡" if day == 2 else "🌟"
        
        return f"{emoji} **Доброе утро, {address}!**\n\n{text}"
    
    def _get_fallback_text(self, day: int, address: str) -> str:
        """Запасной текст"""
        if day == 2:
            return f"""
🌅 **Доброе утро, {address}!**

Сегодня день маленьких шагов. Не надо геройства, просто одно маленькое действие в сторону того, что для тебя важно.

Помни: большие перемены начинаются с малого.

✨ Хорошего дня!
"""
        else:
            return f"""
🌅 **Доброе утро, {address}!**

Третий день нашей работы. Ты уже прошёл большой путь за это время.

Посмотри назад — ты изменился. Пусть немного, но это начало новой привычки — быть на своей стороне.

✨ Я рядом и всегда поддержу.
"""
    
    def _get_greeting(self, hour: int, user_name: str, address: str) -> str:
        """Возвращает приветствие"""
        if 5 <= hour < 12:
            greeting = "Доброе утро"
        elif 12 <= hour < 18:
            greeting = "Добрый день"
        elif 18 <= hour < 23:
            greeting = "Добрый вечер"
        else:
            greeting = "Доброй ночи"
        
        return f"{greeting}, {address if address else user_name}"
    
    def _get_address(self, gender: str) -> str:
        """Возвращает обращение по полу"""
        if gender == "male":
            return "брат"
        elif gender == "female":
            return "сестрёнка"
        return "друг"
    
    def _get_weather_text(self, context: Dict, hour: int) -> str:
        """Формирует текст о погоде"""
        if not context or not context.get('weather_cache'):
            return "За окном новый день, полный возможностей."
        
        weather = context['weather_cache']
        temp = weather.get('temp', 0)
        desc = weather.get('description', '')
        icon = weather.get('icon', '☁️')
        
        if 5 <= hour < 12:
            time_word = "утро"
        elif 12 <= hour < 18:
            time_word = "день"
        elif 18 <= hour < 23:
            time_word = "вечер"
        else:
            time_word = "ночь"
        
        if temp < -15:
            return f"{icon} Морозное {time_word}, {temp}°C. Даже в самый холод можно найти тепло внутри себя."
        elif temp < 0:
            return f"{icon} {desc}, {temp}°C. Холодно, но твоя внутренняя искра уже согревает."
        elif temp < 10:
            return f"{icon} Прохладное {time_word}, {temp}°C. Самое время для уютных мыслей и планов."
        elif temp < 20:
            return f"{icon} Свежее {time_word}, {temp}°C. Природа просыпается — как и твои новые возможности."
        elif temp < 30:
            return f"{icon} Теплое {time_word}, {temp}°C. Энергия так и плещет — лови момент!"
        else:
            return f"{icon} Жаркое {time_word}, {temp}°C. Даже солнце сегодня хочет тебя вдохновить."
    
    def _get_profile_inspiration(self, scores: Dict) -> str:
        """Вдохновение на основе профиля"""
        if not scores:
            return "Каждый день — это новая страница твоей истории."
        
        sorted_vectors = sorted(scores.items(), key=lambda x: x[1])
        weakest = sorted_vectors[0] if sorted_vectors else ("СБ", 3)
        strongest = sorted_vectors[-1] if sorted_vectors else ("ЧВ", 3)
        
        weak_vector, weak_score = weakest
        strong_vector, strong_score = strongest
        
        weak_lvl = self._level(weak_score)
        strong_lvl = self._level(strong_score)
        
        weak_inspirations = {
            "СБ": [
                f"Твоя сила не в отсутствии страха, а в умении действовать несмотря на него.",
                f"Каждый раз, когда ты встречаешь вызов, ты становишься сильнее.",
                f"Ты уже справился со многими бурями — справишься и с этой."
            ],
            "ТФ": [
                f"Деньги — это просто энергия, и ты учишься ей управлять.",
                f"Твоя ценность не в кошельке, а в том, какой ты человек.",
                f"Изобилие начинается с благодарности за то, что уже есть."
            ],
            "УБ": [
                f"Мир полон загадок, и каждая разгаданная делает тебя мудрее.",
                f"Ты не обязан всё понимать сразу — просто наблюдай.",
                f"В хаосе всегда есть порядок, просто он пока не виден."
            ],
            "ЧВ": [
                f"Самые важные отношения — это отношения с собой.",
                f"Ты достоин любви просто потому, что ты есть.",
                f"Каждая встреча — это урок, который делает тебя ближе к себе."
            ]
        }
        
        strong_inspirations = {
            "СБ": "Твоя устойчивость — это твой суперсила. Используй её, чтобы защищать не только себя, но и свои мечты.",
            "ТФ": "Твой талант управлять ресурсами может изменить не только твою жизнь, но и жизнь вокруг.",
            "УБ": "Твоя способность видеть закономерности — дар. Доверяй своей интуиции.",
            "ЧВ": "Твоя эмпатия — это мост к другим людям. Не бойся открываться."
        }
        
        weak_text = random.choice(weak_inspirations.get(weak_vector, ["Сегодня — день новых возможностей."]))
        strong_text = strong_inspirations.get(strong_vector, "")
        
        return f"{weak_text}\n\n{strong_text}"
    
    def _get_daily_tip(self, scores: Dict) -> str:
        """Совет на день на основе профиля"""
        if not scores:
            return "Найди 5 минут для себя и просто подыши."
        
        min_vector = min(scores.items(), key=lambda x: x[1])
        vector, score = min_vector
        lvl = self._level(score)
        
        tips = {
            "СБ": {
                1: "Сделай одно маленькое дело, которое откладывал.",
                2: "Скажи 'нет' тому, что тебе не нужно.",
                3: "Позволь себе не согласиться с кем-то сегодня.",
                4: "Выдохни и отпусти контроль над одной ситуацией.",
                5: "Защити не себя, а того, кто слабее.",
                6: "Используй свою силу, чтобы созидать, а не обороняться."
            },
            "ТФ": {
                1: "Запиши одну идею заработка, которая пришла в голову.",
                2: "Посмотри на свои расходы и найди одну статью для оптимизации.",
                3: "Поблагодари себя за то, что уже имеешь.",
                4: "Подумай, на что ты потратишь неожиданный доход.",
                5: "Сделай маленький шаг к финансовой цели.",
                6: "Поделись ресурсом с тем, кому он нужнее."
            },
            "УБ": {
                1: "Прочитай одну статью на новую тему.",
                2: "Задай вопрос 'почему' три раза подряд.",
                3: "Найди закономерность в своей неделе.",
                4: "Попробуй посмотреть на ситуацию глазами другого.",
                5: "Запиши одну мысль, которая кажется важной.",
                6: "Поделись своим пониманием с кем-то."
            },
            "ЧВ": {
                1: "Напиши близкому человеку просто так.",
                2: "Скажи комплимент незнакомцу.",
                3: "Выслушай кого-то, не перебивая.",
                4: "Попроси о помощи, если она нужна.",
                5: "Поблагодари того, кто это заслужил.",
                6: "Обними того, кто рядом."
            }
        }
        
        vector_tips = tips.get(vector, {})
        return vector_tips.get(lvl, "Сделай что-то хорошее для себя сегодня.")
    
    def _level(self, score: float) -> int:
        """Дробный балл → целый уровень 1-6"""
        if score <= 1.49:
            return 1
        elif score <= 2.00:
            return 2
        elif score <= 2.50:
            return 3
        elif score <= 3.00:
            return 4
        elif score <= 3.50:
            return 5
        else:
            return 6


def create_morning_manager(ai_service: AIService) -> MorningMessageManager:
    """Создает экземпляр менеджера утренних сообщений"""
    return MorningMessageManager(ai_service)
