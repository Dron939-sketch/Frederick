# canon.py
"""Канон Конфайнмент®-модели: 27 связей и проверки по книге Т. Гагина (2005).

Источник правил — страницы книги «Конфайнмент®-моделирование»:
- 9 узлов, результат в центре;
- у каждого узла 3 входящие и 3 исходящие связи;
- ядро: 2 → 3 → 4 → 1, все три вызывают 1, 1 усиливает 4;
- 5 вызывает 2, 3 и 4; 6 — причина для 2 и 5; 7 вызывает 6 и 2;
  8 связан с 7 и вызывает 6 и 5; 9 — причина 7 и 8, следствие 4 и 1;
- замыкание среднего круга: 3 → 9 → 6.

Модуль ничего не меняет в рабочей модели: он только проверяет.
"""

CANON_OUT = {
    1: [4, 7, 9],
    2: [1, 3, 5],
    3: [1, 4, 9],
    4: [1, 8, 9],
    5: [2, 3, 4],
    6: [2, 3, 5],
    7: [2, 6, 8],
    8: [5, 6, 7],
    9: [6, 7, 8],
}

CANON_LINKS = {(src, dst) for src, dsts in CANON_OUT.items() for dst in dsts}

CORE_LINKS = {(2, 1), (3, 1), (4, 1), (2, 3), (3, 4), (1, 4)}
CLOSING_LINKS = {(3, 9), (9, 6)}
CIRCLE_LINKS = {(3, 9), (9, 6)}

NODE_NAMES = {
    1: "результат (наблюдаемые проявления, ВАК)",
    2: "шаги: как это происходит",
    3: "факты на каждом шаге",
    4: "Я-концепция, самооценка",
    5: "правила и критерии проверки на ходу",
    6: "триггер (у проблемы) / мотив (у навыка)",
    7: "критерии оценки результата и последствий",
    8: "мировоззрение: мир и своя роль в нём",
    9: "последствия и побочные эффекты",
}

FILL_ORDER = [
    (1, "результат: что наблюдается, ВАК"),
    (2, "шаги: как это происходит"),
    (3, "факты на каждом шаге"),
    (4, "Я-концепция: кем себя считает в этой ситуации"),
    (5, "правила: что вызывает все три непосредственные причины"),
    (6, "триггер: что вызывает 2 и 5 одновременно"),
    (7, "критерии: что вызывает 6 и 2"),
    (8, "мировоззрение: связано с 7, вызывает 6 и 5"),
    (9, "последствия: причина 7 и 8, следствие 4 и 1"),
]


def links_from_model(model) -> dict:
    """Собирает связи из объекта ConfinementModel9 (элементы с полем causes)."""
    links = {}
    for eid in range(1, 10):
        element = model.elements.get(eid)
        links[eid] = sorted(set(element.causes)) if element else []
    return links


def links_from_pairs(pairs) -> dict:
    links = {i: [] for i in range(1, 10)}
    for src, dst in pairs:
        links[src].append(dst)
    return links


def validate(links: dict, strict: bool = True) -> dict:
    """Проверяет карту по канону.

    Возвращает:
      errors   — нарушения, которые ломают модель;
      warnings — отклонения (например, лишняя связь);
      degrees  — сколько входов и выходов у каждого узла;
      missing  — недостающие канонные связи;
      extra    — лишние связи.
    """
    errors, warnings = [], []
    pairs = {(src, dst) for src, dsts in links.items() for dst in dsts}

    # 1. висячие узлы и степени
    degrees = {}
    for node in range(1, 10):
        out_deg = len(links.get(node, []))
        in_deg = sum(1 for s, d in pairs if d == node)
        degrees[node] = {"out": out_deg, "in": in_deg}
        if out_deg == 0 or in_deg == 0:
            errors.append("узел %d имеет %d входа и %d выхода — висячий узел"
                          % (node, in_deg, out_deg))
        elif strict and (out_deg != 3 or in_deg != 3):
            warnings.append("узел %d: %d входов / %d выходов вместо 3/3"
                            % (node, in_deg, out_deg))

    # 2. канонная матрица
    missing = sorted(CANON_LINKS - pairs)
    extra = sorted(pairs - CANON_LINKS)
    for src, dst in missing:
        errors.append("нет связи %d→%d (%s → %s)"
                      % (src, dst, NODE_NAMES[src], NODE_NAMES[dst]))
    if extra:
        warnings.append("лишние связи вне канона: %s"
                        % ", ".join("%d→%d" % pair for pair in extra))

    # 3. ядро
    for src, dst in sorted(CORE_LINKS):
        if (src, dst) not in pairs:
            errors.append("ядро не собрано: нет %d→%d" % (src, dst))

    # 4. замыкание среднего круга
    for src, dst in sorted(CLOSING_LINKS):
        if (src, dst) not in pairs:
            errors.append("средний круг не замкнут: нет %d→%d" % (src, dst))

    # 5. самопричинность: у каждого узла есть путь к результату и обратно
    reach = {n: _reachable(n, links) for n in range(1, 10)}
    for node in range(1, 10):
        if 1 not in reach[node] and node != 1:
            errors.append("узел %d не доходит до результата (1)" % node)
        if node != 1 and node not in reach[1]:
            errors.append("результат (1) не доходит до узла %d" % node)

    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "degrees": degrees,
        "missing": missing,
        "extra": extra,
    }


