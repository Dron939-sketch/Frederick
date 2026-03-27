from .base_mode import BaseMode
from .coach_mode import CoachMode
from .psychologist_mode import PsychologistMode
from .trainer_mode import TrainerMode

def get_mode(mode_name: str, user_id: int, user_data: dict, context=None):
    """Фабрика режимов"""
    modes = {
        'coach': CoachMode,
        'psychologist': PsychologistMode,
        'trainer': TrainerMode
    }
    mode_class = modes.get(mode_name, CoachMode)
    return mode_class(user_id, user_data, context)

__all__ = [
    'BaseMode',
    'CoachMode', 
    'PsychologistMode',
    'TrainerMode',
    'get_mode'
]
