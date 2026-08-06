from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from starlette.testclient import TestClient
from test_backend import _org_est

from lead_bot.engines.scoring import DEFAULT_RULE_CONFIG
from lead_bot.models import (
    CostEvent,
    Evidence,
    FreshnessPolicy,
    LeadScore,
    ProviderBudget,
)
from lead_bot.services.learning import (
    LearningInputError,
    create_rule_version,
    ensure_default_shadow_model,
    evaluate_budget,
    evaluate_shadow,
    freshness_gate,
    ingest_outcome,
    learning_report,
    predict_snapshot,
    promote_rule_version,
)


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _scored_establishment(db):
    org, est = _org_est(db)
    db.add(
        LeadScore(
            organization_id=org.id,
            establishment_id=est.id,
            segment="product_owner",
            quality_score=70,
            confidence_score=80,
            timing_score=60,
            priority_score=72,
            strategic_score=50,
            expected_deal_value_eur=9000,
            tier="B",
            score_components_json={"packaged": 5},
            explainable_json={},
            model_version="score-v1",
        )
    )
    db.add(
        Evidence(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="website",
            feature_value="verified",
            source_type="website",
            retrieved_at=_utcnow(),
        )
    )
    db.commit()
    return org, est


def test_outcome_ingestion_is_idempotent_and_identity_join_is_strict(db):
    org, est = _scored_establishment(db)
    payload = {
        "idempotency_key": "crm-event-1",
        "intelligence_establishment_id": str(est.id),
        "enterprise_number": org.enterprise_number,
        "establishment_number": est.establishment_number,
        "outcome_type": "review",
        "outcome_value": "approved",
        "occurred_at": _utcnow().isoformat(),
    }
    first, created = ingest_outcome(db, payload, "crm")
    repeat, repeat_created = ingest_outcome(db, payload, "crm")
    assert created is True
    assert repeat_created is False
    assert repeat.id == first.id
    first.outcome_value = "tampered"
    with pytest.raises(ValueError, match="append-only"):
        db.commit()
    db.rollback()
    with pytest.raises(LearningInputError, match="does not match"):
        ingest_outcome(db, {**payload, "idempotency_key": "bad", "enterprise_number": "0999999999"}, "crm")


def test_outcome_endpoint_requires_service_key():
    from lead_bot.api.main import app

    with TestClient(app) as client:
        response = client.post("/internal/learning/outcomes", json={"idempotency_key": "x"})
    assert response.status_code == 401


def test_learning_metric_math(db):
    org, est = _scored_establishment(db)
    ingest_outcome(db, {
        "idempotency_key": "approved",
        "intelligence_establishment_id": str(est.id),
        "enterprise_number": org.enterprise_number,
        "outcome_type": "review",
        "outcome_value": "approved",
        "gross_margin_eur": 50,
    }, "crm")
    db.add(CostEvent(establishment_id=est.id, provider="places", operation="details", estimated_cost_eur=10))
    db.commit()
    report = learning_report(db)
    assert report["cost_per_qualified_lead_eur"] == 10
    assert report["cost_per_approved_lead_eur"] == 10
    assert report["gross_margin_per_100_reviewed_eur"] == 5000


def test_shadow_reports_insufficient_data_and_predictions_are_bounded(db):
    org, est = _scored_establishment(db)
    snapshot, _ = ingest_outcome(db, {
        "idempotency_key": "shadow-1",
        "intelligence_establishment_id": str(est.id),
        "enterprise_number": org.enterprise_number,
        "outcome_type": "deal",
        "outcome_value": "won",
    }, "crm")
    model = ensure_default_shadow_model(db)
    for target in ("relevance", "response", "meeting", "close"):
        value, status = predict_snapshot(model, snapshot, target)
        assert status == "ok"
        assert value is not None and 0 <= value <= 1
    result = evaluate_shadow(db)
    assert result["targets"]["close"]["status"] == "insufficient_data"


def test_rule_version_needs_explicit_promotion(db):
    row = create_rule_version(db, "candidate-v2", DEFAULT_RULE_CONFIG, "tester")
    evaluate_shadow(db)
    db.refresh(row)
    assert row.status == "candidate"
    promoted = promote_rule_version(db, "candidate-v2", "admin")
    assert promoted.status == "active"
    assert promoted.promoted_by == "admin"
    with pytest.raises(LearningInputError):
        promote_rule_version(db, "candidate-v2", "admin")


def test_budget_cutoff_and_alert(db):
    db.add(ProviderBudget(
        provider="places",
        daily_limit_eur=10,
        monthly_limit_eur=100,
        alert_ratio=0.8,
        cutoff_ratio=1,
    ))
    db.add(CostEvent(provider="places", operation="details", estimated_cost_eur=10))
    db.commit()
    result = evaluate_budget(db, "places")
    assert result["status"] == "cutoff"
    assert result["cutoff"] is True


def test_critical_freshness_gate_requires_research(db):
    _, est = _scored_establishment(db)
    db.add(FreshnessPolicy(field_name="website", max_age_days=7, critical=True))
    evidence = db.query(Evidence).filter_by(establishment_id=est.id, feature_name="website").one()
    evidence.retrieved_at = _utcnow() - timedelta(days=8)
    db.commit()
    blocked = freshness_gate(db, est.id)
    assert blocked == {
        "allowed": False,
        "status": "research_required",
        "stale_fields": ["website"],
    }
    evidence.retrieved_at = _utcnow()
    db.commit()
    assert freshness_gate(db, est.id)["allowed"] is True