# ── круги и секторы (книга, «Что получается») ──────────────────────────────
# Секторы: красный — кажимость, конкретика, ключевые результаты;
# зелёный — приписывает красному значения и заблуждения, трансформирует
# конкретику в выводы; синий — следствия, смыслы, выводы, правила, решения.
# Разметка по номерам на схеме: красный 1,4,9; зелёный 6,8; синий 2,3,5,7.
SECTORS = {
    "red": [1, 4, 9],
    "green": [6, 8],
    "blue": [2, 3, 5, 7],
}

# Центральный (управляющий) круг. Шестой элемент одновременно в нём и в
# зелёном секторе — по книге «часто оказывается значимым и решающим».
CENTER_CIRCLE = [6]

# Элементы, важнейшие для существования системы (книга: 5,6,7).
CRITICAL_ELEMENTS = [5, 6, 7]

# Кандидат в точку рычага по канону — шестой элемент.
KEY_CANDIDATES = [6]

# Шесть обязательных проверок и четыре проверки книги:
#   1) заполнение по правилам (ядро и связи 2-9) — обязательно;
#   2) замыкание среднего круга 3 → 9 → 6 — обязательно;
#   3) однородность кругов — желательно;
#   4) секторы — желательно.
STRICT_CHECKS = ("core", "closing")
SOFT_CHECKS = ("circles", "sectors")


# ── типы связей: система — это характер связей, а не их количество ─────────
# Книга: элементы описываются существительными, связи — глаголами.
# Рабочий словарь глаголов: вызывает, поддерживает, влияет, увеличивает,
# уменьшает, заставляет.
RELATION_VERBS = ("вызывает", "поддерживает", "влияет", "увеличивает",
                  "уменьшает", "заставляет")

# Канонные подписи связей (из комментариев к моделям «проблемы» и «навыка»).
CANON_VERBS = {
    (1, 4): "подкрепляет",
    (1, 7): "даёт основу для оценки",
    (1, 9): "вызывает побочные эффекты",
    (2, 1): "вызывает",
    (2, 3): "вызывает",
    (2, 5): "даёт данные для корректировки",
    (3, 1): "вызывает",
    (3, 4): "уменьшает (при негативном результате)",
    (3, 9): "вызывает",
    (4, 1): "задаёт рамки значимого результата",
    (4, 8): "поддерживает",
    (4, 9): "задаёт рамки фокусов внимания",
    (5, 2): "заставляет (диктует последовательность)",
    (5, 3): "влияет (указывает, что проверять)",
    (5, 4): "поддерживает (подкрепляет самоидентификацию)",
    (6, 2): "заставляет (запускает действие)",
    (6, 3): "увеличивает (стимулирует проверку)",
    (6, 5): "заставляет (подталкивает применить правила)",
    (7, 2): "влияет (вносит модификации)",
    (7, 6): "увеличивает (создаёт стимул)",
    (7, 8): "поддерживает (подтверждает)",
    (8, 5): "влияет (создаёт контекст)",
    (8, 6): "заставляет (подталкивает)",
    (8, 7): "увеличивает (задаёт фокусы и шкалы)",
    (9, 6): "влияет (побуждает или отвращает)",
    (9, 7): "увеличивает (даёт материал для критериев)",
    (9, 8): "поддерживает (подтверждает)",
}


