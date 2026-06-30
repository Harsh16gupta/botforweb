"""
Celery Worker Application Config.
Initializes Celery and sets up connection details using Redis.
"""

from celery import Celery
from app.core.config import settings

# Create Celery instance
celery_app = Celery(
    "tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

# Optional configuration settings
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
