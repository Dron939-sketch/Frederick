"""
payment_bootstrap.py — Автоматическая инициализация платёжной системы.

Использование в main.py:
    from payment_bootstrap import bootstrap_payment_system, payment_renewal_loop

    # В lifespan, после создания db и push_service:
    payment_service = await bootstrap_payment_system(app, db, limiter, log_event)

    # В background_tasks:
    asyncio.create_task(payment_renewal_loop(payment_service))
"""

import asyncio
import logging

from payment import PaymentService
from payment_routes import init_payment_tables, register_payment_routes, subscription_renewal_scheduler

logger = logging.getLogger(__name__)


async def bootstrap_payment_system(app, db, limiter, log_event_fn):
    """
    Инициализирует всю платёжную систему:
    1. Создаёт PaymentService
    2. Создаёт таблицы в БД
    3. Регистрирует API эндпоинты
    Возвращает payment_service для фоновых задач.
    """
    payment_service = PaymentService(db)
    logger.info("PaymentService created")

    await init_payment_tables(db)
    register_payment_routes(app, db, payment_service, limiter, log_event_fn)
    logger.info("Payment system bootstrapped")

    return payment_service


async def payment_renewal_loop(payment_service):
    """Обёртка для subscription_renewal_scheduler."""
    await subscription_renewal_scheduler(payment_service)