def relation_report(links: dict, verbs: dict = None) -> dict:
    """Проверяет, что у каждой связи есть глагол из словаря."""
    verbs = verbs if verbs is not None else CANON_VERBS
    missing, unknown = [], []
    pairs = {(src, dst) for src, dsts in links.items() for dst in dsts}
    for pair in sorted(pairs):
        verb = verbs.get(pair)
        if not verb:
            missing.append(pair)
            continue
        if not any(root in verb for root in RELATION_VERBS):
            unknown.append((pair, verb))
    return {"ok": not missing and not unknown,
            "missing_verbs": missing,
            "verbs_outside_vocabulary": unknown}


# Машинные типы связей: каждая связь сводится к одному из шести глаголов.
CANON_TYPES = {
    (1, 4): "поддерживает", (1, 7): "влияет", (1, 9): "вызывает",
    (2, 1): "вызывает", (2, 3): "вызывает", (2, 5): "влияет",
    (3, 1): "вызывает", (3, 4): "уменьшает", (3, 9): "вызывает",
    (4, 1): "влияет", (4, 8): "поддерживает", (4, 9): "влияет",
    (5, 2): "заставляет", (5, 3): "влияет", (5, 4): "поддерживает",
    (6, 2): "заставляет", (6, 3): "увеличивает", (6, 5): "заставляет",
    (7, 2): "влияет", (7, 6): "увеличивает", (7, 8): "поддерживает",
    (8, 5): "влияет", (8, 6): "заставляет", (8, 7): "увеличивает",
    (9, 6): "влияет", (9, 7): "увеличивает", (9, 8): "поддерживает",
}


def check_relations(links: dict) -> dict:
    """Каждая связь должна иметь тип из словаря шести глаголов."""
    pairs = {(src, dst) for src, dsts in links.items() for dst in dsts}
    missing = sorted(pair for pair in pairs if pair not in CANON_TYPES)
    unknown = sorted({CANON_TYPES[pair] for pair in pairs
                      if pair in CANON_TYPES and CANON_TYPES[pair] not in RELATION_VERBS})
    return {"ok": not missing and not unknown,
            "no_type": missing,
            "bad_type": unknown}



# ── сила элемента (книга: «Более связанный элемент — сильнее») ─────────────
# Элемент тем сильнее, чем больше у него связей и чем больше исходящих по
# отношению к входящим. Плюс поправка книги: сила зависит от того, насколько
# сильны соседи, — то есть счёт рекурсивный (как PageRank).
STRENGTH_DAMPING = 0.85
STRENGTH_ROUNDS = 100


def node_strength(links: dict) -> dict:
    """Считает силу каждого узла: степени, доля исходящих и рекурсивный вес."""
    degrees, ratio, mass = {}, {}, {}
    for node in range(1, 10):
        out_deg = len(links.get(node, []))
        in_deg = sum(1 for src, dsts in links.items() for dst in dsts if dst == node)
        degrees[node] = {"out": out_deg, "in": in_deg, "total": out_deg + in_deg}
        ratio[node] = out_deg / (out_deg + in_deg) if (out_deg + in_deg) else 0.0
        mass[node] = float(out_deg + in_deg)

    # рекурсивный вес: узел силён, если на него ссылаются сильные узлы
    weight = {node: 1.0 / 9 for node in range(1, 10)}
    for _ in range(STRENGTH_ROUNDS):
        nxt = {}
        for node in range(1, 10):
            incoming = 0.0
            for src, dsts in links.items():
                if node in dsts and dsts:
                    incoming += weight[src] / len(dsts)
            nxt[node] = (1 - STRENGTH_DAMPING) / 9 + STRENGTH_DAMPING * incoming
        weight = nxt
    total = sum(weight.values()) or 1.0
    weight = {node: value / total for node, value in weight.items()}

    score = {}
    for node in range(1, 10):
        out_share = ratio[node]
        norm_mass = mass[node] / max(mass.values() or [1])
        score[node] = round(0.45 * weight[node] + 0.35 * out_share + 0.20 * norm_mass, 4)

    return {"degrees": degrees, "out_share": {k: round(v, 3) for k, v in ratio.items()},
            "recursive_weight": {k: round(v, 4) for k, v in weight.items()},
            "score": score,
            "ranking": sorted(score, key=score.get, reverse=True)}


