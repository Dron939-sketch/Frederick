// ============================================
// esoterica.js — Эзотерический модуль
// Таро, Гороскоп, Натальная карта
// Версия 1.0 — Полнофункциональный модуль
// ============================================

// --- Состояние модуля ---
const state = {
    activeTab: 'horoscope',
    activeSuit: 'major',
    question: '',
    userSign: null,
    userBirthData: null
};

// --- Позиции карт в раскладах (для UI и AI-интерпретации) ---
const TAROT_SPREADS = {
    day: {
        label: '🎴 Карта дня',
        positions: ['Карта дня']
    },
    three: {
        label: '🃏 Прошлое · Настоящее · Будущее',
        positions: ['Прошлое', 'Настоящее', 'Будущее']
    },
    celtic: {
        label: '🔮 Кельтский крест',
        positions: [
            '1. Настоящее',
            '2. Препятствие',
            '3. Подсознание',
            '4. Прошлое',
            '5. Сознание / цель',
            '6. Ближайшее будущее',
            '7. Вы сами',
            '8. Окружение',
            '9. Надежды и страхи',
            '10. Итог'
        ]
    }
};

// --- Данные Таро (78 карт) ---
// Полный набор Старших Арканов (22 карты) с изображениями
const MAJOR_ARCANA = [
    { id: 0, name: 'Шут', nameEn: 'The Fool', image: 'img/tarot/m00.webp', 
      meaning: 'Новые начинания, спонтанность, вера в жизнь', 
      reversed: 'Безрассудство, риск, хаос',
      element: 'Воздух', planet: 'Уран' },
    { id: 1, name: 'Маг', nameEn: 'The Magician', image: 'img/tarot/m01.webp',
      meaning: 'Воля, мастерство, концентрация ресурсов',
      reversed: 'Манипуляции, неуверенность, таланты впустую',
      element: 'Воздух', planet: 'Меркурий' },
    { id: 2, name: 'Верховная Жрица', nameEn: 'The High Priestess', image: 'img/tarot/m02.webp',
      meaning: 'Интуиция, тайны, подсознание',
      reversed: 'Подавленная интуиция, поверхностность',
      element: 'Вода', planet: 'Луна' },
    { id: 3, name: 'Императрица', nameEn: 'The Empress', image: 'img/tarot/m03.webp',
      meaning: 'Изобилие, материнство, природа',
      reversed: 'Зависимость, творческий блок',
      element: 'Земля', planet: 'Венера' },
    { id: 4, name: 'Император', nameEn: 'The Emperor', image: 'img/tarot/m04.webp',
      meaning: 'Структура, власть, отеческая фигура',
      reversed: 'Тирания, контроль, ригидность',
      element: 'Огонь', planet: 'Марс' },
    { id: 5, name: 'Иерофант', nameEn: 'The Hierophant', image: 'img/tarot/m05.webp',
      meaning: 'Традиции, обучение, духовные устои',
      reversed: 'Бунт, нетрадиционный подход',
      element: 'Земля', planet: 'Меркурий' },
    { id: 6, name: 'Влюблённые', nameEn: 'The Lovers', image: 'img/tarot/m06.webp',
      meaning: 'Выбор, гармония, отношения',
      reversed: 'Дисгармония, конфликт ценностей',
      element: 'Воздух', planet: 'Меркурий' },
    { id: 7, name: 'Колесница', nameEn: 'The Chariot', image: 'img/tarot/m07.webp',
      meaning: 'Воля к победе, контроль, направление',
      reversed: 'Потеря контроля, агрессия',
      element: 'Вода', planet: 'Луна' },
    { id: 8, name: 'Сила', nameEn: 'Strength', image: 'img/tarot/m08.webp',
      meaning: 'Внутренняя сила, терпение, сострадание',
      reversed: 'Слабость, неуверенность',
      element: 'Огонь', planet: 'Солнце' },
    { id: 9, name: 'Отшельник', nameEn: 'The Hermit', image: 'img/tarot/m09.webp',
      meaning: 'Самоанализ, мудрость, уединение',
      reversed: 'Изоляция, одиночество',
      element: 'Земля', planet: 'Уран' },
    { id: 10, name: 'Колесо Фортуны', nameEn: 'Wheel of Fortune', image: 'img/tarot/m10.webp',
      meaning: 'Перемены, судьба, поворотный момент',
      reversed: 'Сопротивление переменам, неудача',
      element: 'Огонь', planet: 'Юпитер' },
    { id: 11, name: 'Справедливость', nameEn: 'Justice', image: 'img/tarot/m11.webp',
      meaning: 'Честность, истина, закон',
      reversed: 'Несправедливость, предвзятость',
      element: 'Воздух', planet: 'Венера' },
    { id: 12, name: 'Повешенный', nameEn: 'The Hanged Man', image: 'img/tarot/m12.webp',
      meaning: 'Жертва, новая перспектива, ожидание',
      reversed: 'Застой, эгоизм',
      element: 'Вода', planet: 'Нептун' },
    { id: 13, name: 'Смерть', nameEn: 'Death', image: 'img/tarot/m13.webp',
      meaning: 'Трансформация, завершение, новое начало',
      reversed: 'Сопротивление переменам, застой',
      element: 'Вода', planet: 'Плутон' },
    { id: 14, name: 'Умеренность', nameEn: 'Temperance', image: 'img/tarot/m14.webp',
      meaning: 'Баланс, терпение, гармония',
      reversed: 'Дисбаланс, нетерпение',
      element: 'Огонь', planet: 'Сатурн' },
    { id: 15, name: 'Дьявол', nameEn: 'The Devil', image: 'img/tarot/m15.webp',
      meaning: 'Привязанность, зависимость, материализм',
      reversed: 'Освобождение, независимость',
      element: 'Земля', planet: 'Сатурн' },
    { id: 16, name: 'Башня', nameEn: 'The Tower', image: 'img/tarot/m16.webp',
      meaning: 'Внезапные перемены, крах иллюзий',
      reversed: 'Избегание катастрофы, отложенный кризис',
      element: 'Огонь', planet: 'Марс' },
    { id: 17, name: 'Звезда', nameEn: 'The Star', image: 'img/tarot/m17.webp',
      meaning: 'Надежда, вдохновение, исцеление',
      reversed: 'Отчаяние, потеря веры',
      element: 'Воздух', planet: 'Уран' },
    { id: 18, name: 'Луна', nameEn: 'The Moon', image: 'img/tarot/m18.webp',
      meaning: 'Иллюзии, страхи, подсознание',
      reversed: 'Прояснение, преодоление страхов',
      element: 'Вода', planet: 'Луна' },
    { id: 19, name: 'Солнце', nameEn: 'The Sun', image: 'img/tarot/m19.webp',
      meaning: 'Радость, успех, позитив',
      reversed: 'Пессимизм, временные трудности',
      element: 'Огонь', planet: 'Солнце' },
    { id: 20, name: 'Суд', nameEn: 'Judgement', image: 'img/tarot/m20.webp',
      meaning: 'Пробуждение, прощение, переоценка',
      reversed: 'Сомнения, самоосуждение',
      element: 'Огонь', planet: 'Плутон' },
    { id: 21, name: 'Мир', nameEn: 'The World', image: 'img/tarot/m21.webp',
      meaning: 'Завершение, гармония, целостность',
      reversed: 'Незавершённость, задержки',
      element: 'Земля', planet: 'Сатурн' }
];

