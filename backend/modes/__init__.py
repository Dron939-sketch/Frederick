from .base_mode import BaseMode
from .coach import CoachMode
from .psychologist import PsychologistMode
from .trainer import TrainerMode

def get_mode(mode_name: str, user_id: int, user_data: dict, context) -> BaseMode:
    """Фабрика для получения режима"""
    modes = {
        "coach": CoachMode,
        "psychologist": PsychologistMode,
        "trainer": TrainerMode
    }
    mode_class = modes.get(mode_name, PsychologistMode)
    return mode_class(user_id, user_data, context)

__all__ = [
    'BaseMode',
    'CoachMode',
    'PsychologistMode',
    'TrainerMode',
    'get_mode'
]