def strength_report(links: dict = None) -> str:
    links = links if links is not None else links_from_pairs(CANON_LINKS)
    data = node_strength(links)
    lines = ["СИЛА ЭЛЕМЕНТОВ (канон)"]
    for node in data["ranking"]:
        d = data["degrees"][node]
        lines.append("  %d. %-42s вх/исх %d/%d  вес %.3f  сила %.3f"
                     % (node, NODE_NAMES[node][:42], d["in"], d["out"],
                        data["recursive_weight"][node], data["score"][node]))
    return "\n".join(lines)


# ── критические связи и ключевые элементы (книга: «Сила связей») ───────────
# Критическая связь — сильная связь, ведущая в сильный элемент.
# Ключевой элемент — тот, кто сильно влияет на сильный элемент через
# критическую связь (сам может быть слабым, нейтральным или сильным).
# Воздействие на систему идёт через ключевые элементы и критические связи.
LINK_STRENGTH_DEFAULT = 5.0
CRITICAL_LINK_THRESHOLD = 7.0


def leverage(links: dict, link_strength: dict = None,
             threshold: float = CRITICAL_LINK_THRESHOLD) -> dict:
    """Находит критические связи и ключевые элементы.

    link_strength: {(src, dst): 0..10}. По умолчанию все связи нейтральные (5),
    поэтому критические не выделяются — их надо оценить содержанием.
    """
    link_strength = link_strength or {}
    strength = node_strength(links)
    score = strength["score"]

    critical = []
    for src, dsts in links.items():
        for dst in dsts:
            value = float(link_strength.get((src, dst), LINK_STRENGTH_DEFAULT))
            if value >= threshold and score[dst] >= 0.30:
                critical.append({"from": src, "to": dst,
                                 "strength": value, "target_score": score[dst]})

    key_elements = sorted({item["from"] for item in critical})
    strongest = max(score, key=score.get) if score else None
    return {
        "critical_links": sorted(critical, key=lambda x: -x["strength"]),
        "key_elements": key_elements,
        "strongest_element": strongest,
        "note": "ключевые элементы — источники критических связей в сильные узлы",
    }


def leverage_report(links: dict = None, link_strength: dict = None) -> str:
    links = links if links is not None else links_from_pairs(CANON_LINKS)
    data = leverage(links, link_strength)
    lines = ["КРИТИЧЕСКИЕ СВЯЗИ И КЛЮЧЕВЫЕ ЭЛЕМЕНТЫ"]
    if not data["critical_links"]:
        lines.append("  критических связей нет: оценки силы не заданы")
    for item in data["critical_links"]:
        lines.append("  %d→%d сила %.1f (цель сильна: %.3f)"
                     % (item["from"], item["to"], item["strength"], item["target_score"]))
    lines.append("  ключевые элементы: %s" % (data["key_elements"] or "не выделены"))
    return "\n".join(lines)


# ── границы системы и обратное разворачивание (книга) ──────────────────────
# Границы системы субъективны: они определяются целью наблюдателя.
# Границы достаточны, если удалось замкнуть петлю — вернуться к тому, с чего
# начали. Разворачиваем петлю назад от результата по вызывающим связям.
def boundary_backward(links: dict, start: int = 1) -> dict:
    """Границы системы: идём назад от результата по входящим связям.

    Замкнуто — если от результата можно вернуться к нему же (есть петля).
    Границы — все узлы, от которых зависит результат.
    """
    incoming = {node: [] for node in range(1, 10)}
    for src, dsts in links.items():
        for dst in dsts:
            incoming[dst].append(src)

    # все предки результата: кто в итоге на него влияет
    ancestors, stack = set(), list(incoming.get(start, []))
    while stack:
        node = stack.pop()
        if node in ancestors:
            continue
        ancestors.add(node)
        stack.extend(incoming.get(node, []))

    shortest = _shortest_cycle(links, start)
    return {
        "closed": bool(shortest),
        "cycle": shortest,
        "boundary": sorted(ancestors | {start}),
        "start": start,
    }