// Младшие Арканы (для расширенного функционала)
const MINOR_ARCANA = {
    cups: [
        { id: 'c01', image: 'img/tarot/c01.webp', name: 'Туз Кубков', nameEn: 'Ace of Cups', element: 'Вода', meaning: 'Новая любовь, эмоции, начало отношений', reversed: 'Подавленные чувства, блок сердца, пустота' },
        { id: 'c02', image: 'img/tarot/c02.webp', name: '2 Кубков', nameEn: 'Two of Cups', element: 'Вода', meaning: 'Союз, партнёрство, гармония', reversed: 'Разлад, неравенство, расставание' },
        { id: 'c03', image: 'img/tarot/c03.webp', name: '3 Кубков', nameEn: 'Three of Cups', element: 'Вода', meaning: 'Празднование, дружба, радость', reversed: 'Сплетни, одиночество, излишества' },
        { id: 'c04', image: 'img/tarot/c04.webp', name: '4 Кубков', nameEn: 'Four of Cups', element: 'Вода', meaning: 'Апатия, скука, неудовлетворённость', reversed: 'Новые возможности, выход из застоя' },
        { id: 'c05', image: 'img/tarot/c05.webp', name: '5 Кубков', nameEn: 'Five of Cups', element: 'Вода', meaning: 'Потеря, сожаление, принятие', reversed: 'Прощение, восстановление, принятие' },
        { id: 'c06', image: 'img/tarot/c06.webp', name: '6 Кубков', nameEn: 'Six of Cups', element: 'Вода', meaning: 'Ностальгия, детство, воспоминания', reversed: 'Застревание в прошлом, тоска' },
        { id: 'c07', image: 'img/tarot/c07.webp', name: '7 Кубков', nameEn: 'Seven of Cups', element: 'Вода', meaning: 'Иллюзии, мечты, выбор', reversed: 'Ясность, решение, отрезвление' },
        { id: 'c08', image: 'img/tarot/c08.webp', name: '8 Кубков', nameEn: 'Eight of Cups', element: 'Вода', meaning: 'Уход, оставление, поиск', reversed: 'Страх перемен, возврат, незавершённость' },
        { id: 'c09', image: 'img/tarot/c09.webp', name: '9 Кубков', nameEn: 'Nine of Cups', element: 'Вода', meaning: 'Исполнение желаний, удовлетворение', reversed: 'Неудовлетворённость, самодовольство' },
        { id: 'c10', image: 'img/tarot/c10.webp', name: '10 Кубков', nameEn: 'Ten of Cups', element: 'Вода', meaning: 'Семейное счастье, гармония', reversed: 'Разлад в семье, отчуждение' },
        { id: 'c11', image: 'img/tarot/c11.webp', name: 'Паж Кубков', nameEn: 'Page of Cups', element: 'Вода', meaning: 'Романтика, творчество, новости', reversed: 'Незрелость, обидчивость, блок творчества' },
        { id: 'c12', image: 'img/tarot/c12.webp', name: 'Рыцарь Кубков', nameEn: 'Knight of Cups', element: 'Вода', meaning: 'Предложение, романтика, страсть', reversed: 'Разочарование, нестабильность, лживые обещания' },
        { id: 'c13', image: 'img/tarot/c13.webp', name: 'Королева Кубков', nameEn: 'Queen of Cups', element: 'Вода', meaning: 'Эмпатия, интуиция, забота', reversed: 'Созависимость, эмоциональный хаос' },
        { id: 'c14', image: 'img/tarot/c14.webp', name: 'Король Кубков', nameEn: 'King of Cups', element: 'Вода', meaning: 'Эмоциональная зрелость, дипломатия', reversed: 'Манипуляция, холодность, подавленные эмоции' }
    ],
    wands: [
        { id: 'w01', image: 'img/tarot/w01.webp', name: 'Туз Жезлов', nameEn: 'Ace of Wands', element: 'Огонь', meaning: 'Вдохновение, начинание, страсть', reversed: 'Задержка, блок творчества, сомнение' },
        { id: 'w02', image: 'img/tarot/w02.webp', name: '2 Жезлов', nameEn: 'Two of Wands', element: 'Огонь', meaning: 'Планирование, выбор, перспективы', reversed: 'Страх неизвестного, нерешительность, застой' },
        { id: 'w03', image: 'img/tarot/w03.webp', name: '3 Жезлов', nameEn: 'Three of Wands', element: 'Огонь', meaning: 'Прогресс, экспансия, видение', reversed: 'Задержка, разочарование, препятствия' },
        { id: 'w04', image: 'img/tarot/w04.webp', name: '4 Жезлов', nameEn: 'Four of Wands', element: 'Огонь', meaning: 'Стабильность, дом, праздник', reversed: 'Нестабильность, конфликт в доме' },
        { id: 'w05', image: 'img/tarot/w05.webp', name: '5 Жезлов', nameEn: 'Five of Wands', element: 'Огонь', meaning: 'Конфликт, конкуренция, борьба', reversed: 'Разрешение, компромисс, окончание спора' },
        { id: 'w06', image: 'img/tarot/w06.webp', name: '6 Жезлов', nameEn: 'Six of Wands', element: 'Огонь', meaning: 'Победа, признание, успех', reversed: 'Поражение, гордыня, недооценка' },
        { id: 'w07', image: 'img/tarot/w07.webp', name: '7 Жезлов', nameEn: 'Seven of Wands', element: 'Огонь', meaning: 'Защита, оборона, стойкость', reversed: 'Сдача позиций, переутомление, сомнение' },
        { id: 'w08', image: 'img/tarot/w08.webp', name: '8 Жезлов', nameEn: 'Eight of Wands', element: 'Огонь', meaning: 'Скорость, действия, прогресс', reversed: 'Задержки, недоразумения, разочарование' },
        { id: 'w09', image: 'img/tarot/w09.webp', name: '9 Жезлов', nameEn: 'Nine of Wands', element: 'Огонь', meaning: 'Стойкость, защита, границы', reversed: 'Истощение, паранойя, усталость' },
        { id: 'w10', image: 'img/tarot/w10.webp', name: '10 Жезлов', nameEn: 'Ten of Wands', element: 'Огонь', meaning: 'Бремя, ответственность, нагрузка', reversed: 'Освобождение, делегирование, облегчение' },
        { id: 'w11', image: 'img/tarot/w11.webp', name: 'Паж Жезлов', nameEn: 'Page of Wands', element: 'Огонь', meaning: 'Энтузиазм, исследование, новости', reversed: 'Разброс, незрелость, задержка старта' },
        { id: 'w12', image: 'img/tarot/w12.webp', name: 'Рыцарь Жезлов', nameEn: 'Knight of Wands', element: 'Огонь', meaning: 'Энергия, приключения, импульс', reversed: 'Импульсивность, безрассудство, задержка' },
        { id: 'w13', image: 'img/tarot/w13.webp', name: 'Королева Жезлов', nameEn: 'Queen of Wands', element: 'Огонь', meaning: 'Уверенность, харизма, независимость', reversed: 'Ревность, тщеславие, неуверенность' },
        { id: 'w14', image: 'img/tarot/w14.webp', name: 'Король Жезлов', nameEn: 'King of Wands', element: 'Огонь', meaning: 'Лидерство, видение, страсть', reversed: 'Диктатура, импульсивность, высокомерие' }
    ],
    swords: [
        { id: 's01', image: 'img/tarot/s01.webp', name: 'Туз Мечей', nameEn: 'Ace of Swords', element: 'Воздух', meaning: 'Ясность, прорыв, истина', reversed: 'Путаница, ложь, тупик' },
        { id: 's02', image: 'img/tarot/s02.webp', name: '2 Мечей', nameEn: 'Two of Swords', element: 'Воздух', meaning: 'Трудный выбор, тупик', reversed: 'Нерешительность, тупик, правда всплывает' },
        { id: 's03', image: 'img/tarot/s03.webp', name: '3 Мечей', nameEn: 'Three of Swords', element: 'Воздух', meaning: 'Разбитое сердце, боль', reversed: 'Исцеление, прощение, снятие боли' },
        { id: 's04', image: 'img/tarot/s04.webp', name: '4 Мечей', nameEn: 'Four of Swords', element: 'Воздух', meaning: 'Отдых, восстановление, медитация', reversed: 'Выгорание, беспокойство, пробуждение' },
        { id: 's05', image: 'img/tarot/s05.webp', name: '5 Мечей', nameEn: 'Five of Swords', element: 'Воздух', meaning: 'Конфликт, победа любой ценой', reversed: 'Примирение, раскаяние, прощение' },
        { id: 's06', image: 'img/tarot/s06.webp', name: '6 Мечей', nameEn: 'Six of Swords', element: 'Воздух', meaning: 'Переход, путешествие, исцеление', reversed: 'Застревание, сопротивление, невозможность уйти' },
        { id: 's07', image: 'img/tarot/s07.webp', name: '7 Мечей', nameEn: 'Seven of Swords', element: 'Воздух', meaning: 'Хитрость, обман, стратегия', reversed: 'Раскрытие, совесть, признание' },
        { id: 's08', image: 'img/tarot/s08.webp', name: '8 Мечей', nameEn: 'Eight of Swords', element: 'Воздух', meaning: 'Ограничения, страх, беспомощность', reversed: 'Освобождение, ясность, выход' },
        { id: 's09', image: 'img/tarot/s09.webp', name: '9 Мечей', nameEn: 'Nine of Swords', element: 'Воздух', meaning: 'Тревога, ночные кошмары, страхи', reversed: 'Облегчение, выход из страха, надежда' },
        { id: 's10', image: 'img/tarot/s10.webp', name: '10 Мечей', nameEn: 'Ten of Swords', element: 'Воздух', meaning: 'Конец, предательство, крах', reversed: 'Восстановление, конец кошмара, урок' },
        { id: 's11', image: 'img/tarot/s11.webp', name: 'Паж Мечей', nameEn: 'Page of Swords', element: 'Воздух', meaning: 'Бдительность, наблюдение, любопытство', reversed: 'Сплетни, цинизм, поспешность' },
        { id: 's12', image: 'img/tarot/s12.webp', name: 'Рыцарь Мечей', nameEn: 'Knight of Swords', element: 'Воздух', meaning: 'Скорость, прямота, агрессия', reversed: 'Агрессия, поспешность, безрассудство' },
        { id: 's13', image: 'img/tarot/s13.webp', name: 'Королева Мечей', nameEn: 'Queen of Swords', element: 'Воздух', meaning: 'Рациональность, независимость', reversed: 'Холодность, горечь, жестокость' },
        { id: 's14', image: 'img/tarot/s14.webp', name: 'Король Мечей', nameEn: 'King of Swords', element: 'Воздух', meaning: 'Интеллект, авторитет, правда', reversed: 'Жёсткость, манипуляция, тирания' }
    ],
    pentacles: [
        { id: 'p01', image: 'img/tarot/p01.webp', name: 'Туз Пентаклей', nameEn: 'Ace of Pentacles', element: 'Земля', meaning: 'Возможность, ресурс, начало', reversed: 'Упущенный шанс, жадность, нестабильность' },
        { id: 'p02', image: 'img/tarot/p02.webp', name: '2 Пентаклей', nameEn: 'Two of Pentacles', element: 'Земля', meaning: 'Баланс, адаптация, многозадачность', reversed: 'Перегрузка, дисбаланс, хаос' },
        { id: 'p03', image: 'img/tarot/p03.webp', name: '3 Пентаклей', nameEn: 'Three of Pentacles', element: 'Земля', meaning: 'Команда, мастерство, качество', reversed: 'Конфликт в команде, халтура, несогласованность' },
        { id: 'p04', image: 'img/tarot/p04.webp', name: '4 Пентаклей', nameEn: 'Four of Pentacles', element: 'Земля', meaning: 'Контроль, сохранение, скупость', reversed: 'Жадность, страх потери, скупость' },
        { id: 'p05', image: 'img/tarot/p05.webp', name: '5 Пентаклей', nameEn: 'Five of Pentacles', element: 'Земля', meaning: 'Потеря, трудности, изоляция', reversed: 'Восстановление, помощь, выход из бедности' },
        { id: 'p06', image: 'img/tarot/p06.webp', name: '6 Пентаклей', nameEn: 'Six of Pentacles', element: 'Земля', meaning: 'Щедрость, помощь, баланс', reversed: 'Неравенство, долги, эксплуатация' },
        { id: 'p07', image: 'img/tarot/p07.webp', name: '7 Пентаклей', nameEn: 'Seven of Pentacles', element: 'Земля', meaning: 'Ожидание, оценка, терпение', reversed: 'Нетерпение, провал плана, пустые усилия' },
        { id: 'p08', image: 'img/tarot/p08.webp', name: '8 Пентаклей', nameEn: 'Eight of Pentacles', element: 'Земля', meaning: 'Мастерство, труд, развитие', reversed: 'Халтура, скука, отсутствие роста' },
        { id: 'p09', image: 'img/tarot/p09.webp', name: '9 Пентаклей', nameEn: 'Nine of Pentacles', element: 'Земля', meaning: 'Достаток, самодостаточность', reversed: 'Зависимость, демонстрация, пустота' },
        { id: 'p10', image: 'img/tarot/p10.webp', name: '10 Пентаклей', nameEn: 'Ten of Pentacles', element: 'Земля', meaning: 'Наследие, семья, богатство', reversed: 'Семейный конфликт, потеря, нестабильность' },
        { id: 'p11', image: 'img/tarot/p11.webp', name: 'Паж Пентаклей', nameEn: 'Page of Pentacles', element: 'Земля', meaning: 'Обучение, возможности, рост', reversed: 'Лень, упущенный шанс, непрактичность' },
        { id: 'p12', image: 'img/tarot/p12.webp', name: 'Рыцарь Пентаклей', nameEn: 'Knight of Pentacles', element: 'Земля', meaning: 'Терпение, работа, надёжность', reversed: 'Инертность, скука, упрямство' },
        { id: 'p13', image: 'img/tarot/p13.webp', name: 'Королева Пентаклей', nameEn: 'Queen of Pentacles', element: 'Земля', meaning: 'Забота, изобилие, природа', reversed: 'Меркантильность, пренебрежение собой, хаос' },
        { id: 'p14', image: 'img/tarot/p14.webp', name: 'Король Пентаклей', nameEn: 'King of Pentacles', element: 'Земля', meaning: 'Успех, стабильность, процветание', reversed: 'Коррупция, скупость, материализм' }
    ]
};

