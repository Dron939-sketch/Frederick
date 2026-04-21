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
        Генерирует утреннее сообщение для пользователя.

        day: 1..5 — день недели (1=пн, 2=вт, 3=ср, 4=чт, 5=пт).
        Для day=5 (пятница) генерируется weekend-message с идеями на выходные.
        Для day=1 без AI используется быстрый шаблон.
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

        # Пятница → weekend message
        if day == 5:
            return await self._generate_weekend_message(
                user_name=user_name, address=address, scores=scores,
                main_vector=main_vector, level=level,
                weather_text=weather_text, hour=hour
            )

        # Понедельник (day=1) — быстрый шаблон без AI.
        # Используем ту же структуру «про мир», что и для вт-чт, только из статической библиотеки.
        if day == 1:
            greeting = self._get_greeting(hour, user_name, address)
            world_paragraph = self._get_world_observation(day=1)
            return f"""🌅 **{greeting}!**

{weather_text}

{world_paragraph}""".strip()

        # Дни 2-4 (вт, ср, чт) — через AI с темой дня
        weekday_themes = {
            2: ("вторник — фокус на действии", "энергия движения"),
            3: ("среда — середина недели", "не сдавайся, ты идёшь"),
            4: ("четверг — финишная прямая", "осознанность результата"),
        }
        theme_pair = weekday_themes.get(day, ("обычный день", "поддержка"))
        theme = f"{theme_pair[0]}; настроение: {theme_pair[1]}"

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
                system_prompt="Ты психолог Фреди. Напиши КОРОТКОЕ утреннее мотивационное сообщение.",
                user_prompt=prompt,
                max_tokens=350,
                temperature=0.8
            )

            if response:
                return self._format_ai_response(response, day, address, user_name, weather_text)

        except Exception as e:
            logger.error(f"Ошибка генерации ИИ: {e}")

        # Запасной вариант — статическая версия того же стиля «про мир»
        return self._get_fallback_text(day, address, user_name, weather_text)
    
    def _build_ai_prompt(self, user_name: str, address: str, main_vector: str,
                         vector_desc: str, level: int, weekday: int, hour: int,
                         weather_text: str, day: int, theme: str) -> str:
        """Промпт: мотивашка «про мир», без прямых советов человеку."""

        weekdays = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
        weekday_name = weekdays[weekday] if weekday < 7 else "день"

        return f"""
Ты — рассказчик Фреди. Напиши короткий наблюдательный абзац про мир в это утро.

ДЕНЬ НЕДЕЛИ: {weekday_name}.

СТРОГИЙ ФОРМАТ (3 предложения, 35-55 слов ВСЕГО):
1) Начни с "Сегодня {weekday_name} — и где-то сейчас…" и приведи 2-3 бытовые сцены из жизни других людей или природы (пекарь достаёт хлеб; кто-то делает глоток кофе; голуби на карнизе; первый автобус выходит из депо; дворник разгоняет лужу; свет зажигается в окне напротив). Не повторяй примеры буквально — придумай свои, но такие же обычные и видимые.
2) Средняя фраза — ещё одно наблюдение: природа, время года, движение жизни, сезонная деталь. Без "ты" и без советов.
3) Закрывающая фраза — общий образ вроде "Мир состоит из миллионов маленьких начал, и одно из них — твоё", "Всё важное происходит без спешки", "Из таких минут и складывается день". Можно свою, в этом духе. В последней фразе допустимо ОДИН раз косвенно упомянуть читателя ("одно из них — твоё", "ты тоже в этом потоке"), но без похвал и советов.

ЗАПРЕЩЕНО:
- обращаться напрямую: "ты сильная/сильный", "ты справишься", "верю в тебя", "помни, что…"
- задавать риторические вопросы
- давать советы и инструкции
- писать о характере читателя, его пути, его росте
- использовать markdown (звёздочки, решётки), эмодзи, восклицания в каждом предложении
- слова "мотивация", "поддержка", "психология"

ТОН: тихий, наблюдательный, как у доброго рассказчика. Без пафоса.
НЕ ДОБАВЛЯЙ подпись или прощание — только 3 предложения.

Напиши абзац:
"""
    
    def _format_ai_response(self, text: str, day: int, address: str,
                             user_name: str = "", weather_text: str = "") -> str:
        """Форматирует ответ ИИ. Всегда вставляет погоду между приветствием
        и AI-текстом — чтобы блок «за окном…» был во все дни, не только
        в понедельнике."""
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)

        emoji_by_day = {2: "⚡", 3: "🌤", 4: "🚀", 5: "🌟"}
        emoji = emoji_by_day.get(day, "🌅")

        name = (user_name or "").strip()
        salute = name if name and name.lower() not in ("друг", "подруга", "") else (address or "друг")

        header = f"{emoji} **Доброе утро, {salute}!**"
        weather = (weather_text or "").strip()
        if weather:
            return f"{header}\n\n{weather}\n\n{text}"
        return f"{header}\n\n{text}"

    async def _generate_weekend_message(
        self, user_name: str, address: str, scores: Dict,
        main_vector: str, level: int, weather_text: str, hour: int
    ) -> str:
        """
        Генерирует пятничное сообщение: тёплое утро + 3 короткие идеи
        на выходные с учётом слабого вектора пользователя.
        """
        vector_names = {
            "СБ": "укрепить границы и устойчивость",
            "ТФ": "ресурсы и финансовая осознанность",
            "УБ": "понимание мира и поиск смыслов",
            "ЧВ": "тёплые отношения и эмпатия"
        }
        vector_desc = vector_names.get(main_vector, "психологический рост")

        prompt = f"""
Ты - психолог Фреди. Сегодня ПЯТНИЦА. Напиши КОРОТКОЕ утреннее сообщение
с идеями на выходные для пользователя.

ПОЛЬЗОВАТЕЛЬ:
- Имя: {user_name}, обращение: {address}
- Слабый вектор: {main_vector} ({vector_desc}), уровень {level}/6
- {weather_text}

СТРУКТУРА (СТРОГО):
1. Одна короткая тёплая фраза-приветствие про пятницу (10-15 слов)
2. Три конкретные идеи на выходные — по одной строке каждая, начинай с "•"
3. Идеи должны помогать развивать слабый вектор {main_vector}
4. Идеи разные: что-то для тела, что-то для ума, что-то для души/общения
5. Одна короткая ободряющая фраза в конце (5-10 слов)

ОГРАНИЧЕНИЯ:
- ВСЕГО 60-90 слов (не больше!)
- НЕ используй markdown (звёздочки, решётки)
- Используй обращение "{address}" один раз — в приветствии
- Без воды, конкретно
"""

        try:
            response = await self.ai_service._call_deepseek(
                system_prompt="Ты психолог Фреди. Пятничное утреннее сообщение с идеями на выходные.",
                user_prompt=prompt,
                max_tokens=400,
                temperature=0.85
            )

            if response:
                cleaned = re.sub(r'\*\*(.*?)\*\*', r'\1', response)
                cleaned = re.sub(r'__(.*?)__', r'\1', cleaned)
                name = (user_name or "").strip()
                salute = name if name and name.lower() not in ("друг", "подруга", "") else (address or "друг")
                weather = (weather_text or "").strip()
                header = f"🎉 **Доброе утро, {salute}!**"
                if weather:
                    return f"{header}\n\n{weather}\n\n{cleaned.strip()}"
                return f"{header}\n\n{cleaned.strip()}"

        except Exception as e:
            logger.error(f"Ошибка генерации weekend-message: {e}")

        # Fallback — статические идеи по вектору
        fallback_ideas = {
            "СБ": [
                "Прогулка в новом для тебя месте — почувствуй опору",
                "Скажи 'нет' одной просьбе, на которую обычно соглашаешься",
                "Запиши 3 границы, которые хочешь укрепить"
            ],
            "ТФ": [
                "Разобрать расходы за неделю и поблагодарить себя",
                "Прочитать одну статью или главу про деньги",
                "Сделать маленький подарок себе в рамках бюджета"
            ],
            "УБ": [
                "Посмотреть документальный фильм на новую тему",
                "Записать одну мысль, которая сегодня кажется важной",
                "Поговорить с тем, кто старше и мудрее"
            ],
            "ЧВ": [
                "Позвонить близкому человеку просто так",
                "Встретиться с другом, которого давно не видел",
                "Написать письмо благодарности — себе или другому"
            ]
        }
        ideas = fallback_ideas.get(main_vector, fallback_ideas["ЧВ"])
        ideas_text = "\n".join(f"• {idea}" for idea in ideas)
        name = (user_name or "").strip()
        salute = name if name and name.lower() not in ("друг", "подруга", "") else (address or "друг")
        weather = (weather_text or "").strip()
        header = f"🎉 **Доброе утро, {salute}!**"
        body = (
            f"Пятница — твоё время сделать паузу и побыть с собой. "
            f"Вот идеи на выходные:\n\n{ideas_text}\n\nХороших выходных! ✨"
        )
        if weather:
            return f"{header}\n\n{weather}\n\n{body}"
        return f"{header}\n\n{body}"

    def _get_fallback_text(self, day: int, address: str,
                            user_name: str = "", weather_text: str = "") -> str:
        """Запасной текст для дней 2-4, если AI недоступен. Стиль «про мир».
        Включает блок погоды, если передан."""
        name = (user_name or "").strip()
        salute = name if name and name.lower() not in ("друг", "подруга", "") else (address or "друг")
        world_paragraph = self._get_world_observation(day=day)
        weather = (weather_text or "").strip()
        if weather:
            return f"🌅 **Доброе утро, {salute}!**\n\n{weather}\n\n{world_paragraph}".strip()
        return f"🌅 **Доброе утро, {salute}!**\n\n{world_paragraph}".strip()

    def _get_world_observation(self, day: int) -> str:
        """Статический пул «про-мирных» наблюдений, по дням недели."""
        weekday_map = {1: "понедельник", 2: "вторник", 3: "среда", 4: "четверг", 5: "пятница"}
        weekday_name = weekday_map.get(day, "день")

        pool = {
            1: [
                (
                    f"Сегодня {weekday_name} — и где-то сейчас пекарь достаёт первую партию хлеба, "
                    f"кто-то делает глоток кофе, кто-то только-только открыл глаза. "
                    f"Мир состоит из миллионов маленьких начал, и одно из них — твоё."
                ),
                (
                    f"Сегодня {weekday_name} — и где-то сейчас первый автобус выходит из депо, "
                    f"в окнах напротив зажигается свет, кто-то завязывает шнурки перед пробежкой. "
                    f"День начинается без громких объявлений — и ты тоже в нём."
                ),
            ],
            2: [
                (
                    f"Сегодня {weekday_name} — и где-то сейчас учительница пишет тему урока на доске, "
                    f"продавщица ставит первые яблоки в корзину, почтальон сортирует письма. "
                    f"Из таких маленьких действий и складывается день."
                ),
                (
                    f"Сегодня {weekday_name} — и где-то сейчас водитель трамвая проверяет зеркала, "
                    f"на кухне кипит чайник, двор оживает голосами детей. "
                    f"Всё важное в мире делается без спешки."
                ),
            ],
            3: [
                (
                    f"Сегодня {weekday_name} — середина недели, и где-то сейчас кто-то заваривает третий за утро кофе, "
                    f"кто-то вешает табличку «открыто», голуби перелетают с карниза на карниз. "
                    f"Жизнь не ставит паузу на середину — просто идёт."
                ),
                (
                    f"Сегодня {weekday_name} — и где-то сейчас лифт везёт кого-то на пятый этаж, "
                    f"в парке дворник собирает опавшие листья, в булочной кончаются круассаны. "
                    f"Мир продолжается в тысячах маленьких движений — и твоё в нём тоже."
                ),
            ],
            4: [
                (
                    f"Сегодня {weekday_name} — и где-то сейчас кто-то заканчивает отчёт, "
                    f"кто-то только встал к плите, кто-то ждёт автобус на остановке. "
                    f"Из этих минут и собирается неделя."
                ),
                (
                    f"Сегодня {weekday_name} — и где-то сейчас свежий выпуск газеты падает в почтовый ящик, "
                    f"кто-то поливает цветок на окне, кто-то выходит с собакой во двор. "
                    f"Обычное утро — и одно из них твоё."
                ),
            ],
        }

        options = pool.get(day, pool[1])
        return random.choice(options)
    
    def _get_greeting(self, hour: int, user_name: str, address: str) -> str:
        """Возвращает приветствие с обращением по имени.

        Приоритет: настоящее имя > обращение (брат/сестрёнка/друг) > "друг".
        """
        if 5 <= hour < 12:
            greeting = "Доброе утро"
        elif 12 <= hour < 18:
            greeting = "Добрый день"
        elif 18 <= hour < 23:
            greeting = "Добрый вечер"
        else:
            greeting = "Доброй ночи"

        name = (user_name or "").strip()
        # Не приветствуем "другом" — если нет имени, оставляем address (брат/сестрёнка/друг).
        if name and name.lower() not in ("друг", "подруга", ""):
            return f"{greeting}, {name}"
        return f"{greeting}, {address or 'друг'}"
    
    def _get_address(self, gender: str) -> str:
        """Возвращает обращение по полу"""
        if gender == "male":
            return "брат"
        elif gender == "female":
            return "сестрёнка"
        return "друг"
    
    def _get_weather_text(self, context: Dict, hour: int) -> str:
        """Формирует текст о погоде «за окном».

        Поддерживает два формата weather_cache:
          - legacy (models.py): {temp, description, icon, ...}
          - новый (WeatherService): {temperature, description, icon, city, ...}
        """
        weather = (context or {}).get('weather_cache') or None
        if not weather or not isinstance(weather, dict):
            return "За окном новый день, полный возможностей."

        # Совместимость: temperature → temp → 0
        temp = weather.get('temperature')
        if temp is None:
            temp = weather.get('temp')
        if temp is None:
            return "За окном новый день, полный возможностей."
        try:
            temp = int(round(float(temp)))
        except (TypeError, ValueError):
            return "За окном новый день, полный возможностей."

        desc = (weather.get('description') or '').strip()
        icon = weather.get('icon') or '☁️'
        city = (weather.get('city') or (context or {}).get('city') or '').strip()
        city_part = f" в городе {city}" if city else ""
        desc_part = f" {desc}," if desc else ""

        if 5 <= hour < 12:
            time_word = "утро"
        elif 12 <= hour < 18:
            time_word = "день"
        elif 18 <= hour < 23:
            time_word = "вечер"
        else:
            time_word = "ночь"

        if temp < -15:
            mood = "Даже в самый холод можно найти тепло внутри себя."
            time_adj = "Морозное"
        elif temp < 0:
            mood = "Холодно, но твоя внутренняя искра уже согревает."
            time_adj = "Холодное"
        elif temp < 10:
            mood = "Самое время для уютных мыслей и планов."
            time_adj = "Прохладное"
        elif temp < 20:
            mood = "Природа просыпается — как и твои новые возможности."
            time_adj = "Свежее"
        elif temp < 30:
            mood = "Энергия так и плещет — лови момент!"
            time_adj = "Тёплое"
        else:
            mood = "Даже солнце сегодня хочет тебя вдохновить."
            time_adj = "Жаркое"

        return f"{icon} За окном{city_part}{desc_part} {temp}°C — {time_adj.lower()} {time_word}. {mood}"
    
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
