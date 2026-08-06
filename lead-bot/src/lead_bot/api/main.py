from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any
from urllib.parse import parse_qs

from sqlalchemy import desc, func, text
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from lead_bot.config import get_settings
from lead_bot.db import SessionLocal, init_db
from lead_bot.models import (
    Activity,
    AuditEvent,
    Contact,
    CostEvent,
    Establishment,
    Evidence,
    FeedbackEvent,
    LeadScore,
    MachineRecommendation,
    MatchCandidate,
    Organization,
    ProcessingJob,
    ReviewAction,
    Website,
)
from lead_bot.providers.crm import SqliteCrmBridge
from lead_bot.providers.kbo import KboZipProvider
from lead_bot.services.enrichment import enrich_establishment
from lead_bot.services.learning import (
    LearningInputError,
    audit_export,
    evaluate_budget,
    evaluate_shadow,
    freshness_gate,
    ingest_outcome,
    learning_report,
    promote_rule_version,
)
from lead_bot.services.preliminary import category_label_for
from lead_bot.services.suppression import add_suppression

logger = logging.getLogger("lead_bot.api")
logging.basicConfig(level=logging.INFO, format="%(message)s")


def _auth(request: Request) -> JSONResponse | None:
    settings = get_settings()
    if request.headers.get("x-mato-key") != settings.lead_bot_api_key:
        return JSONResponse({"detail": "Invalid API key"}, status_code=401)
    return None


def _service_auth(request: Request) -> JSONResponse | None:
    settings = get_settings()
    if request.headers.get("x-mato-service-key") != settings.learning_service_key:
        return JSONResponse({"detail": "Invalid service key"}, status_code=401)
    return None


async def health(_: Request) -> JSONResponse:
    return JSONResponse({"ok": True, "service": "mato-lead-bot"})


