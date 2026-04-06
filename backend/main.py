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