// --- Данные гороскопа (знаки зодиака) ---
const ZODIAC_SIGNS = [
    { id: 'aries', name: 'Овен', emoji: '♈', dateStart: '21.03', dateEnd: '19.04', element: 'Огонь', quality: 'Кардинальный', planet: 'Марс' },
    { id: 'taurus', name: 'Телец', emoji: '♉', dateStart: '20.04', dateEnd: '20.05', element: 'Земля', quality: 'Фиксированный', planet: 'Венера' },
    { id: 'gemini', name: 'Близнецы', emoji: '♊', dateStart: '21.05', dateEnd: '20.06', element: 'Воздух', quality: 'Мутабельный', planet: 'Меркурий' },
    { id: 'cancer', name: 'Рак', emoji: '♋', dateStart: '21.06', dateEnd: '22.07', element: 'Вода', quality: 'Кардинальный', planet: 'Луна' },
    { id: 'leo', name: 'Лев', emoji: '♌', dateStart: '23.07', dateEnd: '22.08', element: 'Огонь', quality: 'Фиксированный', planet: 'Солнце' },
    { id: 'virgo', name: 'Дева', emoji: '♍', dateStart: '23.08', dateEnd: '22.09', element: 'Земля', quality: 'Мутабельный', planet: 'Меркурий' },
    { id: 'libra', name: 'Весы', emoji: '♎', dateStart: '23.09', dateEnd: '22.10', element: 'Воздух', quality: 'Кардинальный', planet: 'Венера' },
    { id: 'scorpio', name: 'Скорпион', emoji: '♏', dateStart: '23.10', dateEnd: '21.11', element: 'Вода', quality: 'Фиксированный', planet: 'Плутон' },
    { id: 'sagittarius', name: 'Стрелец', emoji: '♐', dateStart: '22.11', dateEnd: '21.12', element: 'Огонь', quality: 'Мутабельный', planet: 'Юпитер' },
    { id: 'capricorn', name: 'Козерог', emoji: '♑', dateStart: '22.12', dateEnd: '19.01', element: 'Земля', quality: 'Кардинальный', planet: 'Сатурн' },
    { id: 'aquarius', name: 'Водолей', emoji: '♒', dateStart: '20.01', dateEnd: '18.02', element: 'Воздух', quality: 'Фиксированный', planet: 'Уран' },
    { id: 'pisces', name: 'Рыбы', emoji: '♓', dateStart: '19.02', dateEnd: '20.03', element: 'Вода', quality: 'Мутабельный', planet: 'Нептун' }
];

