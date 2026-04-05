"""
Утилиты для работы с контекстом, целями и проверкой реальности
Адаптировано для веб-проекта Фреди
"""

import logging
import re
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


# ============================================
# ПРОВЕРКА РЕАЛЬНОСТИ ЦЕЛЕЙ
# ============================================

def get_theoretical_path(goal_id: str, mode: str) -> Dict[str, Any]:
    """
    Возвращает теоретический путь к цели
    
    Args:
        goal_id: идентификатор цели
        mode: режим (coach, psychologist, trainer)
    
    Returns:
        словарь с описанием пути
    """
    paths = {
        "income_growth": {
            "formatted_text": "📍 ЭТАП 1: ДИАГНОСТИКА\n   • Что делаем: анализируем текущий доход и расходы\n   • 📝 Домашнее задание: записать все источники дохода за месяц\n   • ✅ Критерий: есть полная картина финансов\n\n📍 ЭТАП 2: АНАЛИЗ ВОЗМОЖНОСТЕЙ\n   • Что делаем: ищем точки роста и новые источники дохода\n   • 📝 Домашнее задание: составить список из 10 идей увеличения дохода\n   • ✅ Критерий: есть 3-5 реалистичных вариантов\n\n📍 ЭТАП 3: ПЛАН ДЕЙСТВИЙ\n   • Что делаем: выбираем один вариант и составляем план\n   • 📝 Домашнее задание: разбить цель на недельные шаги\n   • ✅ Критерий: есть конкретный план на 3 месяца",
            "steps": ["Диагностика", "Анализ возможностей", "План действий"]
        },
        "fear_work": {
            "formatted_text": "📍 ЭТАП 1: ОСОЗНАНИЕ\n   • Что делаем: выявляем страхи и их источники\n   • 📝 Домашнее задание: записать 5 ситуаций, где возникает страх\n   • ✅ Критерий: список конкретных страхов\n\n📍 ЭТАП 2: РАБОТА С ТЕЛОМ\n   • Что делаем: учимся отслеживать телесные реакции на страх\n   • 📝 Домашнее задание: ежедневная практика заземления\n   • ✅ Критерий: умею замечать начало тревоги\n\n📍 ЭТАП 3: МАЛЕНЬКИЕ ШАГИ\n   • Что делаем: постепенно сталкиваемся со страхами\n   • 📝 Домашнее задание: одно действие из зоны страха в неделю\n   • ✅ Критерий: сделано 3-5 действий",
            "steps": ["Осознание", "Работа с телом", "Маленькие шаги"]
        },
        "balance": {
            "formatted_text": "📍 ЭТАП 1: АУДИТ ВРЕМЕНИ\n   • Что делаем: анализируем, куда уходит время\n   • 📝 Домашнее задание: записывать все дела в течение недели\n   • ✅ Критерий: понимание реальной структуры времени\n\n📍 ЭТАП 2: РАССТАНОВКА ПРИОРИТЕТОВ\n   • Что делаем: определяем, что действительно важно\n   • 📝 Домашнее задание: матрица Эйзенхауэра\n   • ✅ Критерий: чёткие приоритеты\n\n📍 ЭТАП 3: НОВЫЕ ПРИВЫЧКИ\n   • Что делаем: внедряем границы между работой и отдыхом\n   • 📝 Домашнее задание: 30 минут личного времени каждый день\n   • ✅ Критерий: новая привычка закреплена",
            "steps": ["Аудит времени", "Расстановка приоритетов", "Новые привычки"]
        },
        "self_discovery": {
            "formatted_text": "📍 ЭТАП 1: ИССЛЕДОВАНИЕ СЕБЯ\n   • Что делаем: ведём дневник мыслей и чувств\n   • 📝 Домашнее задание: ежедневные записи в течение 7 дней\n   • ✅ Критерий: заметили повторяющиеся паттерны\n\n📍 ЭТАП 2: ЦЕННОСТИ\n   • Что делаем: определяем свои истинные ценности\n   • 📝 Домашнее задание: список из 10 ценностей\n   • ✅ Критерий: топ-3 ценности\n\n📍 ЭТАП 3: ИНТЕГРАЦИЯ\n   • Что делаем: соединяем ценности с повседневной жизнью\n   • 📝 Домашнее задание: одно действие в день, соответствующее ценностям\n   • ✅ Критерий: чувство соответствия себе",
            "steps": ["Исследование", "Ценности", "Интеграция"]
        },
        "purpose": {
            "formatted_text": "📍 ЭТАП 1: РЕФЛЕКСИЯ\n   • Что делаем: вспоминаем моменты счастья и вдохновения\n   • 📝 Домашнее задание: список из 20 моментов\n   • ✅ Критерий: понимание, что вас зажигает\n\n📍 ЭТАП 2: ЭКСПЕРИМЕНТЫ\n   • Что делаем: пробуем разные направления\n   • 📝 Домашнее задание: 5 маленьких экспериментов\n   • ✅ Критерий: 1-2 направления для углубления\n\n📍 ЭТАП 3: СЛЕДОВАНИЕ\n   • Что делаем: включаем найденное в жизнь\n   • 📝 Домашнее задание: регулярная практика\n   • ✅ Критерий: ощущение движения к призванию",
            "steps": ["Рефлексия", "Эксперименты", "Следование"]
        }
    }
    
    default_path = {
        "formatted_text": "📍 ЭТАП 1: ОПРЕДЕЛЕНИЕ ЦЕЛИ\n   • Что делаем: формулируем цель чётко и измеримо\n   • 📝 Домашнее задание: записать цель в формате SMART\n   • ✅ Критерий: цель ясна и понятна\n\n📍 ЭТАП 2: ПЛАНИРОВАНИЕ\n   • Что делаем: разбиваем цель на этапы\n   • 📝 Домашнее задание: создать пошаговый план\n   • ✅ Критерий: план готов к выполнению\n\n📍 ЭТАП 3: ДЕЙСТВИЕ\n   • Что делаем: начинаем с первого шага\n   • 📝 Домашнее задание: выполнить первый шаг\n   • ✅ Критерий: первый шаг сделан",
        "steps": ["Определение цели", "Планирование", "Действие"]
    }
    
    return paths.get(goal_id, default_path)


