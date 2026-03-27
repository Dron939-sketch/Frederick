#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ 5: БИБЛИОТЕКА ИНТЕРВЕНЦИЙ (intervention_library.py)
Содержит интервенции для разрыва петель и работы с конфайнтмент-моделью
"""

import random
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class InterventionLibrary:
    """
    Библиотека интервенций для разрыва петель
    
    Используется для:
    - Подбора интервенций по типу петли
    - Персонализации под профиль пользователя
    - Ежедневных практик
    - Недельных программ
    """
    
    def __init__(self):
        """Инициализация библиотеки"""
        self.interventions = self._build_library()
        self.exercises = self._build_exercises()
        self.quotes = self._build_quotes()
        self.practices = self._build_practices()
        
        logger.info("InterventionLibrary инициализирована")
    
    def _build_library(self) -> Dict[str, Any]:
        """
        Строит библиотеку интервенций по типам петель
        """
        return {
            # Для петель типа symptom_behavior_belief
            'symptom_behavior_belief': {
                'name': 'Петля симптом-поведение-убеждение',
                'description': 'Симптом вызывает поведение избегания, которое укрепляет убеждение о невозможности',
                'break_points': [2, 6, 7],
                'interventions': {
                    2: {
                        'name': 'Изменение автоматизма',
                        'description': 'Поймай момент, когда срабатывает автоматическая реакция, и сделай паузу.',
                        'exercise': 'Каждый день отслеживай ситуацию и вместо привычного действия делай паузу на 10 секунд. Записывай, что чувствуешь в этот момент.',
                        'duration': '21 день',
                        'difficulty': 'Средняя',
                        'expected': 'Автоматизм ослабнет, появится выбор',
                        'vak': 'kinesthetic'
                    },
                    6: {
                        'name': 'Оспаривание системных правил',
                        'description': 'Исследуй правила системы, в которой находишься.',
                        'exercise': 'Напиши список неписаных правил твоей семьи/работы. Какие из них можно нарушить без последствий?',
                        'duration': '7 дней',
                        'difficulty': 'Средняя',
                        'expected': 'Осознание, что правила можно менять',
                        'vak': 'auditory_digital'
                    },
                    7: {
                        'name': 'Оспаривание убеждения',
                        'description': 'Найди одно исключение из правила каждый день.',
                        'exercise': 'Каждый вечер вспоминай случай, когда твое убеждение не работало. Записывай в дневник.',
                        'duration': '14 дней',
                        'difficulty': 'Высокая',
                        'expected': 'Убеждение перестанет быть абсолютным',
                        'vak': 'visual'
                    }
                }
            },
            
            # Для петель identity_system_environment
            'identity_system_environment': {
                'name': 'Петля идентичность-система-среда',
                'description': 'Идентичность определяет поведение в системе, система формирует среду, среда влияет на идентичность',
                'break_points': [5, 6, 8],
                'interventions': {
                    5: {
                        'name': 'Эксперимент с идентичностью',
                        'description': 'Попробуй вести себя так, как будто ты уже тот, кем хочешь стать.',
                        'exercise': 'Выбери один день и проживи его в роли «нового себя». Замечай разницу в мыслях, чувствах, поведении.',
                        'duration': '1 день (эксперимент)',
                        'difficulty': 'Средняя',
                        'expected': 'Появится новый опыт, расширяющий идентичность',
                        'vak': 'visual'
                    },
                    6: {
                        'name': 'Изменение среды',
                        'description': 'Измени один элемент в своем окружении.',
                        'exercise': 'Переставь мебель, смени маршрут, познакомься с новым человеком. Любое изменение среды влияет на систему.',
                        'duration': '3 дня',
                        'difficulty': 'Легкая',
                        'expected': 'Система потеряет устойчивость',
                        'vak': 'kinesthetic'
                    },
                    8: {
                        'name': 'Разрыв связки',
                        'description': 'Найди, что соединяет несовместимое в твоей жизни.',
                        'exercise': 'Выпиши два противоречия, которые ты удерживаешь. Что будет, если выбрать одно?',
                        'duration': '7 дней',
                        'difficulty': 'Высокая',
                        'expected': 'Освобождение энергии от противоречия',
                        'vak': 'auditory'
                    }
                }
            },
            
            # Для полной петли
            'full_cycle': {
                'name': 'Полный цикл самоподдержания',
                'description': 'Система полностью замкнута: каждый элемент поддерживает другие',
                'break_points': [9, 4, 1],
                'interventions': {
                    9: {
                        'name': 'Смена картины мира',
                        'description': 'Твой взгляд на мир замыкает систему. Попробуй увидеть иначе.',
                        'exercise': 'Каждый день находи три подтверждения тому, что мир может быть другим, более дружелюбным/справедливым/безопасным.',
                        'duration': '30 дней',
                        'difficulty': 'Очень высокая',
                        'expected': 'Система потеряет устойчивость, появятся новые возможности',
                        'vak': 'visual'
                    },
                    4: {
                        'name': 'Разрыв на нижнем уровне',
                        'description': 'Измени самую базовую реакцию.',
                        'exercise': 'В момент срабатывания паттерна сделай что-то радикально другое: если обычно напрягаешься — расслабься, если убегаешь — останься.',
                        'duration': '7 дней',
                        'difficulty': 'Средняя',
                        'expected': 'Цепочка прервется, появится новый опыт',
                        'vak': 'kinesthetic'
                    },
                    1: {
                        'name': 'Работа с симптомом',
                        'description': 'Симптом — это сигнал системы. Научись его слушать.',
                        'exercise': 'Когда симптом появляется, не борись с ним. Спроси: «О чем ты хочешь мне сказать? Что мне нужно?»',
                        'duration': '14 дней',
                        'difficulty': 'Средняя',
                        'expected': 'Симптом станет союзником, а не врагом',
                        'vak': 'auditory'
                    }
                }
            },
            
            # Для поведенческой петли
            'behavioral_loop': {
                'name': 'Поведенческая петля',
                'description': 'Поведение вызывает реакцию, которая усиливает исходное поведение',
                'break_points': [2, 3, 4],
                'interventions': {
                    2: {
                        'name': 'Пауза перед реакцией',
                        'description': 'Автоматические реакции зациклены. Пауза разрывает цикл.',
                        'exercise': 'Сделай паузу перед любой эмоциональной реакцией. Сосчитай до 5. Подыши.',
                        'duration': '10 дней',
                        'difficulty': 'Легкая',
                        'expected': 'Появится контроль над реакциями',
                        'vak': 'kinesthetic'
                    },
                    3: {
                        'name': 'Смена стратегии',
                        'description': 'Если стратегия не работает — смени её.',
                        'exercise': 'В ситуации выбора сделай не то, что обычно, а наоборот. Любое новое действие — шаг из петли.',
                        'duration': '7 дней',
                        'difficulty': 'Средняя',
                        'expected': 'Расширение поведенческого репертуара',
                        'vak': 'auditory_digital'
                    }
                }
            },
            
            # Для когнитивной петли
            'cognitive_loop': {
                'name': 'Когнитивная петля',
                'description': 'Мысль вызывает эмоцию, эмоция усиливает мысль',
                'break_points': [5, 7, 8],
                'interventions': {
                    5: {
                        'name': 'Когнитивная реструктуризация',
                        'description': 'Оспорь автоматическую мысль.',
                        'exercise': 'Запиши мысль, найди 3 альтернативных объяснения ситуации.',
                        'duration': '14 дней',
                        'difficulty': 'Средняя',
                        'expected': 'Появление гибкости мышления',
                        'vak': 'auditory_digital'
                    },
                    7: {
                        'name': 'Работа с глубинным убеждением',
                        'description': 'Найди корень автоматической мысли.',
                        'exercise': 'Задавай себе вопрос "Почему?" пока не дойдешь до базового убеждения.',
                        'duration': '7 дней',
                        'difficulty': 'Высокая',
                        'expected': 'Осознание корня проблемы',
                        'vak': 'auditory'
                    },
                    8: {
                        'name': 'Разрыв ассоциации',
                        'description': 'Разорви связь между триггером и реакцией.',
                        'exercise': 'При появлении триггера сделай что-то совершенно другое, создай новую нейронную связь.',
                        'duration': '21 день',
                        'difficulty': 'Средняя',
                        'expected': 'Новый паттерн реагирования',
                        'vak': 'kinesthetic'
                    }
                }
            },
            
            # Универсальные интервенции
            'universal': {
                'name': 'Универсальные интервенции',
                'description': 'Подходят для любых петель',
                'break_points': [1, 2, 3, 4, 5, 6, 7, 8, 9],
                'interventions': {
                    1: {
                        'name': 'Дневник симптомов',
                        'description': 'Отслеживание симптомов помогает увидеть паттерн.',
                        'exercise': 'Записывай когда, где и при каких обстоятельствах появляется симптом. Ищи закономерности.',
                        'duration': '14 дней',
                        'difficulty': 'Легкая',
                        'expected': 'Понимание триггеров',
                        'vak': 'digital'
                    },
                    2: {
                        'name': 'Отслеживание автоматизмов',
                        'description': 'Поймай себя на автоматической реакции.',
                        'exercise': 'Носи резинку на запястье. При автоматической реакции щелкай ею, чтобы осознать момент.',
                        'duration': '7 дней',
                        'difficulty': 'Легкая',
                        'expected': 'Повышение осознанности',
                        'vak': 'kinesthetic'
                    },
                    3: {
                        'name': 'Анализ стратегий',
                        'description': 'Какие стратегии ты используешь?',
                        'exercise': 'Выпиши 3 стратегии, которые ты используешь в сложных ситуациях. Оцени их эффективность.',
                        'duration': '7 дней',
                        'difficulty': 'Средняя',
                        'expected': 'Понимание своих стратегий',
                        'vak': 'auditory_digital'
                    },
                    4: {
                        'name': 'Осознание паттерна',
                        'description': 'Увидь повторяющийся сценарий.',
                        'exercise': 'Вспомни 3 похожие ситуации. Найди общий сценарий.',
                        'duration': '7 дней',
                        'difficulty': 'Средняя',
                        'expected': 'Распознавание паттерна',
                        'vak': 'visual'
                    },
                    5: {
                        'name': 'Работа с убеждениями',
                        'description': 'Когнитивная реструктуризация убеждений.',
                        'exercise': 'Выпиши убеждение и найди 3 аргумента ЗА и 3 аргумента ПРОТИВ.',
                        'duration': '7 дней',
                        'difficulty': 'Средняя',
                        'expected': 'Гибкость мышления',
                        'vak': 'auditory_digital'
                    },
                    6: {
                        'name': 'Исследование системы',
                        'description': 'Пойми правила системы, в которой находишься.',
                        'exercise': 'Нарисуй схему: кто, как и на что влияет в твоем окружении.',
                        'duration': '3 дня',
                        'difficulty': 'Средняя',
                        'expected': 'Понимание системных связей',
                        'vak': 'visual'
                    },
                    7: {
                        'name': 'Поиск корня',
                        'description': 'Найди, откуда взялось убеждение.',
                        'exercise': 'Когда ты впервые так подумал? Кто это сказал? Что тогда произошло?',
                        'duration': '7 дней',
                        'difficulty': 'Высокая',
                        'expected': 'Освобождение от ограничения',
                        'vak': 'auditory'
                    },
                    8: {
                        'name': 'Разрыв связок',
                        'description': 'Найди, что связывает несовместимое.',
                        'exercise': 'Выпиши два противоположных желания. Что их соединяет?',
                        'duration': '7 дней',
                        'difficulty': 'Высокая',
                        'expected': 'Освобождение энергии',
                        'vak': 'auditory'
                    },
                    9: {
                        'name': 'Смена перспективы',
                        'description': 'Посмотри на ситуацию с другой точки зрения.',
                        'exercise': 'Представь, что ты смотришь на свою жизнь с высоты птичьего полета. Что видишь?',
                        'duration': '7 дней',
                        'difficulty': 'Средняя',
                        'expected': 'Новое видение',
                        'vak': 'visual'
                    }
                }
            }
        }
    
    def _build_exercises(self) -> Dict[str, List[str]]:
        """
        Строит библиотеку быстрых упражнений
        """
        return {
            'mindfulness': [
                'Закрой глаза и просто наблюдай за дыханием 5 минут.',
                'Почувствуй свое тело: где напряжение, где легкость?',
                'Съешь что-то очень медленно, смакуя каждый кусочек.',
                'Пройди 10 шагов, чувствуя каждое движение.',
                'Послушай звуки вокруг: какие ты слышишь?'
            ],
            'journaling': [
                'Выпиши все мысли, которые крутятся в голове.',
                'Напиши письмо себе будущему через год.',
                'Опиши ситуацию глазами наблюдателя со стороны.',
                'Запиши 3 вещи, за которые благодарен сегодня.',
                'Напиши, что бы ты сказал себе в трудный момент.'
            ],
            'behavioral': [
                'Сделай сегодня что-то, что обычно откладываешь.',
                'Скажи кому-то комплимент.',
                'Выйди на 15 минут раньше и просто погуляй.',
                'Сделай одно доброе дело для незнакомца.',
                'Попробуй что-то новое, что давно хотел.'
            ],
            'cognitive': [
                'Найди альтернативное объяснение ситуации.',
                'Представь, что бы посоветовал друг в этой ситуации.',
                'Подумай, чему тебя учит эта ситуация.',
                'Найди 3 плюса в том, что произошло.',
                'Представь, что смотришь на ситуацию через год.'
            ]
        }
    
    def _build_quotes(self) -> Dict[str, List[str]]:
        """
        Строит библиотеку мотивирующих цитат
        """
        return {
            'change': [
                'Единственный способ изменить свою жизнь — это выйти из зоны комфорта.',
                'Изменения начинаются там, где заканчивается зона комфорта.',
                'Ты не можешь изменить то, чему не даешь названия.',
                'Невозможно решить проблему на том же уровне, на котором она возникла.',
                'Каждое изменение начинается с выбора.'
            ],
            'awareness': [
                'Осознанность — первый шаг к изменению.',
                'Проблему нельзя решить на том же уровне, на котором она возникла.',
                'Когда ты меняешь способ видеть вещи, вещи, которые ты видишь, меняются.',
                'Сначала ты замечаешь, потом понимаешь, потом меняешь.',
                'Осознание — это половина исцеления.'
            ],
            'action': [
                'Маленькие шаги каждый день приводят к большим результатам.',
                'Лучшее время начать было вчера. Следующее лучшее — сегодня.',
                'Дорога в тысячу миль начинается с первого шага.',
                'Действие — лучшее лекарство от страха.',
                'Сделай первый шаг. Остальные придут сами.'
            ],
            'growth': [
                'Ты не обязан быть таким же, каким был вчера.',
                'Рост происходит, когда ты выходишь за пределы того, что знаешь.',
                'Каждая трудность — это возможность для роста.',
                'Твоя жизнь — это твоя ответственность.',
                'Внутри тебя есть все ресурсы, которые нужны.'
            ]
        }
    
    def _build_practices(self) -> Dict[int, Dict[str, str]]:
        """
        Строит библиотеку ежедневных практик
        """
        return {
            1: {
                'title': 'Наблюдение за симптомом',
                'practice': 'Сегодня просто замечай свой симптом без оценки. Как будто ты ученый, изучающий интересное явление. Не пытайся его изменить — только наблюдай.',
                'duration': '5 минут',
                'type': 'mindfulness'
            },
            2: {
                'title': 'Осознанное действие',
                'practice': 'Выбери одно автоматическое действие, которое делаешь каждый день (чистка зубов, утренний кофе, дорога на работу). Сделай его максимально осознанно. Замечай каждое движение, каждый звук, каждое ощущение.',
                'duration': '1-3 минуты',
                'type': 'mindfulness'
            },
            3: {
                'title': 'Новая стратегия',
                'practice': 'В привычной ситуации попробуй новый способ реагирования. Если обычно злишься — сделай паузу. Если убегаешь — останься. Если молчишь — скажи. Просто эксперимент, без оценки результата.',
                'duration': 'Моментально',
                'type': 'behavioral'
            },
            4: {
                'title': 'Отслеживание паттерна',
                'practice': 'Заметь, когда срабатывает твой паттерн. Просто отметь это мысленно: "Ага, вот он снова". Не ругай себя, не пытайся изменить — просто заметь.',
                'duration': '10 секунд',
                'type': 'awareness'
            },
            5: {
                'title': 'Исключение из правил',
                'practice': 'Найди сегодня одно исключение из твоего убеждения. Один случай, когда "всегда" или "никогда" не сработало. Запиши его.',
                'duration': '5 минут',
                'type': 'cognitive'
            },
            6: {
                'title': 'Изменение среды',
                'practice': 'Измени что-то маленькое в своем окружении: переставь кружку на другой стол, смени фон на телефоне, пройди другой дорогой. Заметь, как меняется ощущение.',
                'duration': '2 минуты',
                'type': 'behavioral'
            },
            7: {
                'title': 'Исследование корня',
                'practice': 'Спроси себя: "Когда я впервые так подумал/почувствовал?" "Кто это сказал?" "Что тогда произошло?" Просто подумай об этом.',
                'duration': '3 минуты',
                'type': 'journaling'
            },
            8: {
                'title': 'Осознание связки',
                'practice': 'Заметь, что соединяет две противоположности в твоей жизни. Где ты одновременно хочешь и не хочешь? Что держит это вместе?',
                'duration': '5 минут',
                'type': 'cognitive'
            },
            9: {
                'title': 'Новый взгляд',
                'practice': 'Посмотри на ситуацию глазами другого человека. Представь, что говорит мудрый друг. Что бы он посоветовал?',
                'duration': '5 минут',
                'type': 'cognitive'
            }
        }
    
    def get_for_loop(self, loop_type: str, element_id: int = None) -> Optional[Dict[str, Any]]:
        """
        Возвращает интервенцию для петли и конкретного элемента
        
        Args:
            loop_type: тип петли (symptom_behavior_belief, identity_system_environment, full_cycle, behavioral_loop, cognitive_loop, universal)
            element_id: ID элемента (1-9)
            
        Returns:
            интервенция или None
        """
        loop_data = self.interventions.get(loop_type)
        if not loop_data:
            # Пробуем универсальную
            loop_data = self.interventions.get('universal')
            logger.warning(f"Тип петли {loop_type} не найден, использую universal")
        
        if not loop_data:
            return None
        
        if element_id is not None and element_id in loop_data.get('interventions', {}):
            return loop_data['interventions'][element_id]
        
        # Если элемент не указан, берем первый рекомендуемый
        if loop_data.get('break_points'):
            first_point = loop_data['break_points'][0]
            return loop_data['interventions'].get(first_point)
        
        return None
    
    def get_personalized(self, loop_type: str, profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Возвращает персонализированную интервенцию с учетом профиля
        
        Args:
            loop_type: тип петли
            profile: профиль пользователя (содержит vector и level)
            
        Returns:
            персонализированная интервенция
        """
        base = self.get_for_loop(loop_type)
        if not base:
            return None
        
        # Копируем, чтобы не менять оригинал
        intervention = base.copy()
        
        # Добавляем персонализацию
        vector = profile.get('vector', 'общий')
        level = profile.get('level', 3)
        
        vector_descriptions = {
            'СБ': 'тебе важно чувствовать безопасность, поэтому начни с малого',
            'ТФ': 'для тебя важны ресурсы и стабильность, поэтому создай опоры',
            'УБ': 'ты ищешь удовольствие и баланс, поэтому сделай процесс приятным',
            'ЧВ': 'ты ориентируешься на чувства и отношения, поэтому найди поддержку'
        }
        
        vector_text = vector_descriptions.get(vector, 'у тебя есть свои особенности')
        
        # Добавляем персонализированное вступление
        intervention['personalized_intro'] = f"Учитывая, что {vector_text} и текущий уровень {level}, рекомендую обратить внимание на..."
        
        # Добавляем случайное упражнение из соответствующей категории
        vak = intervention.get('vak', 'cognitive')
        exercise_category = {
            'visual': 'mindfulness',
            'auditory': 'journaling',
            'kinesthetic': 'behavioral',
            'auditory_digital': 'cognitive',
            'digital': 'cognitive'
        }.get(vak, 'cognitive')
        
        exercises = self.exercises.get(exercise_category, self.exercises['mindfulness'])
        intervention['bonus_exercise'] = random.choice(exercises)
        
        # Добавляем мотивирующую цитату
        quote_category = random.choice(['change', 'awareness', 'action', 'growth'])
        intervention['quote'] = random.choice(self.quotes[quote_category])
        
        return intervention
    
    def get_daily_practice(self, element_id: int) -> Dict[str, str]:
        """
        Возвращает ежедневную практику для элемента
        
        Args:
            element_id: ID элемента (1-9)
            
        Returns:
            практика с названием, описанием и длительностью
        """
        practice = self.practices.get(element_id, {
            'title': 'Осознанность',
            'practice': 'Побудь в тишине 2 минуты, просто наблюдая за дыханием.',
            'duration': '2 минуты',
            'type': 'mindfulness'
        })
        return practice
    
    def get_random_quote(self, category: str = None) -> str:
        """
        Возвращает случайную цитату
        
        Args:
            category: категория (change, awareness, action, growth)
            
        Returns:
            цитата
        """
        if category and category in self.quotes:
            return random.choice(self.quotes[category])
        
        # Все категории
        all_quotes = []
        for quotes in self.quotes.values():
            all_quotes.extend(quotes)
        return random.choice(all_quotes)
    
    def get_program_for_week(self, key_element_id: int) -> List[Dict[str, str]]:
        """
        Возвращает программу на неделю для работы с ключевым элементом
        
        Args:
            key_element_id: ID ключевого элемента (1-9)
            
        Returns:
            список заданий на 7 дней
        """
        days = []
        base_practice = self.get_daily_practice(key_element_id)
        
        week_schedule = [
            ('ПН', 'Знакомство', f"День 1: {base_practice['title']}", base_practice['practice'], base_practice['duration']),
            ('ВТ', 'Наблюдение', 'День 2: Наблюдение', 'Просто наблюдай, как проявляется твое ограничение в течение дня. Записывай, когда и в каких ситуациях.', 'В течение дня'),
            ('СР', 'Запись', 'День 3: Запись', 'Запиши все мысли и чувства, связанные с этим ограничением. Не оценивай, просто выписывай.', '10 минут'),
            ('ЧТ', 'Эксперимент', 'День 4: Эксперимент', 'Попробуй сделать маленький шаг в противоположном направлении. Что-то, что ты обычно не делаешь.', '5 минут'),
            ('ПТ', 'Рефлексия', 'День 5: Рефлексия', 'Подумай, чему тебя учит эта ситуация? Что ты можешь взять из этого опыта?', '10 минут'),
            ('СБ', 'Поддержка', 'День 6: Поддержка', 'Поговори с кем-то, кому доверяешь, о том, что происходит. Или запиши, что бы ты хотел сказать.', '15 минут'),
            ('ВС', 'Интеграция', 'День 7: Интеграция', 'Подведи итоги недели. Что изменилось? Что нового узнал о себе? Что можешь взять в будущее?', '15 минут')
        ]
        
        for day_name, day_theme, title, task, duration in week_schedule:
            days.append({
                'day': day_name,
                'theme': day_theme,
                'title': title,
                'task': task,
                'duration': duration
            })
        
        # Добавляем цитату дня
        for i, day in enumerate(days):
            day['quote'] = self.get_random_quote()
        
        return days
    
    def get_intervention_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """
        Ищет интервенцию по названию
        
        Args:
            name: название интервенции
            
        Returns:
            интервенция или None
        """
        for loop_type, loop_data in self.interventions.items():
            for element_id, intervention in loop_data.get('interventions', {}).items():
                if intervention.get('name') == name:
                    return intervention
        return None
    
    def get_all_interventions(self) -> List[Dict[str, Any]]:
        """
        Возвращает список всех интервенций
        
        Returns:
            список всех интервенций
        """
        all_interventions = []
        for loop_type, loop_data in self.interventions.items():
            for element_id, intervention in loop_data.get('interventions', {}).items():
                intervention_copy = intervention.copy()
                intervention_copy['loop_type'] = loop_type
                intervention_copy['element_id'] = element_id
                all_interventions.append(intervention_copy)
        return all_interventions