// --- Гороскоп-тексты (сгенерированные с учётом психологии) ---
const HOROSCOPE_TEXTS = {
    aries: {
        general: 'Сегодня ваша энергия на пике. Марс даёт вам силу для новых начинаний.',
        love: 'В любви сегодня возможны неожиданные повороты. Будьте открыты к спонтанности.',
        career: 'Работа требует решительности. Ваши лидерские качества проявятся ярко.',
        health: 'Физическая активность принесёт удовольствие. Займитесь спортом.',
        advice: 'Не бойтесь действовать первыми. Ваша инициатива будет вознаграждена.'
    },
    taurus: {
        general: 'Стабильный день для финансовых дел. Венера благоволит комфорту.',
        love: 'Романтика в воздухе. Устройте вечер для двоих.',
        career: 'Постепенное движение к цели. Не торопитесь, качество важнее скорости.',
        health: 'Обратите внимание на питание. Организму нужны витамины.',
        advice: 'Наслаждайтесь моментом. Иногда лучшее действие — это пауза.'
    },
    gemini: {
        general: 'Общительный день. Меркурий активирует ваши коммуникативные способности.',
        love: 'Флирт и лёгкость в отношениях. Новые знакомства вероятны.',
        career: 'Многозадачность — ваш конёк сегодня. Успевайте всё!',
        health: 'Ментальная активность требует отдыха. Сделайте перерыв на свежем воздухе.',
        advice: 'Делитесь идеями. Ваше слово может вдохновить других.'
    },
    cancer: {
        general: 'Эмоциональный день. Прислушайтесь к своей интуиции.',
        love: 'Домашний уют и забота — главные темы дня.',
        career: 'Работайте в комфортном темпе. Избегайте стресса.',
        health: 'Водные процедуры помогут снять напряжение.',
        advice: 'Позаботьтесь о себе. Ваши чувства имеют значение.'
    },
    leo: {
        general: 'День творчества и самовыражения. Сияйте ярко!',
        love: 'Страсть и романтика. Устройте свидание с огоньком.',
        career: 'Ваши таланты заметят. Будьте в центре внимания.',
        health: 'Энергии много — направьте её в спорт или хобби.',
        advice: 'Верьте в себя. Ваша уверенность притягивает удачу.'
    },
    virgo: {
        general: 'Детали имеют значение. Наводите порядок в делах.',
        love: 'Забота и внимание к партнёру укрепят отношения.',
        career: 'Аналитический склад ума поможет решить сложные задачи.',
        health: 'Обратите внимание на пищеварение. Лёгкая еда — хороший выбор.',
        advice: 'Совершенство не всегда необходимо. Иногда «хорошо» — достаточно.'
    },
    libra: {
        general: 'Гармония и красота вокруг. Ищите баланс во всём.',
        love: 'Романтика и эстетика. Свидание в красивом месте — отличная идея.',
        career: 'Партнёрство и командная работа принесут успех.',
        health: 'Красота и здоровье связаны. Уход за собой поднимет настроение.',
        advice: 'Доверяйте своей интуиции в выборе пути.'
    },
    scorpio: {
        general: 'Глубинные процессы. Трансформация неизбежна.',
        love: 'Страсть и интенсивность. Отношения могут выйти на новый уровень.',
        career: 'Скрытые возможности откроются. Будьте внимательны к деталям.',
        health: 'Эмоциональная разгрузка необходима. Медитация поможет.',
        advice: 'Позвольте себе отпустить то, что больше не служит вам.'
    },
    sagittarius: {
        general: 'Приключения и путешествия манят. Расширяйте горизонты.',
        love: 'Спонтанность и оптимизм в любви. Будьте открыты новому.',
        career: 'Обучение и рост. Новые знания приведут к успеху.',
        health: 'Активный отдых на природе восстановит силы.',
        advice: 'Следуйте за своим любопытством. Оно ведёт к счастью.'
    },
    capricorn: {
        general: 'Дисциплина и ответственность. Ваш труд будет вознаграждён.',
        love: 'Стабильность и преданность в отношениях. Планируйте будущее.',
        career: 'Карьерный рост реален. Покажите свои амбиции.',
        health: 'Костная система требует внимания. Кальций и движение важны.',
        advice: 'Маленькие шаги каждый день ведут к большим достижениям.'
    },
    aquarius: {
        general: 'Инновации и неожиданные идеи. Будьте оригинальны.',
        love: 'Нестандартный подход к любви освежит отношения.',
        career: 'Командная работа над инновационными проектами.',
        health: 'Технологии могут помочь следить за здоровьем.',
        advice: 'Ваша уникальность — ваша сила. Не бойтесь выделяться.'
    },
    pisces: {
        general: 'Интуиция на высоте. Доверяйте своим снам и предчувствиям.',
        love: 'Романтика и духовная связь. Идеальное время для признаний.',
        career: 'Творческие профессии принесут удовлетворение.',
        health: 'Вода и музыка успокоят нервную систему.',
        advice: 'Мечтайте смело. Ваши фантазии могут стать реальностью.'
    }
};

// --- Вспомогательные функции ---
function _esInjectStyles() {
    if (document.getElementById('es-styles')) return;
    const s = document.createElement('style');
    s.id = 'es-styles';
    s.textContent = `
        /* Общие стили */
        .es-tabs {
            display: flex; gap: 8px; margin-bottom: 24px;
            border-bottom: 1px solid rgba(224,224,224,0.1); padding-bottom: 12px;
            overflow-x: auto; scrollbar-width: none;
        }
        .es-tabs::-webkit-scrollbar { display: none; }
        .es-tab {
            background: none; border: none; padding: 8px 20px;
            font-size: 14px; font-weight: 600; cursor: pointer;
            color: var(--text-secondary); border-radius: 30px;
            transition: all 0.2s; white-space: nowrap;
            font-family: inherit;
        }
        .es-tab.active {
            background: rgba(224,224,224,0.12);
            color: var(--text-primary);
        }
        
        /* Таро */
        .tarot-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
            gap: 16px; margin: 20px 0;
        }
        .tarot-card {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 12px 8px;
            text-align: center; cursor: pointer;
            transition: transform 0.2s, background 0.2s;
        }
        .tarot-card:hover {
            transform: translateY(-4px);
            background: rgba(224,224,224,0.1);
        }
        .tarot-card img {
            width: 70px; height: auto; border-radius: 12px;
            margin-bottom: 8px; background: #1a1a1a;
        }
        .tarot-card-name {
            font-size: 12px; font-weight: 500;
        }
        .tarot-reading {
            background: linear-gradient(135deg, rgba(224,224,224,0.06), rgba(0,0,0,0.2));
            border-radius: 24px; padding: 20px; margin-top: 20px;
        }
        .reading-card {
            display: flex; gap: 20px; margin-bottom: 20px;
            align-items: center; flex-wrap: wrap;
        }
        .reading-card img {
            width: 80px; border-radius: 16px;
        }
        
        /* Гороскоп */
        .horoscope-signs {
            display: flex; flex-wrap: wrap; gap: 10px;
            margin: 20px 0;
        }
        .sign-btn {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px; padding: 10px 18px;
            cursor: pointer; transition: all 0.2s;
            font-family: inherit; font-size: 14px;
            color: var(--text-primary);
        }
        .sign-btn.active {
            background: rgba(224,224,224,0.15);
            border-color: rgba(224,224,224,0.3);
            color: var(--text-primary);
        }
        .horoscope-category {
            display: flex; gap: 8px; margin-bottom: 16px;
            flex-wrap: wrap;
        }
        .horoscope-cat-btn {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 30px; padding: 6px 14px;
            font-size: 12px; cursor: pointer;
            font-family: inherit;
            color: var(--text-primary);
        }
        .horoscope-cat-btn.active {
            background: rgba(224,224,224,0.12);
            color: var(--text-primary);
        }
        
        /* Натальная карта */
        .natal-placeholder {
            text-align: center; padding: 40px;
            background: rgba(224,224,224,0.03);
            border-radius: 24px; margin-top: 20px;
        }
        .natal-input-group {
            margin-bottom: 16px; text-align: left;
        }
        .natal-input-group label {
            display: block; font-size: 12px;
            margin-bottom: 6px; color: var(--text-secondary);
        }
        .natal-input {
            width: 100%; padding: 12px;
            border-radius: 30px;
            border: 1px solid rgba(224,224,224,0.2);
            background: rgba(0,0,0,0.3);
            color: var(--text-primary);
            font-family: inherit;
        }
        .planet-row {
            display: flex; justify-content: space-between;
            padding: 8px 0; border-bottom: 1px solid rgba(224,224,224,0.05);
        }
        .planet-name { font-weight: 600; width: 100px; }
        
        /* Кнопки и подсказки (self-contained, не зависит от hypnosis.js) */
        .hy-btn {
            padding: 11px 20px; border-radius: 30px; font-size: 13px; font-weight: 500;
            font-family: inherit; cursor: pointer; transition: background 0.2s, transform 0.15s;
            min-height: 42px; touch-action: manipulation; outline: none;
        }
        .hy-btn:active { transform: scale(0.97); }
        .hy-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); color: var(--text-primary);
            width: 100%; border-radius: 40px; padding: 13px;
        }
        .hy-btn-ghost {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .hy-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .hy-suggestion-box {
            background: rgba(224,224,224,0.06); border-radius: 14px; padding: 16px;
            margin-bottom: 14px;
        }
        .hy-suggestion-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
            text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;
        }
        .hy-suggestion-text {
            font-size: 15px; font-style: italic; line-height: 1.7; color: var(--text-primary);
        }
        .hy-tip {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px; padding: 12px 14px; font-size: 12px;
            color: var(--text-secondary); line-height: 1.5; margin-top: 12px;
        }
        .hy-tip strong { color: var(--chrome); }

        @media (max-width: 480px) {
            .tarot-grid { grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 10px; }
            .tarot-card img { width: 55px; }
            .tarot-card-name { font-size: 10px; }
            .reading-card { flex-direction: column; text-align: center; }
            .hy-suggestion-text { font-size: 14px; }
            .hy-suggestion-box { padding: 14px; }
        }

        /* Светлая тема: инвертируем полупрозрачные фоны (были светло-серые
           на тёмном — теперь тёмные на светлом), чтобы элементы оставались
           видимыми и не было «тёмного на тёмном» в input-полях. */
        [data-theme="light"] .es-tabs {
            border-bottom-color: rgba(0,0,0,0.08);
        }
        [data-theme="light"] .es-tab.active,
        [data-theme="light"] .horoscope-cat-btn.active {
            background: rgba(0,0,0,0.08);
        }
        [data-theme="light"] .tarot-card,
        [data-theme="light"] .sign-btn,
        [data-theme="light"] .horoscope-cat-btn,
        [data-theme="light"] .hy-suggestion-box,
        [data-theme="light"] .natal-placeholder,
        [data-theme="light"] .hy-tip {
            background: rgba(0,0,0,0.035);
            border-color: rgba(0,0,0,0.08);
        }
        [data-theme="light"] .tarot-card:hover {
            background: rgba(0,0,0,0.08);
        }
        [data-theme="light"] .sign-btn.active {
            background: rgba(0,0,0,0.1);
            border-color: rgba(0,0,0,0.18);
        }
        [data-theme="light"] .tarot-reading {
            background: linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.09));
        }
        [data-theme="light"] .tarot-card img {
            background: #e8e8ed;
        }
        [data-theme="light"] .natal-input {
            background: rgba(0,0,0,0.04);
            border-color: rgba(0,0,0,0.15);
            color: var(--text-primary);
        }
        [data-theme="light"] .natal-input::placeholder {
            color: rgba(0,0,0,0.4);
        }
        [data-theme="light"] .hy-btn-primary {
            background: linear-gradient(135deg, rgba(0,0,0,0.08), rgba(0,0,0,0.04));
            border-color: rgba(0,0,0,0.18);
            color: var(--text-primary);
        }
        [data-theme="light"] .hy-btn-ghost {
            background: rgba(0,0,0,0.04);
            border-color: rgba(0,0,0,0.12);
        }
        [data-theme="light"] .hy-btn-ghost:hover {
            background: rgba(0,0,0,0.08);
            color: var(--text-primary);
        }
        [data-theme="light"] .planet-row {
            border-bottom-color: rgba(0,0,0,0.06);
        }
    `;
    document.head.appendChild(s);
}

