#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ 4: ИНТЕГРАЦИЯ С ОТВЕТАМИ (confinement_reporter.py)
Формирует отчеты и ответы на основе конфайнтмент-модели
"""

from datetime import datetime
from typing import Optional, Dict, List, Any
import logging

# Импортируем необходимые классы из других модулей
from confinement_model import ConfinementModel9, ConfinementElement
from loop_analyzer import LoopAnalyzer
from key_confinement import KeyConfinementDetector

# Настройка логирования
logger = logging.getLogger(__name__)


class ConfinementReporter:
    """
    Формирует отчеты и ответы на основе конфайнтмент-модели
    """
    
    def __init__(self, model: ConfinementModel9, user_name: str = "друг"):
        """
        Инициализация репортера
        
        Args:
            model: построенная конфайнтмент-модель
            user_name: имя пользователя для обращений
        """
        self.model = model
        self.user_name = user_name
        self.loop_analyzer = LoopAnalyzer(model)
        self.loops = self.loop_analyzer.analyze()
        self.key_detector = KeyConfinementDetector(model, self.loops)
        self.key = self.key_detector.detect()
        
        logger.info(f"ConfinementReporter инициализирован для {user_name}")
    
    def get_summary(self) -> str:
        """
        Возвращает краткое резюме модели для быстрого понимания
        
        Returns:
            str: краткий отчет о модели
        """
        if not self.model.elements.get(1):
            return "Модель еще не построена"
        
        lines = []
        
        # Заголовок
        lines.append(f"🧠 **КОНФАЙНМЕНТ-МОДЕЛЬ**\n")
        
        # Результат (главный симптом)
        result = self.model.elements.get(1)
        if result:
            desc = result.description[:100] if result.description else "Не определен"
            lines.append(f"🎯 **Результат:** {desc}...\n")
        
        # Ключевой конфайнмент
        if self.key:
            lines.append(f"⛓ **Ключевое ограничение:**")
            lines.append(self.key['description'])
            lines.append("")
        
        # Петли
        if self.loops:
            strongest = self.loop_analyzer.get_strongest_loop()
            if strongest:
                lines.append(f"🔄 **Главная петля:**")
                lines.append(strongest['description'])
                impact = strongest.get('impact', 0)
                lines.append(f"Сила: {impact:.1%}")
                lines.append("")
        
        # Замыкание
        closure_status = "✅ замкнута" if self.model.is_closed else "🔄 не замкнута"
        closure_score = self.model.closure_score if hasattr(self.model, 'closure_score') else 0
        lines.append(f"📊 **Система:** {closure_status} (степень {closure_score:.1%})")
        
        return "\n".join(lines)
    
    def get_detailed_report(self) -> str:
        """
        Возвращает детальный отчет по модели со всеми элементами
        
        Returns:
            str: подробный отчет о модели
        """
        lines = []
        
        lines.append(f"🧠 **ПОЛНАЯ КОНФАЙНМЕНТ-МОДЕЛЬ**\n")
        
        # Все элементы
        lines.append("**9 элементов системы:**\n")
        
        for i in range(1, 10):
            elem = self.model.elements.get(i)
            if not elem:
                continue
            
            # Эмодзи для разных типов
            emoji = {
                1: "🎯", 2: "⚡", 3: "💰", 4: "🔍", 
                5: "🎭", 6: "🏛", 7: "⚓", 8: "🔗", 9: "🌍"
            }.get(i, "🔹")
            
            lines.append(f"{emoji} **{i}. {elem.name}**")
            desc = elem.description[:100] if elem.description else "Нет описания"
            lines.append(f"   {desc}")
            lines.append(f"   Сила: {elem.strength:.1%} | ВАК: {elem.vak}")
            
            # Связи
            if elem.causes:
                causes_str = ", ".join([f"→{c}" for c in elem.causes[:3]])
                lines.append(f"   Влияет на: {causes_str}")
            lines.append("")
        
        # Петли
        if self.loops:
            lines.append("🔄 **Рекурсивные петли:**\n")
            for i, loop in enumerate(self.loops[:3], 1):
                lines.append(f"{i}. {loop['description']}")
                impact = loop.get('impact', 0)
                lines.append(f"   Сила: {impact:.1%}")
                lines.append("")
        
        # Ключевой конфайнмент
        if self.key:
            lines.append("⛓ **КЛЮЧЕВОЕ ОГРАНИЧЕНИЕ**\n")
            lines.append(self.key['description'])
            lines.append("")
            
            # Интервенция
            intervention = self.key.get('intervention', {})
            if intervention:
                lines.append("💡 **ЧТО ДЕЛАТЬ**")
                lines.append(f"Подход: {intervention.get('approach', 'Не указан')}")
                lines.append(f"Метод: {intervention.get('method', 'Не указан')}")
                lines.append(f"Упражнение: {intervention.get('exercise', 'Не указано')}")
        
        return "\n".join(lines)
    
    def get_simple_advice(self) -> str:
        """
        Возвращает простой совет на день на основе модели
        
        Returns:
            str: простой совет
        """
        if not self.key:
            return "Пройди тест, чтобы я мог понять твою ситуацию."
        
        elem = self.key.get('element')
        
        # Простые советы для каждого типа
        simple_advice = {
            1: f"Ты замечаешь, что {elem.description[:50].lower() if elem and elem.description else 'ситуация'}... Это только вершина айсберга. Давай копать глубже.",
            2: f"Твое поведение — ключ. Попробуй сегодня сделать наоборот.",
            3: f"Твоя стратегия работает против тебя. Что если попробовать другой подход?",
            4: f"Этот паттерн незаметен, но именно он запускает всё. Начни его замечать.",
            5: f"Твое убеждение ограничивает. Найди одно исключение.",
            6: f"Система вокруг тебя не меняется. Что ты можешь изменить в ней?",
            7: f"Глубинное убеждение — корень. Поработай с ним через письменные практики.",
            8: f"Эта связка соединяет противоречия. Что если разорвать эту связь?",
            9: f"Это замыкающий элемент. Измени его — и система рухнет."
        }
        
        elem_id = elem.id if elem else 1
        advice = simple_advice.get(elem_id, "Ключевое ограничение требует осознания.")
        
        return f"💡 **Совет дня**\n\n{advice}"
    
    def get_intervention(self) -> Optional[Dict]:
        """
        Возвращает полную интервенцию для работы с ключевым конфайнментом
        
        Returns:
            dict: полная интервенция или None
        """
        if not self.key:
            return None
        
        return self.key.get('intervention')
    
    def get_markdown_report(self, detailed: bool = False) -> str:
        """
        Возвращает отчет, отформатированный для Telegram (Markdown)
        
        Args:
            detailed: если True - детальный отчет, иначе краткий
            
        Returns:
            str: отчет в Markdown
        """
        if detailed:
            return self.get_detailed_report()
        else:
            return self.get_summary()
    
    def get_text_for_share(self) -> str:
        """
        Возвращает текст для отправки другому человеку
        
        Returns:
            str: текст для общего доступа
        """
        lines = []
        lines.append(f"🧠 **КОНФАЙНМЕНТ-МОДЕЛЬ ПОЛЬЗОВАТЕЛЯ {self.user_name}**\n")
        
        if self.key:
            lines.append(f"🎯 **Ключевое ограничение:**")
            lines.append(self.key['description'])
            lines.append("")
        
        if self.loops:
            strongest = self.loop_analyzer.get_strongest_loop()
            if strongest:
                lines.append(f"🔄 **Главная петля:**")
                lines.append(strongest['description'])
        
        return "\n".join(lines)
    
    def get_json_report(self) -> Dict:
        """
        Возвращает отчет в виде JSON для сохранения
        
        Returns:
            dict: данные отчета
        """
        # Сериализуем элементы модели
        elements_json = {}
        for i, elem in self.model.elements.items():
            if elem:
                elements_json[i] = {
                    'id': elem.id,
                    'name': elem.name,
                    'description': elem.description,
                    'element_type': elem.element_type,
                    'vector': elem.vector,
                    'level': elem.level,
                    'strength': elem.strength,
                    'vak': elem.vak,
                    'causes': elem.causes,
                    'caused_by': elem.caused_by
                }
        
        return {
            'user_name': self.user_name,
            'key_confinement': self.key,
            'loops': self.loops,
            'elements': elements_json,
            'is_closed': self.model.is_closed,
            'closure_score': self.model.closure_score if hasattr(self.model, 'closure_score') else 0,
            'generated_at': datetime.now().isoformat()
        }
    
    def get_break_points_summary(self) -> Dict[str, Any]:
        """
        Возвращает точки разрыва петель
        
        Returns:
            dict: точки разрыва
        """
        break_points = self.loop_analyzer.get_break_points() if self.loop_analyzer else []
        
        summary = {
            'total_break_points': len(break_points),
            'break_points': []
        }
        
        for point in break_points[:5]:  # Топ-5
            summary['break_points'].append({
                'element_id': point.get('element_id'),
                'element_name': point.get('element_name'),
                'description': point.get('description'),
                'impact': point.get('impact', 0)
            })
        
        # Добавляем ключевое ограничение как приоритетную точку разрыва
        if self.key and self.key.get('element'):
            key_element = self.key['element']
            summary['key_break_point'] = {
                'element_id': key_element.id if key_element else None,
                'element_name': key_element.name if key_element else None,
                'description': self.key['description'],
                'priority': 'high'
            }
        
        return summary
    
    def get_recommendation_for_user(self) -> str:
        """
        Возвращает персонализированную рекомендацию для пользователя
        
        Returns:
            str: рекомендация
        """
        if not self.key:
            return "Для точной рекомендации нужно больше данных."
        
        elem = self.key.get('element')
        if not elem:
            return "Ключевое ограничение определено, но элемент не найден."
        
        # Рекомендации по типу элемента
        recommendations = {
            1: f"Начни с того, что просто наблюдай за {elem.description[:40].lower() if elem.description else 'симптомом'} без попыток что-то изменить. Просто замечай, когда это происходит.",
            2: f"Попробуй сегодня сделать одно действие, противоположное твоему обычному поведению. Небольшой эксперимент.",
            3: f"Задай себе вопрос: 'Что я получу, если откажусь от этой стратегии?' Ответ может удивить.",
            4: f"Начни вести дневник. Записывай, когда этот паттерн проявляется. Триггеры → реакция → результат.",
            5: f"Найди одно свидетельство, которое противоречит этому убеждению. Один факт. Запиши его.",
            6: f"Попробуй изменить один элемент в твоем окружении. Убрать что-то или добавить.",
            7: f"Попрактикуй письменные техники: 'Я чувствую...', 'Мне нужно...', 'Я разрешаю себе...'",
            8: f"Представь, что эта связь разорвана. Что изменится? Запиши.",
            9: f"Сделай одно действие, которое замкнёт или разомкнёт эту систему. Маленький шаг."
        }
        
        recommendation = recommendations.get(elem.id, 
            f"Работай с {elem.name.lower()}. Начни с осознания, когда и как это проявляется.")
        
        # Добавляем информацию о времени
        if elem.strength > 0.8:
            recommendation += "\n\n⚠️ Это сильный элемент. Не пытайся изменить его резко. Маленькие шаги."
        elif elem.strength < 0.3:
            recommendation += "\n\n✨ Это слабый элемент. Даже небольшое усилие может дать результат."
        
        return f"💡 **РЕКОМЕНДАЦИЯ ДЛЯ {self.user_name.upper()}**\n\n{recommendation}"


# ============================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================

def create_reporter_from_user_data(user_data: Dict, user_name: str = "друг") -> Optional[ConfinementReporter]:
    """
    Создает репортер из данных пользователя
    
    Args:
        user_data: словарь с данными пользователя (должен содержать 'confinement_model')
        user_name: имя пользователя
        
    Returns:
        ConfinementReporter или None
    """
    model_data = user_data.get('confinement_model')
    if not model_data:
        logger.warning(f"Нет конфайнтмент-модели для пользователя {user_name}")
        return None
    
    try:
        model = ConfinementModel9.from_dict(model_data)
        return ConfinementReporter(model, user_name)
    except Exception as e:
        logger.error(f"Ошибка при создании репортера: {e}")
        return None


def format_intervention_for_display(intervention: Dict) -> str:
    """
    Форматирует интервенцию для красивого отображения
    
    Args:
        intervention: словарь с интервенцией
        
    Returns:
        str: отформатированный текст
    """
    if not intervention:
        return "Интервенция не найдена"
    
    text = f"""