def _shortest_cycle(links: dict, start: int) -> list:
    """Кратчайшая петля, проходящая через start (идём по входящим связям)."""
    incoming = {node: [] for node in range(1, 10)}
    for src, dsts in links.items():
        for dst in dsts:
            incoming[dst].append(src)
    queue, prev = [start], {start: None}
    while queue:
        node = queue.pop(0)
        for src in sorted(incoming.get(node, [])):
            if src == start:
                chain, cur = [start], node
                while cur is not None and cur != start:
                    chain.append(cur)
                    cur = prev.get(cur)
                chain.append(start)
                return chain
            if src not in prev:
                prev[src] = node
                queue.append(src)
    return []


def boundary_report(links: dict = None) -> str:
    links = links if links is not None else links_from_pairs(CANON_LINKS)
    data = boundary_backward(links)
    lines = ["ГРАНИЦЫ СИСТЕМЫ (обратное разворачивание от результата)"]
    lines.append("  замкнуто: %s" % data["closed"])
    lines.append("  петля: %s" % data["cycle"])
    lines.append("  границы: %s" % data["boundary"])
    return "\n".join(lines)


# ── прямые, обратные и превратные связи (книга) ────────────────────────────
# Прямая: чем больше — тем больше (+). Превратная: чем больше — тем меньше (−).
# Петля усиливающая (R), если произведение знаков +, и балансирующая (B), если −.
LINK_POLARITY = {
    (1, 4): "+", (1, 7): "+", (1, 9): "+",
    (2, 1): "+", (2, 3): "+", (2, 5): "+",
    (3, 1): "+", (3, 4): "-", (3, 9): "+",
    (4, 1): "+", (4, 8): "+", (4, 9): "+",
    (5, 2): "+", (5, 3): "+", (5, 4): "+",
    (6, 2): "+", (6, 3): "+", (6, 5): "+",
    (7, 2): "+", (7, 6): "+", (7, 8): "+",
    (8, 5): "+", (8, 6): "+", (8, 7): "+",
    (9, 6): "+", (9, 7): "+", (9, 8): "+",
}


def find_cycles(links: dict, max_len: int = 5, limit: int = 200) -> list:
    """Простые циклы длины 2..max_len с полярностью и типом петли."""
    found, seen = [], set()

    def walk(start, node, path):
        if len(path) > max_len or len(found) >= limit:
            return
        for dst in links.get(node, []):
            if dst == start and len(path) >= 2:
                cycle = tuple(path + [start])
                key = tuple(sorted(set(cycle)))
                if key not in seen:
                    seen.add(key)
                    found.append(list(cycle))
            elif dst not in path and dst >= start:
                walk(start, dst, path + [dst])

    for start in range(1, 10):
        walk(start, start, [start])

    result = []
    for cycle in found:
        sign = 1
        for src, dst in zip(cycle, cycle[1:]):
            if LINK_POLARITY.get((src, dst), "+") == "-":
                sign *= -1
        result.append({
            "cycle": cycle,
            "length": len(cycle) - 1,
            "sign": "+" if sign > 0 else "-",
            "type": "усиливающая (R)" if sign > 0 else "балансирующая (B)",
        })
    result.sort(key=lambda item: (item["length"], item["cycle"]))
    return result


def cycles_report(links: dict = None) -> str:
    links = links if links is not None else links_from_pairs(CANON_LINKS)
    data = find_cycles(links)
    reinforcing = [c for c in data if c["sign"] == "+"]
    balancing = [c for c in data if c["sign"] == "-"]
    lines = ["ПЕТЛИ: всего %d | усиливающих %d | балансирующих %d"
             % (len(data), len(reinforcing), len(balancing))]
    for item in data[:10]:
        lines.append("  %-22s %s" % ("".join("%d→" % n for n in item["cycle"]), item["type"]))
    return "\n".join(lines)


# ── временнáя задержка (книга: «Временнáя задержка») ──────────────────────
# Чем длиннее связь, тем больше времени нужно, чтобы изменение одного элемента
# вызвало изменение другого. За время «вредного» цикла «полезный» может
# сработать много раз: не сильные, но быстрые действия, повторённые часто,
# дают больший суммарный эффект, чем один сильный рывок.
LINK_DELAY_DEFAULT = 1.0