async def operational_health(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    settings = get_settings()
    db_ok, redis_ok = True, None
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    finally:
        db.close()
    if settings.redis_url:
        try:
            from redis import Redis

            redis_ok = bool(Redis.from_url(settings.redis_url).ping())
        except Exception:
            redis_ok = False
    return JSONResponse(
        {
            "ok": db_ok and redis_ok is not False,
            "database": db_ok,
            "queue": {"configured": bool(settings.celery_broker_url), "reachable": redis_ok},
            "providers": {
                "google_places": {
                    "configured": bool(settings.google_places_api_key),
                    "mode": "api_only",
                },
                "openai": {"configured": bool(settings.openai_api_key)},
                "nbb": {"configured": settings.nbb_provider != "unavailable"},
            },
        },
        status_code=200 if db_ok else 503,
    )


async def metrics_summary(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    db = SessionLocal()
    try:
        jobs = dict(
            db.query(ProcessingJob.status, func.count(ProcessingJob.id))
            .group_by(ProcessingJob.status)
            .all()
        )
        queues = dict(
            db.query(ProcessingJob.queue, func.count(ProcessingJob.id))
            .filter(ProcessingJob.status.in_(["pending", "running", "failed"]))
            .group_by(ProcessingJob.queue)
            .all()
        )
        return JSONResponse(
            {
                "organizations": db.query(Organization).count(),
                "establishments": db.query(Establishment).count(),
                "review_ready": db.query(Establishment)
                .filter_by(review_status="ready_for_review")
                .count(),
                "processing_jobs": jobs,
                "queue_backlog": queues,
            }
        )
    finally:
        db.close()


async def cost_summary(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    db = SessionLocal()
    try:
        rows = (
            db.query(
                CostEvent.provider,
                CostEvent.operation,
                func.sum(CostEvent.units),
                func.sum(CostEvent.estimated_cost_eur),
                func.max(CostEvent.created_at),
                func.max(CostEvent.data_fresh_until),
            )
            .group_by(CostEvent.provider, CostEvent.operation)
            .all()
        )
        return JSONResponse(
            {
                "total_estimated_cost_eur": round(sum(float(r[3] or 0) for r in rows), 4),
                "items": [
                    {
                        "provider": r[0],
                        "operation": r[1],
                        "units": float(r[2] or 0),
                        "estimated_cost_eur": round(float(r[3] or 0), 4),
                        "last_used_at": r[4].isoformat() if r[4] else None,
                        "fresh_until": r[5].isoformat() if r[5] else None,
                    }
                    for r in rows
                ],
            }
        )
    finally:
        db.close()


async def ingest_crm_outcome(request: Request) -> JSONResponse:
    if err := _service_auth(request):
        return err
    body = await request.json()
    source = request.headers.get("x-mato-service-id", "crm")[:64]
    db = SessionLocal()
    try:
        row, created = ingest_outcome(db, body, source)
        return JSONResponse(
            {"id": row.id, "created": created, "establishment_id": row.intelligence_establishment_id},
            status_code=201 if created else 200,
        )
    except LearningInputError as exc:
        db.rollback()
        return JSONResponse({"detail": str(exc)}, status_code=400)
    finally:
        db.close()


async def learning_evaluation(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    cohort = (parse_qs(request.url.query).get("cohort") or ["all"])[0]
    db = SessionLocal()
    try:
        return JSONResponse(evaluate_shadow(db, cohort))
    finally:
        db.close()


async def learning_metrics(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    cohort = (parse_qs(request.url.query).get("cohort") or ["all"])[0]
    db = SessionLocal()
    try:
        return JSONResponse(learning_report(db, cohort))
    finally:
        db.close()


async def promote_rules(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    body = await request.json()
    db = SessionLocal()
    try:
        row = promote_rule_version(
            db, str(body.get("version") or ""), request.headers.get("x-mato-actor", "admin")[:128]
        )
        return JSONResponse({"version": row.version, "status": row.status})
    except LearningInputError as exc:
        db.rollback()
        return JSONResponse({"detail": str(exc)}, status_code=400)
    finally:
        db.close()


async def budget_status(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    provider = request.path_params["provider"]
    db = SessionLocal()
    try:
        return JSONResponse(evaluate_budget(db, provider))
    finally:
        db.close()


async def research_gate(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    db = SessionLocal()
    try:
        return JSONResponse(freshness_gate(db, int(request.path_params["establishment_id"])))
    finally:
        db.close()


async def export_learning_audit(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    db = SessionLocal()
    try:
        return JSONResponse(audit_export(db))
    finally:
        db.close()


async def match_candidates(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    db = SessionLocal()
    try:
        rows = (
            db.query(MatchCandidate)
            .filter_by(decision="manual")
            .order_by(MatchCandidate.score.desc())
            .limit(100)
            .all()
        )
        return JSONResponse(
            [
                {
                    "id": row.id,
                    "source_type": row.source_type,
                    "source_identifier": row.source_identifier,
                    "target_type": row.target_type,
                    "target_id": row.target_id,
                    "score": row.score,
                    "method": row.match_method,
                    "evidence": row.evidence_json,
                }
                for row in rows
            ]
        )
    finally:
        db.close()


async def list_review_leads(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    params = parse_qs(request.url.query)
    min_tier = (params.get("min_tier") or ["B"])[0]
    limit = int((params.get("limit") or ["50"])[0])
    tier_rank = ["A+", "A", "B", "C", "D", "needs_more_data"]
    if min_tier in tier_rank:
        allowed = set(tier_rank[: tier_rank.index(min_tier) + 1])
    else:
        allowed = {"A+", "A", "B"}
    db = SessionLocal()
    try:
        # Authoritative Work/Review queue rank: expected margin (EV), then priority.
        scores = (
            db.query(LeadScore)
            .filter(LeadScore.tier.in_(allowed))
            .order_by(
                desc(LeadScore.expected_margin_eur),
                desc(LeadScore.priority_score),
                desc(LeadScore.quality_score),
            )
            .limit(limit)
            .all()
        )
        return JSONResponse([_serialize_lead(db, s) for s in scores])
    finally:
        db.close()


async def get_lead(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    establishment_id = int(request.path_params["establishment_id"])
    db = SessionLocal()
    try:
        score = (
            db.query(LeadScore)
            .filter_by(establishment_id=establishment_id)
            .order_by(desc(LeadScore.calculated_at))
            .first()
        )
        if not score:
            return JSONResponse({"detail": "Lead score not found"}, status_code=404)
        return JSONResponse(_serialize_lead(db, score, full=True))
    finally:
        db.close()


async def review_action(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    establishment_id = int(request.path_params["establishment_id"])
    body = await request.json()
    action = str(body.get("action") or "")
    payload = body.get("payload") or {}
    allowed_actions = {
        "reject_permanent",
        "do_not_contact",
        "reject_temporary",
        "request_research",
        "change_segment",
        "change_machine",
        "approve_for_call",
        "approve_for_email",
        "mark_duplicate",
        "mark_existing_customer",
    }
    if action not in allowed_actions:
        return JSONResponse({"detail": f"Unknown action {action}"}, status_code=400)
    settings = get_settings()
    actor = request.headers.get("x-mato-actor", "server-reviewer")[:128]
    correlation_id = getattr(request.state, "correlation_id", None)
    db = SessionLocal()
    try:
        est = db.query(Establishment).filter_by(id=establishment_id).one_or_none()
        if not est:
            return JSONResponse({"detail": "Establishment not found"}, status_code=404)
        org = db.query(Organization).filter_by(id=est.organization_id).one()
        score = (
            db.query(LeadScore)
            .filter_by(establishment_id=establishment_id)
            .order_by(desc(LeadScore.calculated_at))
            .first()
        )
        db.add(
            ReviewAction(
                establishment_id=establishment_id,
                action=action,
                payload_json=payload,
                actor=actor,
                correlation_id=correlation_id,
                lawful_basis=settings.lawful_basis,
                policy_version=settings.policy_version,
            )
        )
        db.add(
            FeedbackEvent(
                establishment_id=establishment_id,
                event_type=action,
                payload_json=payload,
                actor=actor,
                correlation_id=correlation_id,
                lawful_basis=settings.lawful_basis,
                policy_version=settings.policy_version,
            )
        )
        result: dict[str, Any] = {"ok": True, "action": action}
        schedule_research = False

        if action in {"reject_permanent", "do_not_contact"}:
            add_suppression(
                db,
                reason="do_not_contact" if action == "do_not_contact" else "manual_block",
                enterprise_number=org.enterprise_number,
                establishment_number=est.establishment_number,
                source="review",
                notes=str(payload.get("notes") or ""),
            )
            est.review_status = "rejected"
            if score:
                score.human_feedback = action
                score.tier = "rejected"
        elif action == "reject_temporary":
            est.review_status = "rejected_temp"
            if score:
                score.human_feedback = action
        elif action == "request_research":
            est.review_status = "needs_more_data"
            schedule_research = True
        elif action == "change_segment" and score:
            score.segment = str(payload.get("segment") or score.segment)
            score.human_feedback = "change_segment"
        elif action == "change_machine" and score and score.recommendation:
            score.recommendation.primary_machine = str(
                payload.get("machine") or score.recommendation.primary_machine
            )
            score.human_feedback = "change_machine"
        elif action in {"approve_for_call", "approve_for_email"}:
            gate = freshness_gate(db, establishment_id)
            if not gate["allowed"]:
                db.rollback()
                return JSONResponse(
                    {"detail": "Critical research is stale", "freshness": gate},
                    status_code=409,
                )
            est.review_status = "approved"
            if score:
                score.human_feedback = action
            export_payload = _crm_export_payload(db, est, org, score, action)
            result["crm_export"] = SqliteCrmBridge(db).export_approved_lead(export_payload)
        elif action == "mark_duplicate":
            est.review_status = "duplicate"
            add_suppression(
                db,
                reason="duplicate",
                enterprise_number=org.enterprise_number,
                establishment_number=est.establishment_number,
                source="review",
            )
        elif action == "mark_existing_customer":
            add_suppression(
                db,
                reason="existing_customer",
                enterprise_number=org.enterprise_number,
                source="review",
                permanent=False,
            )
            est.review_status = "existing_customer"
        db.add(
            AuditEvent(
                event_type="review_action",
                entity_type="establishment",
                entity_id=str(establishment_id),
                actor=actor,
                payload_json={"action": action},
                correlation_id=correlation_id,
            )
        )
        db.commit()
        if schedule_research:
            from lead_bot.jobs.tasks import task_schedule_pipeline

            try:
                result["pipeline"] = task_schedule_pipeline.delay(establishment_id).id
            except Exception:
                logger.exception(
                    json.dumps(
                        {
                            "event": "pipeline_schedule_failed",
                            "correlation_id": correlation_id,
                            "establishment_id": establishment_id,
                        }
                    )
                )
                result["pipeline"] = None
                result["pipeline_scheduled"] = False
        return JSONResponse(result)
    except Exception:
        db.rollback()
        logger.exception(
            json.dumps(
                {"event": "review_action_failed", "correlation_id": correlation_id}
            )
        )
        return JSONResponse({"detail": "Review action failed"}, status_code=500)
    finally:
        db.close()


async def sync_crm(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    db = SessionLocal()
    try:
        n = SqliteCrmBridge(db).sync_suppressions()
        return JSONResponse({"added": n})
    finally:
        db.close()


async def import_kbo(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    body = await request.json()
    path = body.get("path")
    if not path:
        return JSONResponse({"detail": "path required"}, status_code=400)
    settings = get_settings()
    db = SessionLocal()
    try:
        stats = KboZipProvider(db).import_archive(
            path,
            body.get("territory") or settings.territory,
            body.get("import_type"),
        )
        return JSONResponse(stats)
    finally:
        db.close()


async def enrich_one(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    establishment_id = int(request.path_params["establishment_id"])
    db = SessionLocal()
    try:
        return JSONResponse(enrich_establishment(db, establishment_id))
    finally:
        db.close()


async def schedule_pipeline(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    from lead_bot.jobs.tasks import task_schedule_pipeline

    establishment_id = int(request.path_params["establishment_id"])
    result = task_schedule_pipeline.delay(establishment_id)
    return JSONResponse({"scheduled": True, "task_id": result.id}, status_code=202)


async def run_places_sweep(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    from lead_bot.jobs.tasks import task_places_category_sweep

    body = {}
    try:
        body = await request.json()
    except Exception:
        body = {}
    result = task_places_category_sweep.delay(int(body.get("limit_per_query") or 8))
    return JSONResponse({"scheduled": True, "task_id": result.id}, status_code=202)


async def run_customer_expansion(request: Request) -> JSONResponse:
    if err := _auth(request):
        return err
    from lead_bot.jobs.tasks import task_expand_from_customers

    body = {}
    try:
        body = await request.json()
    except Exception:
        body = {}
    result = task_expand_from_customers.delay(int(body.get("limit") or 50))
    return JSONResponse({"scheduled": True, "task_id": result.id}, status_code=202)


def _serialize_lead(db, score: LeadScore, full: bool = False) -> dict:
    est = db.query(Establishment).filter_by(id=score.establishment_id).one()
    org = db.query(Organization).filter_by(id=score.organization_id).one()
    rec = db.query(MachineRecommendation).filter_by(lead_score_id=score.id).one_or_none()
    website = (
        db.query(Website)
        .filter((Website.establishment_id == est.id) | (Website.organization_id == org.id))
        .first()
    )
    contacts = db.query(Contact).filter_by(organization_id=org.id).all()
    phone = next((c.contact_value for c in contacts if c.contact_type == "phone"), None)
    email = next((c.contact_value for c in contacts if c.contact_type == "email"), None)
    social_types = {"instagram", "facebook", "tiktok", "linkedin", "youtube", "x", "pinterest"}
    social_profiles = [
        {"platform": c.contact_type, "url": c.contact_value}
        for c in contacts
        if c.contact_type in social_types and c.status == "active"
    ]
    explain = score.explainable_json or {}
    nace_codes = [
        a.nace_code
        for a in db.query(Activity).filter_by(establishment_id=est.id).all()
    ]
    cat = explain.get("category_label") or category_label_for(
        est.name or org.official_name, score.segment, nace_codes
    )
    data = {
        "establishment_id": est.id,
        "organization_id": org.id,
        "enterprise_number": org.enterprise_number,
        "establishment_number": est.establishment_number,
        "company_name": org.official_name,
        "establishment_name": est.name,
        "address": " ".join(
            x for x in [est.street, est.house_number, est.postcode, est.municipality] if x
        ),
        "municipality": est.municipality,
        "region": est.region,
        "lat": est.latitude,
        "lng": est.longitude,
        "segment": score.segment,
        "category_label": cat,
        "nace_codes": nace_codes,
        "quality_score": score.quality_score,
        "confidence_score": score.confidence_score,
        "timing_score": score.timing_score,
        "priority_score": score.priority_score,
        "strategic_score": score.strategic_score,
        "expected_deal_value_eur": score.expected_deal_value_eur,
        "expected_margin_eur": score.expected_margin_eur,
        "tier": score.tier,
        "recommended_machine": rec.primary_machine if rec else None,
        "alternative_machines": rec.alternative_machines_json if rec else [],
        "machine_reasons": rec.reasons_json if rec else [],
        "top_positive_reasons": explain.get("top_positive_reasons", []),
        "main_risks": explain.get("main_risks", []),
        "why_contact_now": explain.get("why_contact_now"),
        "recommended_contact_angle": explain.get("recommended_contact_angle"),
        "why_this_company": explain.get("why_this_company"),
        "what_to_say": explain.get("what_to_say"),
        "ranking_explanation": explain.get("ranking_explanation")
        or explain.get("rank_explanation")
        or explain.get("why_this_company"),
        "rank_explanation": explain.get("rank_explanation")
        or explain.get("ranking_explanation"),
        "ev_source": explain.get("ev_source"),
        "insufficient_data": bool(explain.get("insufficient_data")),
        "p_meeting": explain.get("p_meeting"),
        "p_close_given_meeting": explain.get("p_close_given_meeting"),
        "website": website.url if website else None,
        "telephone": phone,
        "email": email,
        "social_profiles": social_profiles,
        "review_status": est.review_status,
        "explainable": explain,
    }
    if full:
        data["evidence"] = [
            {
                "field": e.feature_name,
                "value": e.feature_value,
                "source_url": e.source_url,
                "source_text": e.source_text,
                "confidence": e.extraction_confidence,
            }
            for e in db.query(Evidence).filter_by(establishment_id=est.id).limit(50)
        ]
        data["outreach_prep"] = {
            "one_sentence_reason": (explain.get("top_positive_reasons") or ["Relevant lead"])[0],
            "sales_angle": explain.get("recommended_contact_angle"),
            "phone_opener": f"Goedemiddag, hier is MATO. Ik bel over {org.official_name} en een mogelijke verkoopautomaat.",
            "discovery_questions": [
                "Welke producten of locatiebehoeften wilt u onbemand beschikbaar maken?",
                "Hoe ziet restocking er praktisch uit bij u?",
                "Denkt u eerder aan aankoop of huur?",
            ],
            "email_blurb": explain.get("recommended_contact_angle"),
            "likely_objection": "Te duur / geen ruimte",
            "objection_answer": "We starten vaak met één machine en telemetrie zodat ROI meetbaar is.",
            "best_channel": "telephone" if phone else "email",
            "next_action": explain.get("recommended_next_action"),
        }
    return data


def _crm_export_payload(db, est, org, score, action: str) -> dict:
    website = (
        db.query(Website)
        .filter((Website.establishment_id == est.id) | (Website.organization_id == org.id))
        .first()
    )
    contacts = db.query(Contact).filter_by(organization_id=org.id).all()
    return {
        "action": action,
        "intelligence_establishment_id": est.id,
        "enterprise_number": org.enterprise_number,
        "name": est.name or org.official_name,
        "address": " ".join(x for x in [est.street, est.house_number] if x),
        "city": est.municipality,
        "province": est.region,
        "lat": est.latitude,
        "lng": est.longitude,
        "phone": next((c.contact_value for c in contacts if c.contact_type == "phone"), None),
        "email": next((c.contact_value for c in contacts if c.contact_type == "email"), None),
        "website": website.url if website else None,
        "category": score.segment if score else None,
        "score": int(score.priority_score) if score else 0,
        "reason": (score.explainable_json or {}).get("why_contact_now") if score else None,
        "tier": score.tier if score else None,
        "recommended_machine": score.explainable_json.get("recommended_machine")
        if score and score.explainable_json
        else None,
    }


from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(_: Starlette):
    init_db()
    yield


routes = [
    Route("/health", health),
    Route("/internal/health", operational_health),
    Route("/internal/metrics", metrics_summary),
    Route("/internal/costs", cost_summary),
    Route("/internal/learning/outcomes", ingest_crm_outcome, methods=["POST"]),
    Route("/internal/learning/evaluate", learning_evaluation, methods=["POST"]),
    Route("/internal/learning/metrics", learning_metrics),
    Route("/internal/learning/rules/promote", promote_rules, methods=["POST"]),
    Route("/internal/learning/budgets/{provider:str}", budget_status),
    Route("/internal/learning/freshness/{establishment_id:int}", research_gate),
    Route("/internal/learning/audit-export", export_learning_audit),
    Route("/internal/match-candidates", match_candidates),
    Route("/review/leads", list_review_leads),
    Route("/review/leads/{establishment_id:int}", get_lead),
    Route("/review/leads/{establishment_id:int}/action", review_action, methods=["POST"]),
    Route("/internal/sync-crm", sync_crm, methods=["POST"]),
    Route("/internal/import-kbo", import_kbo, methods=["POST"]),
    Route("/internal/enrich/{establishment_id:int}", enrich_one, methods=["POST"]),
    Route(
        "/internal/pipeline/{establishment_id:int}",
        schedule_pipeline,
        methods=["POST"],
    ),
    Route("/internal/discovery/places-sweep", run_places_sweep, methods=["POST"]),
    Route("/internal/discovery/customer-expansion", run_customer_expansion, methods=["POST"]),
]

settings = get_settings()
app = Starlette(
    debug=settings.debug and settings.environment != "production",
    routes=routes,
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=[
                "content-type",
                "x-mato-key",
                "x-mato-service-key",
                "x-mato-service-id",
                "x-mato-actor",
                "x-correlation-id",
            ],
        )
    ],
    lifespan=lifespan,
)


async def correlation_middleware(request: Request, call_next):
    started = time.perf_counter()
    correlation_id = (
        request.headers.get(settings.correlation_header) or str(uuid.uuid4())
    )[:64]
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers[settings.correlation_header] = correlation_id
    logger.info(
        json.dumps(
            {
                "event": "http_request",
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            }
        )
    )
    return response


app.add_middleware(BaseHTTPMiddleware, dispatch=correlation_middleware)