function _esToast(msg, type) {
    if (window.showToast) window.showToast(msg, type || 'info');
    else console.log(`[Toast] ${msg}`);
}

function _esHome() {
    if (typeof renderDashboard === 'function') renderDashboard();
    else if (window.renderDashboard) window.renderDashboard();
}

function _esUid() {
    return window.CONFIG?.USER_ID;
}

// --- Трекинг действий в Эзотерике (fire-and-forget в FrediTracker) ---
function _esTrack(event, data) {
    try { window.FrediTracker?.track?.(event, data || {}); } catch (e) {}
}

// --- Безопасная подсветка markdown (**жирный**) для AI-интерпретаций ---
// Сначала экранируем HTML (XSS-защита), потом превращаем **bold** в <strong>.
function _esMdToHtml(text) {
    if (text == null) return '';
    const escaped = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    // **жирный** → <strong>жирный</strong>
    // (точно совпадает с parными ** и не цепляет одинарные *)
    return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// --- Определение знака зодиака по дате ---
function getZodiacSign(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
    return 'pisces';
}

// --- Получение гороскопа через backend (DeepSeek + Redis-кэш на 24ч) ---
// Fallback-цепочка: /api/horoscope → локальные тексты HOROSCOPE_TEXTS → общие.
async function fetchHoroscope(signId, category = 'general') {
    const sign = ZODIAC_SIGNS.find(s => s.id === signId);
    if (!sign) return null;

    const apiBase = window.CONFIG?.API_BASE_URL || window.API_BASE_URL;
    if (apiBase) {
        try {
            const response = await fetch(`${apiBase}/api/horoscope`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sign: signId,
                    category,
                    user_id: window.CONFIG?.USER_ID || window.USER_ID
                })
            });
            if (response.ok) {
                const data = await response.json();
                if (data?.success && typeof data.text === 'string' && data.text.trim()) {
                    return data.text.trim();
                }
            }
        } catch (e) {
            console.log('Backend horoscope недоступен, используем локальные тексты');
        }
    }

    // Fallback: локальные данные по знаку
    const texts = HOROSCOPE_TEXTS[signId];
    if (texts && texts[category]) return texts[category];

    // Общий fallback
    const fallbacks = {
        general: 'Сегодня хороший день для размышлений и новых начинаний. Прислушайтесь к своей интуиции.',
        love: 'Звёзды говорят о возможных переменах в личной жизни. Будьте открыты к новым знакомствам.',
        career: 'В работе возможны интересные предложения. Не упустите свой шанс.',
        health: 'Обратите внимание на режим сна и отдыха. Баланс — ключ к хорошему самочувствию.',
        advice: 'Доверяйте себе. Ваша внутренняя мудрость подскажет верный путь.'
    };
    return fallbacks[category] || fallbacks.general;
}

// --- Локальная (fallback) интерпретация одной карты ---
function _localCardInterpretation(card, isReversed) {
    const orientation = isReversed ? 'перевёрнутом' : 'прямом';
    const meaning = isReversed ? (card.reversed || card.meaning) : card.meaning;
    let out = `Карта **${card.name}**${card.nameEn ? ` (${card.nameEn})` : ''} в ${orientation} положении.\n\n`;
    out += `**Значение:** ${meaning}\n\n`;
    if (card.element) out += `**Стихия:** ${card.element}\n`;
    if (card.planet) out += `**Планета:** ${card.planet}\n`;
    out += `\nПрислушайтесь к тому, что отзывается в вас первым ощущением — часто это и есть ключ.`;
    return out;
}

// --- AI-интерпретация расклада через backend /api/tarot/interpret ---
// positionedCards: [{ card, reversed, position }]
async function fetchSpreadInterpretation(spreadType, positionedCards, question) {
    const apiBase = window.CONFIG?.API_BASE_URL || window.API_BASE_URL;
    if (apiBase) {
        try {
            const response = await fetch(`${apiBase}/api/tarot/interpret`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    spread_type: spreadType,
                    cards: positionedCards.map(pc => ({
                        id: pc.card.id,
                        name: pc.card.name,
                        reversed: !!pc.reversed
                    })),
                    question: question || '',
                    user_id: window.CONFIG?.USER_ID || window.USER_ID
                })
            });
            if (response.ok) {
                const data = await response.json();
                if (data?.success && typeof data.interpretation === 'string' && data.interpretation.trim()) {
                    return data.interpretation.trim();
                }
            }
        } catch (e) {
            console.log('Backend tarot недоступен, используем локальную интерпретацию');
        }
    }
    // Fallback: склеиваем локальные карточные значения
    return positionedCards.map(({ card, reversed, position }) => {
        const header = position ? `**${position}:**\n` : '';
        return header + _localCardInterpretation(card, reversed);
    }).join('\n\n—\n\n');
}

// --- Случайная карта Таро (из полной колоды 78 карт) ---
function getRandomTarotCard() {
    const deck = _allTarotCards();
    const card = deck[Math.floor(Math.random() * deck.length)];
    const isReversed = Math.random() > 0.7;
    return { card, isReversed };
}

// --- Символы планет/точек для UI ---
const PLANET_SYMBOLS = {
    'Солнце': '☉', 'Луна': '☽', 'Меркурий': '☿', 'Венера': '♀',
    'Марс': '♂', 'Юпитер': '♃', 'Сатурн': '♄', 'Уран': '♅',
    'Нептун': '♆', 'Плутон': '♇', 'Северный узел': '☊', 'Южный узел': '☋',
    'Хирон': '⚷', 'Асцендент': 'Asc', 'MC': 'MC', 'Десцендент': 'Desc', 'IC': 'IC'
};

function _planetSymbol(nameRu) {
    return PLANET_SYMBOLS[nameRu] || '★';
}