def generate_life_context_questions() -> str:
    """
    Генерирует вопросы о жизненном контексте
    """
    return """
1️⃣ Семейное положение? (женат/замужем/холост/в отношениях)

2️⃣ Есть ли дети? (сколько, какого возраста)

3️⃣ График работы? (сколько часов в день/неделю, гибкий/фиксированный)

4️⃣ Как добираетесь до работы? (сколько времени, какой транспорт)

5️⃣ Тип жилья? (своя квартира/аренда/с родителями)

6️⃣ Есть ли личное пространство? (комната/рабочее место)

7️⃣ Есть ли автомобиль?

8️⃣ Кто поддерживает? (друзья/семья/партнёр)

9️⃣ Кто сопротивляется? (кто может мешать)

🔟 Уровень энергии? (оцените от 1 до 10)
"""


def generate_goal_context_questions(goal_id: str, profile: Dict, mode: str, goal_name: str) -> str:
    """
    Генерирует вопросы для контекста цели
    
    Args:
        goal_id: идентификатор цели
        profile: данные профиля пользователя
        mode: режим (coach, psychologist, trainer)
        goal_name: название цели
    
    Returns:
        строка с вопросами
    """
    questions = f"""
🎯 **УТОЧНЯЮЩИЕ ВОПРОСЫ ДЛЯ ЦЕЛИ: {goal_name}**

1️⃣ Сколько часов в неделю вы готовы уделять этой цели?

2️⃣ Какой бюджет вы готовы вложить? (деньги, время, ресурсы)

3️⃣ Какие ресурсы у вас уже есть для достижения этой цели?

4️⃣ Что может помешать? (какие препятствия)

5️⃣ Кто может помочь? (поддержка)

6️⃣ Что будет, если вы достигнете эту цель? (что изменится)

7️⃣ Что будет, если не достигнете? (цена бездействия)
"""
    
    # Персонализация под профиль
    if profile.get("behavioral_levels"):
        sb_levels = profile.get("behavioral_levels", {}).get("СБ", [])
        if sb_levels and min(sb_levels) <= 2:
            questions += "\n\n8️⃣ Что самое страшное может случиться, если вы начнёте действовать?"
    
    return questions


