#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Фреди - Виртуальный психолог
Асинхронный API сервер на FastAPI
Версия 3.2 - Исправлены баги аудита:
  1. Добавлен /api/ai/generate
  2. История диалога загружается перед get_mode()
  3. BasicMode.message_counter передаётся через context
  4. weather 'temp' → 'temperature' (в get_context_string через context_obj)
"""

import os
import sys
import asyncio
import logging
import time
import json
import random
import base64
import re
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List, Union
import signal
import traceback

from fastapi import FastAPI, Request, HTTPException, Depends, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field
import uvicorn
from services.voice_service import VoiceService, normalize_tts_text
from services.freddy_service import get_freddy_service

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from db import Database
from cache import RedisCache
from services.ai_service import AIService
from services.weather_service import WeatherService
from services.weekend_planner import WeekendPlanner
from repositories.user_repo import UserRepository
from repositories.context_repo import ContextRepository
from repositories.message_repo import MessageRepository
from confinement.confinement_model import ConfinementModel9 as ConfinementModel
from confinement.loop_analyzer import LoopAnalyzer, create_analyzer_from_model_data
from confinement.key_confinement import KeyConfinementDetector
from confinement.intervention_library import InterventionLibrary
from confinement.question_analyzer import QuestionContextAnalyzer, create_analyzer_from_user_data
from hypno.hypno_module import HypnoOrchestrator
from hypno.therapeutic_tales import TherapeuticTales
from payment_routes import register_payment_routes
from bot_routes import register_bot_routes
from modes.base_mode import BaseMode
from modes.coach import CoachMode
from modes.psychologist import PsychologistMode
from modes.trainer import TrainerMode
from modes import get_mode
from utils import (
    get_theoretical_path,
    generate_life_context_questions,
    generate_goal_context_questions,
    calculate_feasibility,
    parse_life_context_answers,
    parse_goal_context_answers,
    get_goal_difficulty,
    get_goal_time_estimate,
    save_feasibility_result,
    MorningMessageManager,
    get_weekend_planner as get_utils_weekend_planner
)
from formatters import bold, italic, clean_text_for_safe_display, format_profile_text, format_psychologist_text
from profiles import VECTORS, LEVEL_PROFILES, STAGE_1_FEEDBACK, STAGE_2_FEEDBACK, STAGE_3_FEEDBACK, DILTS_LEVELS, FALLBACK_ANALYSIS

# ============================================
# ГЛОБАЛЬНЫЕ ОБЪЕКТЫ
# ============================================
db: Optional[Database] = None
cache: Optional[RedisCache] = None
ai_service: Optional[AIService] = None
voice_service: Optional[VoiceService] = None
weather_service: Optional[WeatherService] = None
user_repo: Optional[UserRepository] = None
context_repo: Optional[ContextRepository] = None
message_repo: Optional[MessageRepository] = None
hypno: Optional[HypnoOrchestrator] = None
tales: Optional[TherapeuticTales] = None
intervention_lib: Optional[InterventionLibrary] = None
morning_manager: Optional[MorningMessageManager] = None
push_service = None
weekend_planner: Optional[WeekendPlanner] = None