💡 **ИНТЕРВЕНЦИЯ ДЛЯ РАБОТЫ С КОНФАЙНМЕНТОМ**

🎯 **Цель:** {intervention.get('target', 'Не указана')}

📌 **Описание:**
{intervention.get('description', 'Нет описания')}

⚡ **Что делать:**
{intervention.get('exercise', 'Нет упражнения')}

📊 **Продолжительность:** {intervention.get('duration', 'Не указана')}
"""
    
    if 'expected' in intervention:
        text += f"\n✨ **Ожидаемый результат:**\n{intervention['expected']}"
    
    return text


def get_loop_description_by_type(loop_type: str) -> str:
    """
    Возвращает описание петли по её типу
    
    Args:
        loop_type: тип петли
        
    Returns:
        str: описание
    """
    descriptions = {
        'major_loop': 'Главная петля, которая держит всю систему',
        'secondary_loop': 'Второстепенная петля, усиливающая главную',
        'compensatory_loop': 'Компенсаторная петля — попытка исправить, но только ухудшает',
        'paradox_loop': 'Парадоксальная петля — чем больше стараешься, тем хуже становится'
    }
    return descriptions.get(loop_type, 'Рекурсивная петля')


# ============================================
# ПРИМЕР ИСПОЛЬЗОВАНИЯ
# ============================================

if __name__ == "__main__":
    print("🧪 Тестирование ConfinementReporter...")
    
    # Создаем тестовую модель
    from confinement_model import ConfinementModel9, ConfinementElement
    
    test_model = ConfinementModel9(user_id=12345)
    
    # Заполняем тестовыми данными
    test_model.elements[1] = ConfinementElement(1, "🎯 Симптом")
    test_model.elements[1].description = "Постоянная тревога и беспокойство"
    test_model.elements[1].strength = 1.0
    test_model.elements[1].vak = "К"
    
    test_model.elements[2] = ConfinementElement(2, "🛡 Избегание")
    test_model.elements[2].description = "Избегаю ситуаций, которые вызывают тревогу"
    test_model.elements[2].strength = 0.8
    test_model.elements[2].vak = "А"
    
    test_model.elements[3] = ConfinementElement(3, "💰 Стратегия")
    test_model.elements[3].description = "Пытаюсь контролировать всё вокруг"
    test_model.elements[3].strength = 0.7
    test_model.elements[3].vak = "В"
    
    # Добавляем связи для петли
    test_model.elements[1].causes = [2]
    test_model.elements[2].causes = [3]
    test_model.elements[3].causes = [1]
    
    # Создаем репортер
    reporter = ConfinementReporter(test_model, "Тестовый")
    
    # Выводим отчеты
    print("\n📋 КРАТКИЙ ОТЧЕТ:")
    print(reporter.get_summary())
    
    print("\n📋 ДЕТАЛЬНЫЙ ОТЧЕТ:")
    print(reporter.get_detailed_report())
    
    print("\n💡 СОВЕТ:")
    print(reporter.get_simple_advice())
    
    print("\n📊 ТОЧКИ РАЗРЫВА:")
    break_points = reporter.get_break_points_summary()
    print(break_points)
    
    print("\n💡 РЕКОМЕНДАЦИЯ:")
    print(reporter.get_recommendation_for_user())
    
    print("\n✅ Тест завершен")