def loop_time(cycle: list, delays: dict = None) -> float:
    """Суммарное время прохождения петли (в относительных единицах)."""
    delays = delays or {}
    return sum(float(delays.get(pair, LINK_DELAY_DEFAULT))
               for pair in zip(cycle, cycle[1:]))


def effective_force(strength: float, time: float, opponent_time: float) -> dict:
    """Сколько раз успеет сработать действие и какова его суммарная сила.

    Пример из книги: своя сила 3, время 5; чужая сила 15, время 50.
    Пока чужая сработает один раз, своя успеет 10 раз: 3 × 10 = 30 против 15.
    """
    if time <= 0:
        return {"repeats": 1, "total": strength}
    repeats = max(1, int(opponent_time // time))
    return {"repeats": repeats, "total": round(strength * repeats, 2)}


def delay_report(links: dict = None, delays: dict = None) -> str:
    """Показывает, какие петли быстрые, а какие медленные."""
    links = links if links is not None else links_from_pairs(CANON_LINKS)
    data = find_cycles(links, max_len=3)
    lines = ["ВРЕМЕННАЯ ЗАДЕРЖКА ПЕТЛЯМИ"]
    for item in data[:6]:
        cycle = item["cycle"]
        lines.append("  %-16s время %.1f  %s"
                     % ("".join("%d→" % n for n in cycle),
                        loop_time(cycle, delays), item["type"]))
    example = effective_force(3, 5, 50)
    lines.append("  пример: сила 3 × %d повторений = %s против 15"
                 % (example["repeats"], example["total"]))
    return "\n".join(lines)


# ── изменение системы (книга: «Изменение систем») ──────────────────────────
# Алгоритм: границы → рычаг → новый аттрактор → дестабилизация → изменение
# → стабилизация. Стабильность и управляемость противостоят друг другу:
# чем устойчивее система, тем хуже она поддаётся изменению, но тем прочнее
# удерживает результат.
def intervention_plan(links: dict = None, delays: dict = None,
                      link_strength: dict = None) -> dict:
    """Собирает план изменения системы по канону Гагина."""
    links = links if links is not None else links_from_pairs(CANON_LINKS)
    boundaries = boundary_backward(links)
    lev = leverage(links, link_strength)
    loops = find_cycles(links, max_len=3)
    speeds = [(item, loop_time(item["cycle"], delays)) for item in loops]
    fastest = min(speeds, key=lambda pair: pair[1]) if speeds else None
    slowest = max(speeds, key=lambda pair: pair[1]) if speeds else None

    steps = []
    steps.append({
        "шаг": 1, "название": "Границы",
        "что делать": "очертить контур от результата назад до замыкания",
        "данные": {"замкнуто": boundaries["closed"], "границы": boundaries["boundary"]},
    })
    steps.append({
        "шаг": 2, "название": "Рычаг",
        "что делать": "усилить/ослабить ключевой элемент или изменить характер критической связи",
        "данные": {"ключевые": lev["key_elements"],
                   "критические связи": [(c["from"], c["to"]) for c in lev["critical_links"]]},
    })
    steps.append({
        "шаг": 3, "название": "Новый аттрактор",
        "что делать": "описать новое стабильное состояние: что человек делает, что получает",
        "данные": {"куда идём": "новая петля с последствием, а не запрет старой"},
    })
    steps.append({
        "шаг": 4, "название": "Дестабилизация",
        "что делать": "сдвинуть участок: пауза между триггером и реакцией, смена сигнала, "
                      "ослабление превратной связи",
        "данные": {"медленная петля": slowest[0]["cycle"] if slowest else None,
                   "быстрая петля": fastest[0]["cycle"] if fastest else None},
    })
    steps.append({
        "шаг": 5, "название": "Стабилизация",
        "что делать": "повторять новый цикл, пока он не станет автоматическим; "
                      "дать системе время интегрировать изменение",
        "данные": {"критерий": "новый цикл сработал в трёх контекстах"},
    })
    return {
        "противоречие": "стабильность против управляемости: чем прочнее система, "
                        "тем труднее изменить и тем лучше удерживает результат",
        "порядок": [step["название"] for step in steps],
        "шаги": steps,
        "предупреждение": "нестабильную систему сначала стабилизируют, потом меняют: "
                          "иначе изменение не удержится",
    }


def plan_report(links: dict = None) -> str:
    plan = intervention_plan(links)
    lines = ["ПЛАН ИЗМЕНЕНИЯ СИСТЕМЫ"]
    for step in plan["шаги"]:
        lines.append("  %d. %-16s %s" % (step["шаг"], step["название"], step["что делать"][:70]))
    return "\n".join(lines)


# ── дестабилизация: выпадение и добавление элементов/связей (книга) ───────
# Два хода: убрать элемент или связь (явно/неявно, временно/постоянно) либо
# добавить новый элемент или связь. Держать достаточно долго с учётом
# временной задержки, пока эффект не скажется на остальной системе.
# После интеграции добавленное можно убрать, используя продолжение нестабильности.
DESTABILIZATION_MOVES = {
    1: {"убрать": "перестать предъявлять результат как цель; убрать напоминания о нём",
        "добавить": "ввести новый наблюдаемый результат, который легче проверить"},
    2: {"убрать": "прекратить привычную последовательность шагов",
        "добавить": "ввести новый шаг между запуском и действием"},
    3: {"убрать": "перестать замерять промежуточные факты",
        "добавить": "ввести замер: дневник, счётчик, чек-лист"},
    4: {"убрать": "убрать ролевую формулировку «я такой»",
        "добавить": "дать новую роль: «я тот, кто пробует»"},
    5: {"убрать": "отменить старое правило «сначала подготовься»",
        "добавить": "ввести правило «сначала пять минут, потом оценка»"},
    6: {"убрать": "заблокировать триггер: убрать сигнал, место, время",
        "добавить": "ввести новый триггер: таймер, ритуал, звонок партнёра"},
    7: {"убрать": "перестать пользоваться старым критерием оценки",
        "добавить": "ввести новый критерий: «сделал шаг» вместо «сделал идеально»"},
    8: {"убрать": "не спорить с мировоззрением, а обойти его",
        "добавить": "добавить опыт, который ему противоречит (маленький эксперимент)"},
    9: {"убрать": "убрать последствия: не платить собой за старый цикл",
        "добавить": "добавить новые последствия: фиксация, награда, обратная связь"},
}


def destabilization_options(key_elements: list = None,
                            critical_links: list = None) -> list:
    """Конкретные ходы дестабилизации по ключевым элементам и связям."""
    key_elements = key_elements or []
    critical_links = critical_links or []
    options = []
    for node in key_elements:
        moves = DESTABILIZATION_MOVES.get(node, {})
        options.append({
            "элемент": node,
            "название": NODE_NAMES[node],
            "убрать": moves.get("убрать", ""),
            "добавить": moves.get("добавить", ""),
            "правило": "держать достаточно долго, чтобы эффект дошёл до остальной системы",
        })
    for src, dst in critical_links:
        options.append({
            "связь": (src, dst),
            "что": "изменить характер критической связи %d→%d" % (src, dst),
            "убрать": "явно или неявно препятствовать прохождению связи",
            "добавить": "ввести посредник: паузу, вопрос, действие между ними",
        })
    return options


def destabilization_report(links: dict = None, link_strength: dict = None) -> str:
    links = links if links is not None else links_from_pairs(CANON_LINKS)
    lev = leverage(links, link_strength)
    critical = [(item["from"], item["to"]) for item in lev["critical_links"]]
    options = destabilization_options(lev["key_elements"], critical)
    lines = ["ДЕСТАБИЛИЗАЦИЯ: варианты ходов"]
    if not options:
        lines.append("  ключевые элементы не выделены: сначала оцените силу связей")
    for item in options[:8]:
        if "элемент" in item:
            lines.append("  элемент %d (%s):" % (item["элемент"], item["название"]))
            lines.append("    убрать:   %s" % item["убрать"])
            lines.append("    добавить: %s" % item["добавить"])
        else:
            lines.append("  связь %d→%d: %s" % (item["связь"][0], item["связь"][1], item["что"]))
    return "\n".join(lines)


# ── замена через дублирование (книга: «Дестабилизация: замена») ────────────
# Введение дублирующих элементов и связей вызывает дезорганизацию работы
# дублируемых, особенно если новые оказываются эффективнее. Поэтому замена
# надёжнее запрета: не убираем старое, а даём новое, которое лучше.
REPLACEMENT_MOVES = {
    1: "ввести второй, более достижимый результат рядом с прежним",
    2: "ввести параллельную последовательность шагов: короче и проще",
    3: "ввести второй замер того же шага: проще и нагляднее",
    4: "дать вторую ролевую формулировку и проверить, какая точнее",
    5: "дать второе правило на тот же случай, которое легче выполнить",
    6: "поставить второй триггер рядом со старым, но с более лёгким действием",
    7: "ввести второй критерий оценки: не «идеально», а «сделано»",
    8: "дать второй взгляд на мир, который объясняет больше при меньшей цене",
    9: "ввести второе последствие: быстрее и заметнее прежнего",
}


def replacement_options(key_elements: list = None) -> list:
    """Ходы замены через дублирование по ключевым элементам."""
    key_elements = key_elements or []
    options = []
    for node in key_elements:
        options.append({
            "элемент": node,
            "название": NODE_NAMES[node],
            "дублировать": REPLACEMENT_MOVES.get(node, ""),
            "условие": "новый дубль должен быть эффективнее старого, иначе старое победит",
        })
    return options


def replacement_report(links: dict = None, link_strength: dict = None) -> str:
    links = links if links is not None else links_from_pairs(CANON_LINKS)
    lev = leverage(links, link_strength)
    options = replacement_options(lev["key_elements"])
    lines = ["ЗАМЕНА ЧЕРЕЗ ДУБЛИРОВАНИЕ"]
    if not options:
        lines.append("  ключевые элементы не выделены")
    for item in options[:8]:
        lines.append("  %d (%s): %s" % (item["элемент"], item["название"], item["дублировать"]))
    return "\n".join(lines)


# ── замыкающие треугольники (шаблон, приложение Б) ─────────────────────────
# На бланке связи с пунктиром вынесены отдельно: 2-1, 1-7, 7-2 (внутренний
# круг) и 3-9, 9-6, 6-3 (средний круг). Оба треугольника должны быть собраны.
CLOSING_TRIANGLES = {
    "внутренний круг": [(2, 1), (1, 7), (7, 2)],
    "средний круг": [(3, 9), (9, 6), (6, 3)],
}


def check_triangles(links: dict) -> dict:
    """Проверяет, что оба замыкающих треугольника собраны."""
    pairs = {(src, dst) for src, dsts in links.items() for dst in dsts}
    missing = {}
    for name, edges in CLOSING_TRIANGLES.items():
        absent = [edge for edge in edges if edge not in pairs]
        if absent:
            missing[name] = absent
    return {"ok": not missing, "missing": missing,
            "правило": "незамкнутый треугольник — контур не самовоспроизводится"}


def _reachable(start: int, links: dict) -> set:
    seen, stack = {start}, [start]
    while stack:
        node = stack.pop()
        for dst in links.get(node, []):
            if dst not in seen:
                seen.add(dst)
                stack.append(dst)
    return seen


def canonical_report() -> str:
    """Текстовый отчёт о канонной матрице — для проверки самого канона."""
    result = validate(links_from_pairs(CANON_LINKS))
    lines = ["КАНОН: 9 узлов, %d связей" % len(CANON_LINKS),
             "проверка: %s" % ("пройдена" if result["ok"] else "провалена")]
    for node in range(1, 10):
        d = result["degrees"][node]
        lines.append("  %d. %-42s %d→ / →%d" % (node, NODE_NAMES[node][:42],
                                                d["out"], d["in"]))
    for err in result["errors"]:
        lines.append("  ОШИБКА: " + err)
    for warn in result["warnings"]:
        lines.append("  ВНИМАНИЕ: " + warn)
    return "\n".join(lines)


if __name__ == "__main__":
    print(canonical_report())
    print()
    print(strength_report())
    print()
    print(leverage_report())
    print()
    print(boundary_report())
    tri = check_triangles(links_from_pairs(CANON_LINKS))
    print("треугольники:", "собраны" if tri["ok"] else tri["missing"])
    print()
    print(cycles_report())
    print()
    print(delay_report())
    print()
    print(plan_report())
    print()
    print(destabilization_report())
    print()
    print(replacement_report())