// --- Геокодинг через Nominatim (OpenStreetMap, бесплатно, без ключа) ---
async function geocodeCity(query) {
    if (!query || !query.trim()) return null;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ru&q=${encodeURIComponent(query.trim())}`;
    try {
        const r = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        if (!r.ok) { _esTrack('esoterica_geocode_used', { found: false, reason: 'http_' + r.status }); return null; }
        const arr = await r.json();
        if (!Array.isArray(arr) || arr.length === 0) {
            _esTrack('esoterica_geocode_used', { found: false, reason: 'empty' });
            return null;
        }
        const hit = arr[0];
        _esTrack('esoterica_geocode_used', { found: true });
        return {
            latitude: parseFloat(hit.lat),
            longitude: parseFloat(hit.lon),
            display_name: hit.display_name
        };
    } catch (e) {
        _esTrack('esoterica_geocode_used', { found: false, reason: 'error' });
        console.log('Nominatim geocoding failed:', e);
        return null;
    }
}

// --- Рендер компонентов ---
const SUITS = [
    { id: 'major',     label: '🌟 Старшие',  get: () => MAJOR_ARCANA },
    { id: 'cups',      label: '🏆 Кубки',    get: () => MINOR_ARCANA.cups },
    { id: 'wands',     label: '🔥 Жезлы',    get: () => MINOR_ARCANA.wands },
    { id: 'swords',    label: '⚔️ Мечи',    get: () => MINOR_ARCANA.swords },
    { id: 'pentacles', label: '💰 Пентакли', get: () => MINOR_ARCANA.pentacles }
];

function _findCardById(id) {
    for (const s of SUITS) {
        const deck = s.get();
        const found = deck.find(c => String(c.id) === String(id));
        if (found) return found;
    }
    return null;
}

function _allTarotCards() {
    return SUITS.flatMap(s => s.get());
}

function renderTarot() {
    const suit = SUITS.find(s => s.id === state.activeSuit) || SUITS[0];
    const deck = suit.get();
    const suitTabs = SUITS.map(s =>
        `<button class="sign-btn ${s.id === state.activeSuit ? 'active' : ''}" data-suit="${s.id}">${s.label}</button>`
    ).join('');
    const qEscaped = (state.question || '').replace(/"/g, '&quot;');
    return `
        <div class="horoscope-signs">${suitTabs}</div>
        <div class="tarot-grid">
            ${deck.map(card => `
                <div class="tarot-card" data-card-id="${card.id}">
                    <img src="${card.image}" alt="${card.name}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 150%22%3E%3Crect width=%22100%22 height=%22150%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2275%22 text-anchor=%22middle%22 fill=%22%23fff%22%3E${card.name}%3C/text%3E%3C/svg%3E'">
                    <div class="tarot-card-name">${card.name}</div>
                </div>
            `).join('')}
        </div>
        <div class="natal-input-group" style="margin-top: 8px;">
            <label for="tarotQuestion">❓ Ваш вопрос (необязательно)</label>
            <textarea id="tarotQuestion" class="natal-input" rows="2"
                      placeholder="Например: «Что мне важно понять про мои отношения сейчас?»"
                      style="resize:vertical;min-height:48px;">${qEscaped}</textarea>
        </div>
        <div style="display: flex; gap: 12px; margin: 14px 0; flex-wrap: wrap;">
            <button class="hy-btn hy-btn-primary" id="drawRandomCard">🎴 Карта дня</button>
            <button class="hy-btn hy-btn-primary" id="drawThreeCards">🃏 Прошлое · Настоящее · Будущее</button>
            <button class="hy-btn hy-btn-primary" id="drawCelticCross">🔮 Кельтский крест</button>
        </div>
        <div id="tarotResult"></div>
        <div class="hy-tip">
            💡 <strong>О Таро:</strong> Карты не предсказывают будущее — они показывают текущие энергии и возможные пути развития.
            Вопрос — не обязателен, но помогает Фреди дать более точную интерпретацию.
        </div>
    `;
}

function renderHoroscope() {
    const savedSign = localStorage.getItem('fredi_zodiac_sign');
    
    return `
        <div class="horoscope-signs">
            ${ZODIAC_SIGNS.map(sign => `
                <button class="sign-btn ${savedSign === sign.id ? 'active' : ''}" data-sign="${sign.id}">
                    ${sign.emoji} ${sign.name}
                </button>
            `).join('')}
        </div>
        <div class="horoscope-category">
            <button class="horoscope-cat-btn active" data-cat="general">🌟 Общий</button>
            <button class="horoscope-cat-btn" data-cat="love">💕 Любовь</button>
            <button class="horoscope-cat-btn" data-cat="career">💼 Карьера</button>
            <button class="horoscope-cat-btn" data-cat="health">🏃 Здоровье</button>
            <button class="horoscope-cat-btn" data-cat="advice">✨ Совет дня</button>
        </div>
        <div id="horoscopeResult"></div>
        <div class="hy-tip">
            💡 Гороскоп обновляется ежедневно. Для точности введите дату рождения в настройках профиля.
        </div>
    `;
}

function renderNatal() {
    const savedBirth = localStorage.getItem('fredi_birth_data');
    let birthHtml = '';
    
    if (savedBirth) {
        try {
            const data = JSON.parse(savedBirth);
            birthHtml = `
                <div class="natal-placeholder" style="margin-bottom: 16px; text-align: left;">
                    <div class="planet-row"><span class="planet-name">📅 Дата:</span> <span>${data.date}</span></div>
                    <div class="planet-row"><span class="planet-name">📍 Место:</span> <span>${data.place}</span></div>
                    <div class="planet-row"><span class="planet-name">♈ Знак:</span> <span>${data.sign}</span></div>
                    <button class="hy-btn hy-btn-ghost" id="clearBirthData" style="margin-top: 12px;">🗑️ Очистить данные</button>
                </div>
            `;
        } catch(e) {}
    }
    
    return `
        ${birthHtml}
        <div class="natal-placeholder">
            <span style="font-size: 48px;">🌟</span>
            <h3 style="margin: 16px 0;">Натальная карта</h3>
            <p style="margin-bottom: 20px; color: var(--text-secondary);">
                Введите данные для построения персональной астрологической карты
            </p>
            <div class="natal-input-group">
                <label>📅 Дата и время рождения</label>
                <input type="datetime-local" id="birthDateTime" class="natal-input">
            </div>
            <div class="natal-input-group">
                <label>📍 Место рождения</label>
                <input type="text" id="birthPlace" class="natal-input" placeholder="Город, страна">
            </div>
            <div class="natal-input-group">
                <label>🌍 Координаты (опционально)</label>
                <input type="text" id="birthCoords" class="natal-input" placeholder="широта, долгота">
            </div>
            <button class="hy-btn hy-btn-primary" id="buildNatalChart" style="margin-top: 12px;">
                🌟 Построить карту
            </button>
            <div id="natalResult" style="margin-top: 24px;"></div>
        </div>
        <div class="hy-tip">
            💡 Натальная карта — это астрологическая карта неба в момент вашего рождения. Она отражает ваш потенциал и жизненный путь.
        </div>
    `;
}

// --- Рендер результата расклада (1/3/10 карт + AI-интерпретация) ---
function _cardImgHtml(card, reversed, size) {
    const sz = size || 70;
    const fallback = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 150%22%3E%3Crect width=%22100%22 height=%22150%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2275%22 text-anchor=%22middle%22 fill=%22%23fff%22%3E${encodeURIComponent(card.name)}%3C/text%3E%3C/svg%3E`;
    const rot = reversed ? 'transform: rotate(180deg);' : '';
    return `<img src="${card.image}" alt="${card.name}" style="width:${sz}px;border-radius:12px;${rot}" onerror="this.src='${fallback}'">`;
}

async function showSpreadReading(spreadType, positionedCards) {
    const resultDiv = document.getElementById('tarotResult');
    if (!resultDiv) return;

    const question = (state.question || '').trim();
    const spreadInfo = TAROT_SPREADS[spreadType] || TAROT_SPREADS.day;

    _esTrack('tarot_spread_drawn', {
        spread_type: spreadType,
        card_count: positionedCards.length,
        has_question: !!question
    });

    // Быстрая выкладка карт, пока ждём AI
    const cardsRow = positionedCards.map(({ card, reversed, position }) => `
        <div style="text-align:center;min-width:80px;">
            ${_cardImgHtml(card, reversed, spreadType === 'celtic' ? 58 : 70)}
            <div style="font-size:11px;margin-top:4px;line-height:1.3;">
                ${position ? `<div style="color:var(--text-secondary);font-size:10px;">${position}</div>` : ''}
                ${card.name}${reversed ? ' ↺' : ''}
            </div>
        </div>`).join('');

    const questionHtml = question
        ? `<div class="hy-suggestion-box" style="margin-bottom:12px;"><div class="hy-suggestion-label">❓ Ваш вопрос</div><div class="hy-suggestion-text" style="font-style:normal;">${_esMdToHtml(question)}</div></div>`
        : '';

    resultDiv.innerHTML = `
        <div class="tarot-reading">
            <div class="hy-suggestion-label">${spreadInfo.label}</div>
            ${questionHtml}
            <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin:8px 0 16px;">${cardsRow}</div>
            <div class="hy-suggestion-box" id="tarotInterpretBox">
                <div class="hy-suggestion-label">🔮 Фреди интерпретирует...</div>
                <div class="hy-suggestion-text">Подождите секунду — Фреди читает расклад.</div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <button class="hy-btn hy-btn-ghost" id="copyTarotBtn">📋 Скопировать</button>
                <button class="hy-btn hy-btn-ghost" id="speakTarotBtn">🔊 Озвучить</button>
                <button class="hy-btn hy-btn-ghost" id="closeTarotBtn">✖️ Закрыть</button>
            </div>
        </div>`;

    const interpretation = await fetchSpreadInterpretation(spreadType, positionedCards, question);
    _esTrack('tarot_interpretation_rendered', {
        spread_type: spreadType,
        length: interpretation ? interpretation.length : 0
    });

    const box = document.getElementById('tarotInterpretBox');
    if (box) {
        box.innerHTML = `
            <div class="hy-suggestion-label">🔮 Интерпретация</div>
            <div class="hy-suggestion-text" style="white-space:pre-line;">${_esMdToHtml(interpretation)}</div>`;
    }

    document.getElementById('copyTarotBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(interpretation);
        _esToast('Скопировано', 'success');
    });
    document.getElementById('speakTarotBtn')?.addEventListener('click', () => {
        if (window.voiceManager) window.voiceManager.textToSpeech(interpretation, 'psychologist');
        else _esToast('Голосовой модуль не загружен', 'error');
    });
    document.getElementById('closeTarotBtn')?.addEventListener('click', () => {
        resultDiv.innerHTML = '';
    });
}