def calculate_feasibility(path: Dict, life_context: Dict, goal_context: Dict, profile: Dict) -> Dict[str, Any]:
    """
    Рассчитывает достижимость цели
    
    Args:
        path: теоретический путь
        life_context: жизненный контекст
        goal_context: контекст цели
        profile: профиль пользователя
    
    Returns:
        словарь с результатами проверки
    """
    # Извлекаем данные
    time_per_week = goal_context.get("time_per_week", 5)
    budget = goal_context.get("budget", 0)
    energy_level = life_context.get("energy_level", 5)
    
    # Рассчитываем дефицит
    required_time = 8  # оптимальное время в неделю
    time_deficit = max(0, required_time - time_per_week)
    
    required_energy = 7
    energy_deficit = max(0, required_energy - energy_level)
    
    total_deficit = min(100, int((time_deficit + energy_deficit) / 14 * 100))
    
    # Определяем статус
    if total_deficit <= 20:
        status = "✅"
        status_text = "ОТЛИЧНО! Цель достижима"
        recommendation = "У вас достаточно ресурсов. Начинайте прямо сейчас!"
    elif total_deficit <= 50:
        status = "⚠️"
        status_text = "РЕАЛЬНО, НО НУЖНЫ УСИЛИЯ"
        recommendation = "Дефицит ресурсов не критичен. Начните с малого и увеличивайте нагрузку постепенно."
    else:
        status = "❌"
        status_text = "СЛОЖНО, НУЖНА КОРРЕКТИРОВКА"
        recommendation = "Рекомендуем увеличить время, снизить планку или проработать энергетические ресурсы."
    
    # Формируем тексты
    requirements_text = f"""• Время: {required_time} часов/неделю
• Энергия: {required_energy}/10
• Навыки: базовые
• Дисциплина: регулярность"""
    
    available_text = f"""• Время: {time_per_week} часов/неделю
• Энергия: {energy_level}/10
• Бюджет: {budget} руб."""
    
    return {
        "status": status,
        "status_text": status_text,
        "requirements_text": requirements_text,
        "available_text": available_text,
        "deficit": total_deficit,
        "recommendation": recommendation
    }


def parse_life_context_answers(text: str) -> Dict[str, Any]:
    """
    Парсит ответы о жизненном контексте
    
    Args:
        text: текст ответа
    
    Returns:
        словарь с распарсенными данными
    """
    result = {
        "family_status": "не указано",
        "has_children": False,
        "children_info": "",
        "work_schedule": "не указано",
        "job_title": "не указано",
        "commute_time": "не указано",
        "housing_type": "не указано",
        "has_private_space": False,
        "has_car": False,
        "support_people": "",
        "resistance_people": "",
        "energy_level": 5
    }
    
    lines = text.strip().split('\n')
    answers = []
    
    for line in lines:
        # Убираем нумерацию
        clean = re.sub(r'^[\d️⃣🔟\)]\s*', '', line.strip())
        clean = re.sub(r'^\d+\.\s*', '', clean)
        if clean:
            answers.append(clean)
    
    # Заполняем данные (упрощённо)
    if len(answers) >= 1:
        result["family_status"] = answers[0][:50]
    if len(answers) >= 2:
        result["has_children"] = "есть" in answers[1].lower() or "ребён" in answers[1].lower()
        result["children_info"] = answers[1][:100]
    if len(answers) >= 3:
        result["work_schedule"] = answers[2][:100]
    if len(answers) >= 4:
        result["commute_time"] = answers[3][:50]
    if len(answers) >= 5:
        result["housing_type"] = answers[4][:50]
    if len(answers) >= 6:
        result["has_private_space"] = "да" in answers[5].lower() or "есть" in answers[5].lower()
    if len(answers) >= 7:
        result["has_car"] = "да" in answers[6].lower() or "есть" in answers[6].lower()
    if len(answers) >= 8:
        result["support_people"] = answers[7][:200]
    if len(answers) >= 9:
        result["resistance_people"] = answers[8][:200]
    
    # Ищем уровень энергии
    if len(answers) >= 10:
        try:
            numbers = re.findall(r'\d+', answers[9])
            if numbers:
                result["energy_level"] = min(10, max(1, int(numbers[0])))
        except Exception:
            pass

    return result


