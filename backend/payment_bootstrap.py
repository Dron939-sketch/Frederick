"""
payment_bootstrap.py — Auto-connect payment system to main.py.
Usage:
    from payment_bootstrap import bootstrap_payments
    init_tables, renewal_task = bootstrap_payments(app, db, limiter)
"""

from payment_routes import register_payment_routes


def bootstrap_payments(app, db, limiter):
    """Returns (init_tables_coroutine, renewal_scheduler_coroutine)."""
    return register_payment_routes(app, db, limiter)