// Back-compat: оставляем старую сигнатуру для возможного внешнего использования
async function showTarotReading(card, isReversed = false, spreadType = 'day') {
    return showSpreadReading('day', [{
        card, reversed: !!isReversed, position: TAROT_SPREADS.day.positions[0]
    }]);
}

// --- Обработчики гороскопа ---
let currentHoroscopeSign = localStorage.getItem('fredi_zodiac_sign') || 'aries';
let currentHoroscopeCat = 'general';

async function loadHoroscope(signId, category) {
    const resultDiv = document.getElementById('horoscopeResult');
    if (!resultDiv) return;
    
    resultDiv.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">🔮 Загрузка гороскопа...</div></div>`;
    
    const horoscope = await fetchHoroscope(signId, category);
    _esTrack('horoscope_viewed', { sign: signId, category });
    const sign = ZODIAC_SIGNS.find(s => s.id === signId);
    
    const categoryNames = {
        general: '🌟 Общий гороскоп',
        love: '💕 Любовь и отношения',
        career: '💼 Карьера и финансы',
        health: '🏃 Здоровье и энергия',
        advice: '✨ Совет дня'
    };
    
    resultDiv.innerHTML = `
        <div class="hy-suggestion-box">
            <div class="hy-suggestion-label">${categoryNames[category] || category}</div>
            <div class="hy-suggestion-text" style="font-size: 16px; line-height: 1.6;">${_esMdToHtml(horoscope)}</div>
            <div style="margin-top: 16px; display: flex; gap: 12px;">
                <button class="hy-btn hy-btn-ghost" id="copyHoroscopeBtn">📋 Скопировать</button>
                <button class="hy-btn hy-btn-ghost" id="speakHoroscopeBtn">🔊 Озвучить</button>
            </div>
        </div>
        <div style="margin-top: 16px; padding: 12px; background: rgba(224,224,224,0.03); border-radius: 16px;">
            <div style="font-size: 12px; color: var(--text-secondary);">
                ${sign.emoji} ${sign.name} · Стихия: ${sign.element} · Планета: ${sign.planet}
            </div>
        </div>`;
    
    document.getElementById('copyHoroscopeBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(horoscope);
        _esToast('Скопировано', 'success');
    });
    
    document.getElementById('speakHoroscopeBtn')?.addEventListener('click', () => {
        if (window.voiceManager) window.voiceManager.textToSpeech(horoscope, 'psychologist');
    });
}

// --- Обработчики натальной карты ---
// Последний полученный JSON карты (для AI-интерпретации)
let _lastNatalChart = null;

async function buildNatalChart() {
    const dateTime = document.getElementById('birthDateTime')?.value;
    const place = document.getElementById('birthPlace')?.value?.trim();
    const coordsRaw = document.getElementById('birthCoords')?.value?.trim();

    if (!dateTime || !place) {
        _esToast('Заполните дату и место рождения', 'error');
        return;
    }

    const resultDiv = document.getElementById('natalResult');
    resultDiv.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">🔮 Определяем координаты места…</div></div>`;

    // 1. Координаты: из поля или через Nominatim
    let latitude = null, longitude = null, locationLabel = place;
    if (coordsRaw) {
        const m = coordsRaw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (m) { latitude = parseFloat(m[1]); longitude = parseFloat(m[2]); }
    }
    if (latitude === null || longitude === null) {
        const hit = await geocodeCity(place);
        if (!hit) {
            resultDiv.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">⚠️ Не удалось найти «${place}». Попробуйте добавить страну или ввести координаты вручную.</div></div>`;
            return;
        }
        latitude = hit.latitude;
        longitude = hit.longitude;
        locationLabel = hit.display_name || place;
    }

    // 2. Формат date_time в "YYYY-MM-DD HH:MM" (immanuel принимает naive local)
    const dt = dateTime.replace('T', ' ').slice(0, 16);

    resultDiv.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">🔮 Рассчитываем натальную карту (Swiss Ephemeris)…</div></div>`;

    // 3. Backend-вычисление
    const apiBase = window.CONFIG?.API_BASE_URL || window.API_BASE_URL;
    let chart = null;
    if (apiBase) {
        try {
            const r = await fetch(`${apiBase}/api/natal/chart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date_time: dt, latitude, longitude })
            });
            if (r.ok) {
                const data = await r.json();
                if (data?.success) chart = data;
                else resultDiv.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">⚠️ Ошибка расчёта: ${data?.error || 'неизвестно'}</div></div>`;
            } else {
                resultDiv.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">⚠️ Backend недоступен (HTTP ${r.status}). Натальная карта требует серверной части.</div></div>`;
            }
        } catch (e) {
            resultDiv.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">⚠️ Не удалось связаться с backend: ${e.message}</div></div>`;
        }
    }
    if (!chart) {
        _esTrack('natal_chart_built', { success: false });
        return;
    }

    _lastNatalChart = chart;
    _esTrack('natal_chart_built', {
        success: true,
        objects_count: (chart.objects || []).length,
        houses_count: (chart.houses || []).length,
        aspects_count: (chart.aspects || []).length
    });

    // 4. Сохраняем введённые данные
    const birthDate = new Date(dateTime);
    const sunSignId = getZodiacSign(birthDate);
    const signData = ZODIAC_SIGNS.find(s => s.id === sunSignId);
    localStorage.setItem('fredi_birth_data', JSON.stringify({
        date: dateTime, place: locationLabel,
        sign: signData?.name, coords: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
    }));
    localStorage.setItem('fredi_zodiac_sign', sunSignId);

    // 5. Рендер результата
    const planetRows = (chart.objects || []).map(o => {
        const deg = (typeof o.degree === 'number') ? ` — ${o.degree.toFixed(1)}°` : '';
        const house = o.house ? `, ${o.house} дом` : '';
        const retro = o.retrograde ? ' ℞' : '';
        const sym = _planetSymbol(o.name_ru || o.name_en);
        return `<div class="planet-row"><span class="planet-name">${sym} ${o.name_ru || o.name_en}</span><span>${o.sign_ru || o.sign_en}${deg}${house}${retro}</span></div>`;
    }).join('');

    const houseRows = (chart.houses || []).map(h => {
        const deg = (typeof h.degree === 'number') ? ` — ${h.degree.toFixed(1)}°` : '';
        return `<div class="planet-row"><span class="planet-name">Дом ${h.number}</span><span>${h.sign_ru || h.sign_en}${deg}</span></div>`;
    }).join('');

    const aspectRows = (chart.aspects || []).slice(0, 20).map(a => {
        const orb = (typeof a.orb === 'number') ? ` (орб ${a.orb.toFixed(1)}°)` : '';
        return `<div class="planet-row"><span class="planet-name">${a.from_ru || a.from_en}</span><span>${a.aspect_ru || a.aspect_en} → ${a.to_ru || a.to_en}${orb}</span></div>`;
    }).join('');

    const sun = (chart.objects || []).find(o => (o.name_en === 'Sun') || (o.name_ru === 'Солнце'));
    const moon = (chart.objects || []).find(o => (o.name_en === 'Moon') || (o.name_ru === 'Луна'));
    const asc = (chart.objects || []).find(o => (o.name_en === 'Ascendant') || (o.name_en === 'ASC') || (o.name_ru === 'Асцендент'));

    resultDiv.innerHTML = `
        <div class="tarot-reading">
            <div class="hy-suggestion-label">🌟 Ваша натальная карта</div>
            <div style="margin-bottom: 14px; font-size: 13px;">
                <div><strong>📅 Дата:</strong> ${birthDate.toLocaleString('ru-RU')}</div>
                <div><strong>📍 Место:</strong> ${locationLabel}</div>
                <div><strong>🌍 Координаты:</strong> ${latitude.toFixed(4)}, ${longitude.toFixed(4)}</div>
                ${sun  ? `<div><strong>☉ Солнце:</strong> ${sun.sign_ru || sun.sign_en}${sun.house ? `, ${sun.house} дом` : ''}</div>` : ''}
                ${moon ? `<div><strong>☽ Луна:</strong> ${moon.sign_ru || moon.sign_en}${moon.house ? `, ${moon.house} дом` : ''}</div>` : ''}
                ${asc  ? `<div><strong>↗ Асцендент:</strong> ${asc.sign_ru || asc.sign_en}</div>` : ''}
            </div>
            ${planetRows ? `<div class="hy-suggestion-label" style="margin-top: 14px;">🪐 Планеты и точки</div>${planetRows}` : ''}
            ${houseRows  ? `<div class="hy-suggestion-label" style="margin-top: 14px;">🏠 Дома (Placidus)</div>${houseRows}`   : ''}
            ${aspectRows ? `<div class="hy-suggestion-label" style="margin-top: 14px;">🔗 Основные аспекты</div>${aspectRows}` : ''}
            <div class="natal-input-group" style="margin-top: 16px;">
                <label for="natalQuestion">❓ Вопрос для Фреди (необязательно)</label>
                <textarea id="natalQuestion" class="natal-input" rows="2"
                          placeholder="Например: «На что обратить внимание в моей карьере?»"
                          style="resize:vertical;min-height:48px;"></textarea>
            </div>
            <button class="hy-btn hy-btn-primary" id="interpretNatalBtn" style="margin-top: 10px;">
                🔮 Фреди интерпретирует
            </button>
            <div id="natalInterpretBox" style="margin-top: 16px;"></div>
            <div style="display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap;">
                <button class="hy-btn hy-btn-ghost" id="copyNatalBtn">📋 Скопировать</button>
                <button class="hy-btn hy-btn-ghost" id="speakNatalBtn">🔊 Озвучить</button>
            </div>
        </div>`;

    document.getElementById('interpretNatalBtn')?.addEventListener('click', () => interpretNatalChart());

    document.getElementById('copyNatalBtn')?.addEventListener('click', () => {
        const text = document.querySelector('#natalInterpretBox .hy-suggestion-text')?.innerText
                  || document.querySelector('#natalResult .tarot-reading')?.innerText || '';
        navigator.clipboard.writeText(text);
        _esToast('Скопировано', 'success');
    });

    document.getElementById('speakNatalBtn')?.addEventListener('click', () => {
        const text = document.querySelector('#natalInterpretBox .hy-suggestion-text')?.innerText || '';
        if (text && window.voiceManager) window.voiceManager.textToSpeech(text, 'psychologist');
        else _esToast('Сначала получите интерпретацию от Фреди', 'info');
    });

    // Обновляем активный знак в гороскопе
    if (currentHoroscopeSign !== sunSignId) {
        currentHoroscopeSign = sunSignId;
    }
}