# ============================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================

def get_intervention_library() -> InterventionLibrary:
    """
    Возвращает экземпляр библиотеки интервенций (синглтон)
    """
    return InterventionLibrary()


# ============================================
# ПРИМЕР ИСПОЛЬЗОВАНИЯ
# ============================================

if __name__ == "__main__":
    print("🧪 Тестирование InterventionLibrary...")
    
    lib = InterventionLibrary()
    
    # Тест 1: Получить интервенцию для петли
    print("\n📋 Интервенция для петли symptom_behavior_belief (элемент 2):")
    intervention = lib.get_for_loop('symptom_behavior_belief', 2)
    if intervention:
        print(f"  Название: {intervention['name']}")
        print(f"  Описание: {intervention['description']}")
        print(f"  Длительность: {intervention['duration']}")
    
    # Тест 2: Персонализированная интервенция
    print("\n📋 Персонализированная интервенция:")
    profile = {'vector': 'СБ', 'level': 4}
    personalized = lib.get_personalized('full_cycle', profile)
    if personalized:
        print(f"  Название: {personalized['name']}")
        print(f"  Персонализация: {personalized.get('personalized_intro', 'Нет')[:80]}...")
        print(f"  Цитата: {personalized.get('quote', 'Нет')}")
    
    # Тест 3: Ежедневная практика
    print("\n📋 Ежедневная практика для элемента 5:")
    practice = lib.get_daily_practice(5)
    print(f"  {practice['title']}: {practice['practice'][:60]}...")
    
    # Тест 4: Недельная программа
    print("\n📋 Недельная программа для элемента 3:")
    program = lib.get_program_for_week(3)
    for day in program[:3]:
        print(f"  {day['day']}: {day['title']}")
    
    # Тест 5: Случайная цитата
    print("\n📋 Случайная цитата:")
    print(f"  {lib.get_random_quote('growth')}")
    
    print("\n✅ Тест завершен")