def parse_goal_context_answers(text: str) -> Dict[str, Any]:
    """
    Парсит ответы о контексте цели
    
    Args:
        text: текст ответа
    
    Returns:
        словарь с распарсенными данными
    """
    result = {
        "raw_answers": text,
        "time_per_week": 5,
        "budget": 0,
        "existing_resources": "",
        "obstacles": "",
        "support": "",
        "positive_outcome": "",
        "negative_outcome": ""
    }
    
    lines = text.strip().split('\n')
    answers = []
    
    for line in lines:
        # Убираем нумерацию
        clean = re.sub(r'^[\d️⃣🔟\)]\s*', '', line.strip())
        clean = re.sub(r'^\d+\.\s*', '', clean)
        if clean:
            answers.append(clean)
    
    # Извлекаем время
    if len(answers) >= 1:
        numbers = re.findall(r'\d+', answers[0])
        if numbers:
            result["time_per_week"] = int(numbers[0])
    
    # Извлекаем бюджет
    if len(answers) >= 2:
        numbers = re.findall(r'\d+', answers[1])
        if numbers:
            result["budget"] = int(numbers[0])
    
    # Остальные поля
    if len(answers) >= 3:
        result["existing_resources"] = answers[2][:200]
    if len(answers) >= 4:
        result["obstacles"] = answers[3][:200]
    if len(answers) >= 5:
        result["support"] = answers[4][:200]
    if len(answers) >= 6:
        result["positive_outcome"] = answers[5][:200]
    if len(answers) >= 7:
        result["negative_outcome"] = answers[6][:200]
    
    return result


def get_goal_difficulty(goal_id: str) -> str:
    """
    Возвращает сложность цели
    
    Args:
        goal_id: идентификатор цели
    
    Returns:
        "easy", "medium" или "hard"
    """
    difficulties = {
        "income_growth": "hard",
        "fear_work": "medium",
        "balance": "medium",
        "self_discovery": "hard",
        "purpose": "hard",
        "habit_building": "easy",
        "skill_mastery": "medium"
    }
    return difficulties.get(goal_id, "medium")


def get_goal_time_estimate(goal_id: str) -> str:
    """
    Возвращает оценку времени на цель
    
    Args:
        goal_id: идентификатор цели
    
    Returns:
        строка с оценкой времени
    """
    times = {
        "income_growth": "4-6 месяцев",
        "fear_work": "3-4 недели",
        "balance": "4-6 недель",
        "self_discovery": "6-8 недель",
        "purpose": "2-3 месяца",
        "habit_building": "3-4 недели",
        "skill_mastery": "2-3 месяца"
    }
    return times.get(goal_id, "3-6 недель")


def save_feasibility_result(user_id: int, result: Dict) -> bool:
    """
    Сохраняет результат проверки реальности
    
    Args:
        user_id: ID пользователя
        result: результат проверки
    
    Returns:
        True при успехе, False при ошибке
    """
    try:
        # Здесь можно сохранить в БД
        logger.info(f"Saving feasibility result for user {user_id}: deficit={result.get('deficit')}%")
        return True
    except Exception as e:
        logger.error(f"Error saving feasibility result: {e}")
        return False


# ============================================
# УТРЕННИЕ СООБЩЕНИЯ
# ============================================

class MorningMessageManager:
    """Менеджер утренних сообщений"""
    
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
        Генерирует утреннее сообщение
        
        Args:
            user_id: ID пользователя
            user_name: имя
            scores: баллы по векторам
            profile_data: данные профиля
            context: контекст (город, погода)
            day: день сообщения (1, 2 или 3)
        
        Returns:
            текст сообщения
        """
        # Определяем основной вектор
        if scores:
            min_vector = min(scores.items(), key=lambda x: x[1])[0]
        else:
            min_vector = "СБ"
        
        # Пол для обращения
        gender = context.get('gender', 'other')
        if gender == "male":
            address = "брат"
        elif gender == "female":
            address = "сестрёнка"
        else:
            address = "друг"
        
        # Погода
        weather_text = ""
        if context.get('weather_cache'):
            weather = context['weather_cache']
            temp = weather.get('temperature', 0)
            desc = weather.get('description', '')
            weather_text = f"🌡️ {desc}, {temp}°C"
        
        # Сообщение для дня 1
        if day == 1:
            return f"""
🌅 **Доброе утро, {address}!**

{weather_text}

Каждый день — это новая страница. Сегодня у тебя есть шанс написать что-то важное.

💡 **Совет на сегодня:**
Найди 5 минут для себя. Просто подыши. Почувствуй своё тело. Заметь, что происходит внутри.

