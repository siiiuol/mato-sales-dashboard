from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Callable

from celery import chain

from lead_bot.config import get_settings
from lead_bot.db import SessionLocal
from lead_bot.models import ProcessingJob
from lead_bot.providers.kbo import KboZipProvider
from lead_bot.services.discovery import expand_from_customers, places_category_sweep
from lead_bot.services.enrichment import enrich_establishment
from lead_bot.services.stages import (
    crawl_stage,
    discover_website_stage,
    extract_stage,
    finance_stage,
    geo_stage,
    resolve_stage,
    review_stage,
    social_stage,
    suppress_stage,
    timing_stage,
)
from lead_bot.worker import celery_app


def _execute(
    stage: str,
    establishment_id: int,
    operation: Callable,
    idempotency_key: str | None = None,
) -> dict:
    settings = get_settings()
    key = idempotency_key or (
        f"{stage}:{establishment_id}:{date.today().isoformat()}:{settings.model_version}"
    )
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).filter_by(idempotency_key=key).one_or_none()
        if job and job.status == "completed":
            return {"status": "already_completed", "job_id": job.id, **(job.payload_json or {})}
        if not job:
            job = ProcessingJob(
                queue=stage,
                idempotency_key=key,
                payload_json={"establishment_id": establishment_id},
                model_version=settings.model_version,
                prompt_version=settings.prompt_version,
            )
            db.add(job)
            db.flush()
        job.status = "running"
        job.started_at = datetime.now(timezone.utc).replace(tzinfo=None)
        job.attempts += 1
        db.commit()
        result = operation(db, establishment_id)
        job.status = "completed"
        job.payload_json = {"establishment_id": establishment_id, "result": result}
        job.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
        job.error = None
        db.commit()
        return {"status": "completed", "job_id": job.id, **result}
    except Exception as exc:
        db.rollback()
        failed = db.query(ProcessingJob).filter_by(idempotency_key=key).one_or_none()
        if failed:
            failed.status = "failed"
            failed.error = str(exc)[:4000]
            failed.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
        raise
    finally:
        db.close()


@celery_app.task(name="lead_bot.import_kbo", queue="cbe_import")
def task_import_kbo(path: str, territory: str, import_type: str | None = None) -> dict:
    db = SessionLocal()
    try:
        return KboZipProvider(db).import_archive(path, territory, import_type)
    finally:
        db.close()


def _task(name: str, queue: str, operation: Callable):
    @celery_app.task(name=f"lead_bot.{name}", queue=queue)
    def task(establishment_id: int, idempotency_key: str | None = None) -> dict:
        return _execute(name, establishment_id, operation, idempotency_key)

    return task


task_suppress = _task("suppress", "suppression", suppress_stage)
task_resolve = _task("resolve", "entity_resolution", resolve_stage)
task_discover_website = _task(
    "website_discovery", "website_discovery", discover_website_stage
)
task_crawl = _task("crawl", "website_crawl", crawl_stage)
task_social = _task("social", "website_crawl", social_stage)
task_extract = _task("extract", "llm_extract", extract_stage)
task_geo = _task("geo", "feature_calc", geo_stage)
task_finance = _task("finance", "feature_calc", finance_stage)
task_timing = _task("timing", "feature_calc", timing_stage)
task_score = _task("score", "scoring", enrich_establishment)
task_review = _task("review", "human_review", review_stage)


@celery_app.task(name="lead_bot.schedule_pipeline", queue="refresh")
def task_schedule_pipeline(establishment_id: int) -> dict:
    workflow = chain(
        task_suppress.si(establishment_id),
        task_resolve.si(establishment_id),
        task_discover_website.si(establishment_id),
        task_crawl.si(establishment_id),
        task_social.si(establishment_id),
        task_extract.si(establishment_id),
        task_geo.si(establishment_id),
        task_finance.si(establishment_id),
        task_timing.si(establishment_id),
        task_score.si(establishment_id),
        task_review.si(establishment_id),
    )
    result = workflow.apply_async()
    return {"scheduled": True, "task_id": result.id, "establishment_id": establishment_id}


@celery_app.task(name="lead_bot.places_category_sweep", queue="website_discovery")
def task_places_category_sweep(limit_per_query: int = 8) -> dict:
    db = SessionLocal()
    try:
        return places_category_sweep(db, limit_per_query=limit_per_query)
    finally:
        db.close()


@celery_app.task(name="lead_bot.expand_from_customers", queue="website_discovery")
def task_expand_from_customers(limit: int = 50) -> dict:
    db = SessionLocal()
    try:
        return expand_from_customers(db, limit=limit)
    finally:
        db.close()
