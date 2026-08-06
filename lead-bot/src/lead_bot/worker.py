from __future__ import annotations

from celery import Celery

from lead_bot.config import get_settings

settings = get_settings()

celery_app = Celery(
    "mato_lead_bot",
    broker=settings.celery_broker_url or "memory://",
    backend=settings.celery_result_backend or "cache+memory://",
)

celery_app.conf.update(
    task_always_eager=settings.celery_task_always_eager or not settings.celery_broker_url,
    task_eager_propagates=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    imports=("lead_bot.jobs.tasks",),
)