✨ Хорошего дня!
"""
        
        # Сообщение для дня 2
        elif day == 2:
            return f"""
🌅 **Доброе утро, {address}!**

{weather_text}

Вчера ты сделал первый шаг. Сегодня — продолжение. Не жди идеального момента, он не наступит.

💡 **Совет на сегодня:**
Сделай одно маленькое действие в сторону того, что для тебя важно. Любое.

✨ Ты справишься!
"""
        
        # Сообщение для дня 3
        else:
            return f"""
🌅 **Доброе утро, {address}!**

{weather_text}

Ты уже прошёл путь. Посмотри назад — что изменилось? Даже если чуть-чуть, это уже начало.

💡 **Совет на сегодня:**
Запиши одну мысль, которая пришла за эти дни. Что было самым важным?

✨ Я рядом. Дыши.
"""


# ============================================
# ПЛАНИРОВЩИК ВЫХОДНЫХ
# ============================================

class WeekendPlanner:
    """Планировщик выходных"""
    
    def __init__(self):
        self.cache = {}
    
    async def get_weekend_ideas(
        self,
        user_id: int,
        user_name: str,
        scores: Dict,
        profile_data: Dict,
        context: Dict
    ) -> str:
        """
        Генерирует идеи на выходные
        
        Args:
            user_id: ID пользователя
            user_name: имя
            scores: баллы по векторам
            profile_data: данные профиля
            context: контекст (город, погода)
        
        Returns:
            текст с идеями
        """
        # Определяем основной вектор
        if scores:
            min_vector = min(scores.items(), key=lambda x: x[1])[0]
        else:
            min_vector = "СБ"
        
        # Идеи для разных векторов
        ideas_db = {
            "СБ": [
                "🌳 **Прогулка в парке или лесу** — найди тихое место, побудь в покое, послушай природу.",
                "📚 **День с любимой книгой** — выключи телефон, завари чай и погрузись в чтение.",
                "🧘 **Йога или медитация** — найди студию или видео, посвяти время себе.",
                "🛁 **Домашний спа-день** — ванна с солью, маска для лица, любимая музыка."
            ],
            "ТФ": [
                "💰 **День без трат** — найди бесплатные радости: парк, прогулка, библиотека.",
                "📊 **Разбери финансы** — посмотри на доходы и расходы, составь бюджет на месяц.",
                "🍳 **Приготовь сложное блюдо** — дешевле и вкуснее, чем в ресторане.",
                "🎓 **Бесплатный мастер-класс** — в соцсетях много бесплатных уроков."
            ],
            "УБ": [
                "🎬 **Посмотри фильм-загадку** — что-то, что заставит думать и анализировать.",
                "📖 **Прочитай главу из новой книги** — расширяй горизонты.",
                "🎨 **Сходи на выставку** — посмотри на мир чужими глазами.",
                "🧩 **Реши головоломку или квест** — тренируй мозг."
            ],
            "ЧВ": [
                "👥 **Встреча с друзьями** — позови тех, кого давно не видел.",
                "📞 **Позвони родным** — просто так, без повода.",
                "🤝 **Сходи в гости** или пригласи кого-то к себе.",
                "💬 **Напиши старым знакомым** — узнай, как у них дела."
            ]
        }
        
        ideas = ideas_db.get(min_vector, ideas_db["СБ"])
        
        # Получаем город для персонализации
        city = context.get('city', '')
        
        # Формируем текст
        text = f"🌟 **{user_name}, идеи на выходные!**\n\n"
        
        for idea in ideas[:3]:
            text += f"{idea}\n\n"
        
        if city:
            text += f"📍 В {city} можно найти интересные места по этим темам.\n\n"
        
        text += "❓ Какая идея откликается больше всего? Могу рассказать подробнее."
        
        return text


def get_weekend_planner() -> WeekendPlanner:
    """Возвращает экземпляр планировщика"""
    return WeekendPlanner()


# ============================================
# ЭКСПОРТ
# ============================================

__all__ = [
    'get_theoretical_path',
    'generate_life_context_questions',
    'generate_goal_context_questions',
    'calculate_feasibility',
    'parse_life_context_answers',
    'parse_goal_context_answers',
    'get_goal_difficulty',
    'get_goal_time_estimate',
    'save_feasibility_result',
    'MorningMessageManager',
    'WeekendPlanner',
    'get_weekend_planner'
]