async function interpretNatalChart() {
    if (!_lastNatalChart) { _esToast('Сначала постройте натальную карту', 'error'); return; }
    const box = document.getElementById('natalInterpretBox');
    if (!box) return;
    const question = document.getElementById('natalQuestion')?.value?.trim() || '';

    box.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">🔮 Фреди читает вашу карту…</div></div>`;

    const apiBase = window.CONFIG?.API_BASE_URL || window.API_BASE_URL;
    let interpretation = 'Сервер временно недоступен. Попробуйте чуть позже.';
    let success = false;
    if (apiBase) {
        try {
            const r = await fetch(`${apiBase}/api/natal/interpret`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chart: { objects: _lastNatalChart.objects, aspects: _lastNatalChart.aspects },
                    question,
                    user_id: window.CONFIG?.USER_ID || window.USER_ID
                })
            });
            if (r.ok) {
                const data = await r.json();
                if (data?.success && data.interpretation) {
                    interpretation = data.interpretation;
                    success = true;
                }
            }
        } catch (e) { console.log('natal interpret failed:', e); }
    }
    _esTrack('natal_chart_interpreted', {
        success,
        has_question: !!question,
        length: interpretation.length
    });

    box.innerHTML = `
        <div class="hy-suggestion-box">
            <div class="hy-suggestion-label">🔮 Интерпретация Фреди</div>
            <div class="hy-suggestion-text" style="white-space:pre-line;">${_esMdToHtml(interpretation)}</div>
        </div>`;
}

// --- Привязка обработчиков ---
function _drawUnique(n) {
    const deck = _allTarotCards();
    const picks = [];
    const used = new Set();
    while (picks.length < n && picks.length < deck.length) {
        const i = Math.floor(Math.random() * deck.length);
        if (used.has(i)) continue;
        used.add(i);
        picks.push({ card: deck[i], reversed: Math.random() > 0.7 });
    }
    return picks;
}

function attachTarotHandlers() {
    document.querySelectorAll('[data-suit]').forEach(btn => {
        btn.addEventListener('click', () => {
            // сохраним вопрос перед ререндером
            const q = document.getElementById('tarotQuestion')?.value;
            if (typeof q === 'string') state.question = q;
            state.activeSuit = btn.dataset.suit;
            render();
        });
    });

    const qEl = document.getElementById('tarotQuestion');
    if (qEl) {
        qEl.addEventListener('input', () => { state.question = qEl.value; });
    }

    document.querySelectorAll('.tarot-card').forEach(card => {
        card.addEventListener('click', () => {
            const selected = _findCardById(card.dataset.cardId);
            if (!selected) return;
            const reversed = Math.random() > 0.7;
            showSpreadReading('day', [{
                card: selected, reversed, position: TAROT_SPREADS.day.positions[0]
            }]);
        });
    });

    document.getElementById('drawRandomCard')?.addEventListener('click', () => {
        const [pick] = _drawUnique(1);
        showSpreadReading('day', [{ ...pick, position: TAROT_SPREADS.day.positions[0] }]);
    });

    document.getElementById('drawThreeCards')?.addEventListener('click', () => {
        const picks = _drawUnique(3);
        showSpreadReading('three', picks.map((p, i) => ({
            ...p, position: TAROT_SPREADS.three.positions[i]
        })));
    });

    document.getElementById('drawCelticCross')?.addEventListener('click', () => {
        const picks = _drawUnique(10);
        showSpreadReading('celtic', picks.map((p, i) => ({
            ...p, position: TAROT_SPREADS.celtic.positions[i]
        })));
    });
}

function attachHoroscopeHandlers() {
    document.querySelectorAll('.sign-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sign-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHoroscopeSign = btn.dataset.sign;
            localStorage.setItem('fredi_zodiac_sign', currentHoroscopeSign);
            loadHoroscope(currentHoroscopeSign, currentHoroscopeCat);
        });
    });
    
    document.querySelectorAll('.horoscope-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.horoscope-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHoroscopeCat = btn.dataset.cat;
            loadHoroscope(currentHoroscopeSign, currentHoroscopeCat);
        });
    });
    
    // Автозагрузка для активного знака
    if (currentHoroscopeSign) {
        loadHoroscope(currentHoroscopeSign, currentHoroscopeCat);
    }
}

function attachNatalHandlers() {
    document.getElementById('buildNatalChart')?.addEventListener('click', buildNatalChart);
    document.getElementById('clearBirthData')?.addEventListener('click', () => {
        localStorage.removeItem('fredi_birth_data');
        _esToast('Данные очищены', 'success');
        render();
    });
}

// --- Главный рендер ---
function render() {
    _esInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    const tabsHtml = `
        <div class="es-tabs">
            <button class="es-tab ${state.activeTab === 'horoscope' ? 'active' : ''}" data-tab="horoscope">✨ Гороскоп</button>
            <button class="es-tab ${state.activeTab === 'natal' ? 'active' : ''}" data-tab="natal">🌟 Натальная карта</button>
            <button class="es-tab ${state.activeTab === 'tarot' ? 'active' : ''}" data-tab="tarot">🔮 Таро</button>
        </div>
    `;
    
    let content = '';
    if (state.activeTab === 'tarot') content = renderTarot();
    else if (state.activeTab === 'horoscope') content = renderHoroscope();
    else if (state.activeTab === 'natal') content = renderNatal();
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="esBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔮</div>
                <h1 class="content-title">Эзотерика</h1>
                <p style="font-size:12px;color:var(--text-secondary)">Таро · Гороскопы · Натальная карта</p>
            </div>
            ${tabsHtml}
            <div id="esContent">${content}</div>
        </div>`;
    
    document.getElementById('esBack').onclick = () => _esHome();
    
    document.querySelectorAll('.es-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const from = state.activeTab;
            const to = btn.dataset.tab;
            if (from !== to) _esTrack('esoterica_tab_switched', { from, to });
            state.activeTab = to;
            render();
        });
    });
    
    // Привязываем обработчики в зависимости от активной вкладки
    if (state.activeTab === 'tarot') attachTarotHandlers();
    else if (state.activeTab === 'horoscope') attachHoroscopeHandlers();
    else if (state.activeTab === 'natal') attachNatalHandlers();
}

// --- Точка входа ---
window.showEsotericaScreen = function() {
    state.activeTab = 'tarot';
    render();
};

console.log('✅ esoterica.js v1.0 загружен');
