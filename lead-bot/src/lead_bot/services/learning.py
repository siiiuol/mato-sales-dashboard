from __future__ import annotations

import hashlib
import json
import math
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from lead_bot.engines.scoring import DEFAULT_RULE_CONFIG
from lead_bot.models import (
    CostEvent,
    Establishment,
    Evidence,
    Feature,
    FreshnessPolicy,
    LeadScore,
    ModelMetric,
    Organization,
    OutcomeSnapshot,
    ProviderBudget,
    RuleVersion,
    ScorerRun,
    ShadowModelVersion,
    ShadowPrediction,
)

TARGETS = ("relevance", "response", "meeting", "close", "machine_count", "gross_margin", "sales_cycle")
BINARY_TARGETS = {"relevance", "response", "meeting", "close"}


class LearningInputError(ValueError):
    pass


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _checksum(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def create_rule_version(
    db: Session, version: str, config: dict[str, Any], actor: str
) -> RuleVersion:
    row = RuleVersion(
        version=version,
        config_json=config,
        config_checksum=_checksum(config),
        status="candidate",
        created_by=actor,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def estimate_expected_margin(db: Session, score: dict[str, Any]) -> dict[str, Any]:
    """Queue rank = P(meeting) × P(close|meeting) × expected gross margin.

    Uses shadow model when enough labelled outcomes exist; otherwise a rule-derived
    fallback. Never invents certainty — insufficient_data is explicit.
    """
    model = ensure_default_shadow_model(db)
    labelled = db.query(OutcomeSnapshot).count()
    insufficient = labelled < max(20, int(model.minimum_samples or 20))

    priority = float(score.get("priority_score") or 0)
    quality = float(score.get("quality_score") or 0)
    confidence = float(score.get("confidence_score") or 0)
    timing = float(score.get("timing_score") or 0)
    deal_value = float(score.get("expected_deal_value_eur") or 0)
    machine = score.get("machine") or {}
    conf_machine = float(machine.get("recommendation_confidence") or 0.55)

    # Rule-derived probabilities (bounded, explainable)
    p_meeting = max(0.02, min(0.85, (priority / 100) * 0.55 + (timing / 100) * 0.25 + (confidence / 100) * 0.15))
    p_close_given_meeting = max(
        0.05,
        min(0.75, (quality / 100) * 0.45 + conf_machine * 0.35 + (confidence / 100) * 0.15),
    )
    # Gross margin proxy: ~35% of expected deal value when unknown
    expected_gm = max(400.0, deal_value * 0.35)
    ev_source = "rule_fallback"

    if not insufficient:
        # Calibrate with shadow meeting/close/margin predictors using a duck-typed snapshot
        class _Snap:
            rule_score_json = {
                "priority": priority,
                "quality": quality,
                "timing": timing,
                "confidence": confidence,
            }
            evidence_json = (score.get("explainable_json") or {}).get("top_positive_reasons") or []

        synthetic = _Snap()
        p_m, st_m = predict_snapshot(model, synthetic, "meeting")  # type: ignore[arg-type]
        p_c, st_c = predict_snapshot(model, synthetic, "close")  # type: ignore[arg-type]
        gm, st_g = predict_snapshot(model, synthetic, "gross_margin")  # type: ignore[arg-type]
        if st_m == "ok" and p_m is not None:
            p_meeting = max(0.02, min(0.9, float(p_m)))
        if st_c == "ok" and p_c is not None and p_meeting > 0:
            # shadow close is P(close); convert to P(close|meeting) ≈ P(close)/P(meeting)
            p_close_given_meeting = max(0.05, min(0.85, float(p_c) / max(p_meeting, 0.05)))
        if st_g == "ok" and gm is not None:
            expected_gm = max(400.0, float(gm))
        ev_source = "shadow_calibrated"

    expected_margin = p_meeting * p_close_given_meeting * expected_gm
    machine_name = machine.get("recommended_machine") or "machine"
    if insufficient:
        plain = (
            f"Early estimate · ~{int(p_meeting * 100)}% meeting chance · "
            f"{machine_name.replace('_', ' ')} fit (limited outcome history)"
        )
    else:
        plain = (
            f"High chance of meeting · {machine_name.replace('_', ' ')} fit"
            if p_meeting >= 0.35 and expected_margin >= 800
            else f"Moderate opportunity · {machine_name.replace('_', ' ')} fit"
        )

    return {
        "expected_margin_eur": round(expected_margin, 2),
        "p_meeting": round(p_meeting, 4),
        "p_close_given_meeting": round(p_close_given_meeting, 4),
        "expected_gross_margin_eur": round(expected_gm, 2),
        "explainable": {
            "expected_margin_eur": round(expected_margin, 2),
            "ranking_explanation": plain,
            "rank_explanation": plain,
            "why_this_company": plain,
            "insufficient_data": insufficient,
            "ev_source": ev_source,
            "p_meeting": round(p_meeting, 4),
            "p_close_given_meeting": round(p_close_given_meeting, 4),
            "expected_gross_margin_eur": round(expected_gm, 2),
            "shadow_sample_count": labelled,
            "shadow_minimum_samples": int(model.minimum_samples or 20),
        },
    }


def promote_rule_version(db: Session, version: str, actor: str) -> RuleVersion:
    row = db.query(RuleVersion).filter_by(version=version).one_or_none()
    if not row or row.status != "candidate":
        raise LearningInputError("Only an existing candidate can be explicitly promoted")
    db.query(RuleVersion).filter_by(status="active").update({"status": "retired"})
    row.status = "active"
    row.promoted_by = actor
    row.promoted_at = _utcnow()
    db.commit()
    return row


def record_scorer_run(
    db: Session, establishment_id: int, rule_version: str, score: dict[str, Any], inputs: dict[str, Any]
) -> ScorerRun:
    version = db.query(RuleVersion).filter_by(version=rule_version).one_or_none()
    if not version:
        raise LearningInputError("Unknown rule version")
    row = ScorerRun(
        rule_version_id=version.id,
        establishment_id=establishment_id,
        score_json=score,
        input_checksum=_checksum(inputs),
        authoritative=True,
    )
    db.add(row)
    db.commit()
    return row


def _resolve_identity(db: Session, payload: dict[str, Any]) -> tuple[Organization, Establishment]:
    intelligence_id = str(payload.get("intelligence_establishment_id") or "").strip()
    enterprise_number = str(payload.get("enterprise_number") or "").strip()
    establishment_number = str(payload.get("establishment_number") or "").strip()
    if not intelligence_id and not enterprise_number and not establishment_number:
        raise LearningInputError("At least one intelligence identity is required")

    candidates: list[Establishment] = []
    if intelligence_id.isdigit():
        row = db.query(Establishment).filter_by(id=int(intelligence_id)).one_or_none()
        if row:
            candidates.append(row)
    if establishment_number:
        row = (
            db.query(Establishment)
            .filter_by(establishment_number=establishment_number)
            .one_or_none()
        )
        if row:
            candidates.append(row)
    if enterprise_number:
        rows = (
            db.query(Establishment)
            .join(Organization)
            .filter(Organization.enterprise_number == enterprise_number)
            .all()
        )
        if len(rows) == 1:
            candidates.append(rows[0])
        elif len(rows) > 1 and not intelligence_id and not establishment_number:
            raise LearningInputError("Enterprise number is ambiguous; establishment identity required")
    if not candidates or len({row.id for row in candidates}) != 1:
        raise LearningInputError("Identity keys do not resolve to one establishment")
    est = candidates[0]
    org = db.query(Organization).filter_by(id=est.organization_id).one()
    if enterprise_number and org.enterprise_number != enterprise_number:
        raise LearningInputError("Enterprise number does not match intelligence identity")
    if establishment_number and est.establishment_number != establishment_number:
        raise LearningInputError("Establishment number does not match intelligence identity")
    return org, est


def ingest_outcome(db: Session, payload: dict[str, Any], source_service: str) -> tuple[OutcomeSnapshot, bool]:
    key = str(payload.get("idempotency_key") or "").strip()
    if not key:
        raise LearningInputError("idempotency_key is required")
    existing = (
        db.query(OutcomeSnapshot)
        .filter_by(source_service=source_service, idempotency_key=key)
        .one_or_none()
    )
    if existing:
        return existing, False
    org, est = _resolve_identity(db, payload)
    score = (
        db.query(LeadScore)
        .filter_by(establishment_id=est.id)
        .order_by(LeadScore.calculated_at.desc())
        .first()
    )
    frozen = (
        db.query(Feature)
        .filter_by(establishment_id=est.id, feature_name="score_feature_snapshot")
        .order_by(Feature.calculated_at.desc())
        .first()
    )
    features = db.query(Feature).filter_by(establishment_id=est.id).all()
    evidence = db.query(Evidence).filter_by(establishment_id=est.id).all()
    occurred_at = payload.get("occurred_at")
    if isinstance(occurred_at, str):
        raw_occurred_at = f"{occurred_at[:-1]}+00:00" if occurred_at.endswith("Z") else occurred_at
        occurred_at = datetime.fromisoformat(raw_occurred_at)
        if occurred_at.tzinfo:
            occurred_at = occurred_at.astimezone(UTC).replace(tzinfo=None)
    occurred_at = occurred_at or _utcnow()
    if frozen and frozen.value_json:
        features_json = {
            "score_feature_snapshot": {
                "value": frozen.value_json,
                "confidence": frozen.confidence,
                "calculated_at": frozen.calculated_at.isoformat() if frozen.calculated_at else None,
            },
            **{
                name: meta
                for name, meta in (frozen.value_json.get("features") or {}).items()
            },
        }
    else:
        features_json = {
            item.feature_name: {
                "value": item.value_json,
                "confidence": item.confidence,
                "calculated_at": item.calculated_at.isoformat() if item.calculated_at else None,
            }
            for item in features
        }
    row = OutcomeSnapshot(
        source_service=source_service,
        idempotency_key=key,
        establishment_id=est.id,
        intelligence_establishment_id=str(est.id),
        enterprise_number=org.enterprise_number,
        establishment_number=est.establishment_number,
        outcome_type=str(payload.get("outcome_type") or "unknown")[:32],
        outcome_value=str(payload.get("outcome_value") or "unknown")[:64],
        features_json=features_json,
        evidence_json=[
            {
                "feature": item.feature_name,
                "value": item.feature_value,
                "source": item.source_url or item.source_type,
                "retrieved_at": item.retrieved_at.isoformat() if item.retrieved_at else None,
                "confidence": item.extraction_confidence,
            }
            for item in evidence
        ],
        rule_score_json={
            "quality": score.quality_score,
            "priority": score.priority_score,
            "tier": score.tier,
            "version": score.model_version,
            "expected_margin_eur": score.expected_margin_eur,
        } if score else {},
        machine_count=_optional_int(payload.get("machine_count")),
        revenue_eur=_optional_float(payload.get("revenue_eur")),
        gross_margin_eur=_optional_float(payload.get("gross_margin_eur")),
        sales_cycle_days=_optional_float(payload.get("sales_cycle_days")),
        cohort=str(payload.get("cohort") or (score.segment if score else "all"))[:64],
        occurred_at=occurred_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, True


def _optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    result = float(value)
    if not math.isfinite(result) or result < 0:
        raise LearningInputError("Outcome numeric values must be finite and non-negative")
    return result


def _optional_int(value: Any) -> int | None:
    result = _optional_float(value)
    return None if result is None else int(result)


def ensure_default_shadow_model(db: Session) -> ShadowModelVersion:
    current = db.query(ShadowModelVersion).filter_by(name="deterministic_baseline", version="v1").one_or_none()
    if current:
        return current
    definition = {
        "intercept": -1.2,
        "weights": {"priority": 0.025, "quality": 0.015, "evidence_count": 0.08},
        "continuous": {
            "machine_count": {"scale": 0.025, "floor": 0},
            "gross_margin": {"scale": 100.0, "floor": 0},
            "sales_cycle": {"scale": -0.35, "floor": 1},
        },
    }
    current = ShadowModelVersion(
        name="deterministic_baseline",
        version="v1",
        definition_json=definition,
        status="shadow",
        minimum_samples=20,
    )
    db.add(current)
    db.commit()
    db.refresh(current)
    return current


def predict_snapshot(model: ShadowModelVersion, snapshot: OutcomeSnapshot, target: str) -> tuple[float | None, str]:
    if target not in TARGETS:
        raise LearningInputError("Unknown target")
    scores = snapshot.rule_score_json or {}
    if not scores:
        return None, "insufficient_data"
    z = float(model.definition_json.get("intercept", -1.2))
    weights = model.definition_json.get("weights", {})
    z += float(scores.get("priority") or 0) * float(weights.get("priority", 0))
    z += float(scores.get("quality") or 0) * float(weights.get("quality", 0))
    z += len(snapshot.evidence_json or []) * float(weights.get("evidence_count", 0))
    probability = max(0.0, min(1.0, 1 / (1 + math.exp(-max(-40, min(40, z))))))
    if target in BINARY_TARGETS:
        factors = {"relevance": 1.0, "response": 0.78, "meeting": 0.55, "close": 0.32}
        return max(0.0, min(1.0, probability * factors[target])), "ok"
    if target == "machine_count":
        return max(0.0, min(1000.0, probability * 4)), "ok"
    if target == "gross_margin":
        return max(0.0, min(10_000_000.0, probability * 8500)), "ok"
    return max(1.0, min(3650.0, 180 * (1.1 - probability))), "ok"


def evaluate_shadow(db: Session, cohort: str = "all") -> dict[str, Any]:
    model = ensure_default_shadow_model(db)
    query = db.query(OutcomeSnapshot)
    if cohort != "all":
        query = query.filter_by(cohort=cohort)
    snapshots = query.all()
    output: dict[str, Any] = {"model": f"{model.name}:{model.version}", "cohort": cohort, "targets": {}}
    for target in TARGETS:
        pairs: list[tuple[float, float]] = []
        for snapshot in snapshots:
            prediction, status = predict_snapshot(model, snapshot, target)
            existing = db.query(ShadowPrediction).filter_by(
                model_version_id=model.id, outcome_snapshot_id=snapshot.id, target=target
            ).one_or_none()
            if not existing:
                db.add(ShadowPrediction(
                    model_version_id=model.id,
                    outcome_snapshot_id=snapshot.id,
                    target=target,
                    prediction=prediction,
                    status=status,
                    reason=None if status == "ok" else "Rule score snapshot unavailable",
                ))
            actual = _actual(snapshot, target)
            if prediction is not None and actual is not None:
                pairs.append((prediction, actual))
        status = "ok" if len(pairs) >= model.minimum_samples else "insufficient_data"
        metrics = {}
        if status == "ok":
            metrics["mae"] = sum(abs(p - a) for p, a in pairs) / len(pairs)
            metrics["rule_baseline_mae"] = sum(
                abs(float(s.rule_score_json.get("priority", 0)) / 100 - (_actual(s, target) or 0))
                for s in snapshots if target in BINARY_TARGETS and _actual(s, target) is not None
            ) / len(pairs) if target in BINARY_TARGETS else None
        metric = ModelMetric(
            model_version_id=model.id,
            cohort=cohort,
            target=target,
            sample_count=len(pairs),
            status=status,
            metrics_json=metrics,
        )
        db.add(metric)
        output["targets"][target] = {"status": status, "sample_count": len(pairs), **metrics}
    db.commit()
    return output


def _actual(snapshot: OutcomeSnapshot, target: str) -> float | None:
    if target == "machine_count":
        return float(snapshot.machine_count) if snapshot.machine_count is not None else None
    if target == "gross_margin":
        return snapshot.gross_margin_eur
    if target == "sales_cycle":
        return snapshot.sales_cycle_days
    event_rank = {"relevance": 0, "response": 1, "meeting": 2, "close": 3}
    observed = {"review": 0, "outreach": 1, "meeting": 2, "deal": 3}.get(snapshot.outcome_type)
    if observed is None:
        return None
    positive = snapshot.outcome_value.lower() not in {"rejected", "lost", "no_response", "not_interested"}
    return float(positive and observed >= event_rank[target])


def learning_report(db: Session, cohort: str = "all") -> dict[str, Any]:
    evaluation = evaluate_shadow(db, cohort)
    query = db.query(OutcomeSnapshot)
    if cohort != "all":
        query = query.filter_by(cohort=cohort)
    rows = query.all()
    reviewed = sum(1 for row in rows if row.outcome_type == "review")
    approved = sum(1 for row in rows if row.outcome_type == "review" and row.outcome_value.lower() in {"approved", "qualified"})
    qualified = sum(1 for row in rows if row.outcome_value.lower() in {"qualified", "approved", "won"})
    meetings = sum(
        1
        for row in rows
        if row.outcome_type in {"meeting", "deal"}
        and row.outcome_value.lower() not in {"rejected", "lost", "no_response", "not_interested"}
    )
    margin = sum(row.gross_margin_eur or 0 for row in rows)
    establishment_ids = {row.establishment_id for row in rows}
    cost = (
        db.query(func.sum(CostEvent.estimated_cost_eur))
        .filter(CostEvent.establishment_id.in_(establishment_ids))
        .scalar() or 0
    ) if establishment_ids else 0
    rule_evs = [
        float((row.rule_score_json or {}).get("expected_margin_eur") or 0)
        for row in rows
        if (row.rule_score_json or {}).get("expected_margin_eur") is not None
    ]
    active_rules = db.query(RuleVersion).filter_by(status="active").count()
    candidates = db.query(RuleVersion).filter_by(status="candidate").count()
    return {
        **evaluation,
        "reviewed": reviewed,
        "approved": approved,
        "meeting_rate": round(meetings / reviewed, 3) if reviewed else None,
        "approval_rate": round(approved / reviewed, 3) if reviewed else None,
        "cost_per_qualified_lead_eur": round(cost / qualified, 2) if qualified else None,
        "cost_per_approved_lead_eur": round(cost / approved, 2) if approved else None,
        "gross_margin_per_100_reviewed_eur": round(margin * 100 / reviewed, 2) if reviewed else None,
        "economics_status": "ok" if reviewed and (approved or qualified) else "insufficient_data",
        "rule_vs_shadow": {
            "rule_mean_expected_margin_eur": round(sum(rule_evs) / len(rule_evs), 2) if rule_evs else None,
            "shadow_status": evaluation.get("targets", {}).get("gross_margin", {}).get("status"),
            "promote_only": True,
            "active_rule_versions": active_rules,
            "candidate_rule_versions": candidates,
            "note": "Candidates never auto-promote; use POST /internal/learning/rules/promote",
        },
    }


def evaluate_budget(db: Session, provider: str, now: datetime | None = None) -> dict[str, Any]:
    now = now or _utcnow()
    budget = db.query(ProviderBudget).filter_by(provider=provider, enabled=True).one_or_none()
    if not budget:
        return {"provider": provider, "status": "unconfigured", "cutoff": False}
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = day_start.replace(day=1)
    daily = db.query(func.sum(CostEvent.estimated_cost_eur)).filter(
        CostEvent.provider == provider, CostEvent.created_at >= day_start
    ).scalar() or 0
    monthly = db.query(func.sum(CostEvent.estimated_cost_eur)).filter(
        CostEvent.provider == provider, CostEvent.created_at >= month_start
    ).scalar() or 0
    day_ratio = daily / budget.daily_limit_eur if budget.daily_limit_eur else 1
    month_ratio = monthly / budget.monthly_limit_eur if budget.monthly_limit_eur else 1
    ratio = max(day_ratio, month_ratio)
    return {
        "provider": provider,
        "daily_spend_eur": round(daily, 4),
        "monthly_spend_eur": round(monthly, 4),
        "status": "cutoff" if ratio >= budget.cutoff_ratio else "alert" if ratio >= budget.alert_ratio else "ok",
        "cutoff": ratio >= budget.cutoff_ratio,
    }


def freshness_gate(db: Session, establishment_id: int, now: datetime | None = None) -> dict[str, Any]:
    now = now or _utcnow()
    stale: list[str] = []
    for policy in db.query(FreshnessPolicy).filter_by(critical=True).all():
        latest_feature = db.query(func.max(Feature.calculated_at)).filter_by(
            establishment_id=establishment_id, feature_name=policy.field_name
        ).scalar()
        latest_evidence = db.query(func.max(Evidence.retrieved_at)).filter_by(
            establishment_id=establishment_id, feature_name=policy.field_name
        ).scalar()
        latest = max((x for x in (latest_feature, latest_evidence) if x), default=None)
        if latest is None or latest < now - timedelta(days=policy.max_age_days):
            stale.append(policy.field_name)
    return {"allowed": not stale, "status": "ok" if not stale else "research_required", "stale_fields": stale}


def audit_export(db: Session) -> dict[str, Any]:
    return {
        "exported_at": _utcnow().isoformat(),
        "rule_versions": [
            {"version": r.version, "status": r.status, "checksum": r.config_checksum}
            for r in db.query(RuleVersion).order_by(RuleVersion.created_at).all()
        ],
        "outcomes": [
            {
                "id": row.id,
                "source": row.source_service,
                "idempotency_key": row.idempotency_key,
                "establishment_id": row.intelligence_establishment_id,
                "outcome": [row.outcome_type, row.outcome_value],
                "occurred_at": row.occurred_at.isoformat(),
            }
            for row in db.query(OutcomeSnapshot).order_by(OutcomeSnapshot.id).all()
        ],
    }
