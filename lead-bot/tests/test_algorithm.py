from __future__ import annotations

from unittest.mock import patch

from test_backend import _org_est

from lead_bot.engines.scoring import RuleLeadScoringEngine
from lead_bot.models import Feature, LeadScore, Suppression
from lead_bot.providers.places import normalize_place
from lead_bot.services.discovery import places_category_sweep
from lead_bot.services.enrichment import enrich_establishment
from lead_bot.services.learning import estimate_expected_margin
from lead_bot.services.stages import discover_website_stage


def _seed_features(db, org, est, *, extraction=None, places=None):
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="website_extraction",
            value_json=extraction
            or {
                "business_segment": "product_owner",
                "prepackaged_products": "yes",
                "temperature_requirement": ["chilled"],
                "opening_hours_gap": {"closed_evenings": "yes", "closed_days_per_week": 1},
                "source_evidence": [
                    {
                        "field": "prepackaged_products",
                        "value": "yes",
                        "source_url": "https://example.test",
                        "source_text": "voorverpakt",
                        "confidence": 0.9,
                    }
                ],
                "vending_opportunity_summary": "After-hours bakery sales",
            },
            confidence=0.8,
        )
    )
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="social_profiles",
            value_json={"platform_count": 1, "profiles": [], "platforms": ["instagram"]},
            confidence=0.7,
        )
    )
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="financial_profile",
            value_json={"available": False, "confidence": 0.0, "reason": "unavailable"},
            confidence=0.0,
        )
    )
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="timing_signals",
            value_json={"signals": [{"type": "growth", "weight": 20}], "score": 60},
            confidence=0.7,
        )
    )
    if places is not None:
        db.add(
            Feature(
                organization_id=org.id,
                establishment_id=est.id,
                feature_name="places_match",
                value_json=places,
                confidence=0.9,
            )
        )
    est.preliminary_score = 70
    est.status = "AC"
    db.commit()


def test_score_consumes_snapshot_features_without_recrawl(db):
    org, est = _org_est(db)
    _seed_features(db, org, est)
    with patch("lead_bot.providers.crawler.HttpxWebsiteCrawler.crawl") as crawl:
        result = enrich_establishment(db, est.id)
        crawl.assert_not_called()
    assert result["status"] == "scored"
    assert result["snapshot"] is True
    snap = (
        db.query(Feature)
        .filter_by(establishment_id=est.id, feature_name="score_feature_snapshot")
        .one()
    )
    assert "website_extraction" in (snap.value_json.get("features") or {})
    score = db.query(LeadScore).filter_by(establishment_id=est.id).one()
    assert score.expected_margin_eur > 0
    assert score.explainable_json.get("insufficient_data") is True
    assert score.explainable_json.get("financial_status") == "unknown"


def test_closed_places_hard_reject(db):
    org, est = _org_est(db, number="0111222333", est_number="2111222333")
    est.preliminary_score = 80
    db.commit()

    closed = normalize_place(
        {
            "id": "places/closed-1",
            "displayName": {"text": "Closed Bakery"},
            "formattedAddress": "9000 Gent",
            "businessStatus": "CLOSED_PERMANENTLY",
        }
    )

    class ClosedProvider:
        available = True

        def match_establishment(self, name, address):
            return closed

    with patch(
        "lead_bot.services.stages.GooglePlacesProvider",
        return_value=ClosedProvider(),
    ):
        out = discover_website_stage(db, est.id)
    db.commit()
    assert out.get("rejected") == "business_closed"
    db.refresh(est)
    assert est.review_status == "rejected"
    assert (
        db.query(Suppression)
        .filter_by(establishment_number=est.establishment_number, reason="business_closed")
        .count()
        == 1
    )

    # Scoring path also rejects when places_match is frozen closed.
    org2, est2 = _org_est(db, number="0111222444", est_number="2111222444", name="Also Closed")
    _seed_features(
        db,
        org2,
        est2,
        places={"business_status": "CLOSED_PERMANENTLY", "id": "places/x"},
    )
    scored = enrich_establishment(db, est2.id)
    assert scored["status"] == "rejected"
    assert scored["reason"] == "business_closed"


def test_expected_margin_ranks_review_queue(db):
    org_a, est_a = _org_est(db, number="1000000001", est_number="2000000001", name="Low EV")
    org_b, est_b = _org_est(db, number="1000000002", est_number="2000000002", name="High EV")
    scores = []
    for org, est, margin, priority in (
        (org_a, est_a, 100.0, 90.0),
        (org_b, est_b, 900.0, 50.0),
    ):
        row = LeadScore(
            organization_id=org.id,
            establishment_id=est.id,
            segment="product_owner",
            quality_score=60,
            confidence_score=60,
            timing_score=60,
            priority_score=priority,
            strategic_score=50,
            expected_deal_value_eur=8000,
            expected_margin_eur=margin,
            tier="A",
            score_components_json={},
            explainable_json={
                "rank_explanation": f"EV {margin}",
                "why_this_company": f"EV {margin}",
                "insufficient_data": True,
                "ev_source": "rule_fallback",
                "p_meeting": 0.4,
                "p_close_given_meeting": 0.3,
            },
            model_version="score-v1",
        )
        db.add(row)
        scores.append(row)
        est.review_status = "ready_for_review"
    db.commit()

    ev = estimate_expected_margin(
        db,
        {
            "quality_score": 80,
            "confidence_score": 70,
            "timing_score": 70,
            "priority_score": 80,
            "expected_deal_value_eur": 12000,
            "machine": {"recommended_machine": "refrigerated"},
        },
    )
    assert ev["expected_margin_eur"] > 0
    assert ev["explainable"]["insufficient_data"] is True
    assert "p_meeting" in ev["explainable"]

    from sqlalchemy import desc

    from lead_bot.api.main import _serialize_lead

    ordered = (
        db.query(LeadScore)
        .filter(LeadScore.tier.in_(["A+", "A"]))
        .order_by(
            desc(LeadScore.expected_margin_eur),
            desc(LeadScore.priority_score),
        )
        .all()
    )
    assert len(ordered) == 2
    assert ordered[0].expected_margin_eur >= ordered[1].expected_margin_eur
    assert ordered[0].establishment_id == est_b.id
    # Higher priority alone must not beat higher EV.
    assert ordered[0].priority_score < ordered[1].priority_score

    payload = _serialize_lead(db, ordered[0])
    assert payload["expected_margin_eur"] == 900.0
    assert payload["rank_explanation"]
    assert payload["insufficient_data"] is True
    assert payload["company_name"] == "High EV"


def test_discovery_suppression_first(db):
    org, est = _org_est(db, number="1555555555", est_number="2555555555", name="Suppressed Bakery")
    db.add(
        Suppression(
            enterprise_number=org.enterprise_number,
            establishment_number=est.establishment_number,
            reason="do_not_contact",
            permanent=True,
            source="test",
        )
    )
    db.commit()

    place = normalize_place(
        {
            "id": "places/sweep-1",
            "displayName": {"text": "Suppressed Bakery"},
            "formattedAddress": "9000 Gent",
            "businessStatus": "OPERATIONAL",
            "websiteUri": "https://suppressed.example",
        }
    )

    class SweepProvider:
        available = True

        def search_category(self, query, region_bias="x", page_size=8):
            return [place]

    with patch(
        "lead_bot.services.discovery.GooglePlacesProvider",
        return_value=SweepProvider(),
    ), patch(
        "lead_bot.services.discovery.resolve_external_entity",
        return_value=type(
            "L", (), {"target_type": "establishment", "target_id": est.id}
        )(),
    ), patch(
        "lead_bot.jobs.tasks.task_schedule_pipeline.delay"
    ) as enqueue:
        result = places_category_sweep(
            db,
            queries=("bakkerij",),
            regions=("Gent",),
            limit_per_query=1,
            schedule=True,
        )
    assert result["matched"] == 0
    assert result["scheduled"] == []
    enqueue.assert_not_called()


def test_nbb_unknown_does_not_invent_mid_financial_score():
    with_unknown = RuleLeadScoringEngine().score(
        {
            "extraction": {
                "business_segment": "product_owner",
                "prepackaged_products": "yes",
                "temperature_requirement": ["chilled"],
                "source_evidence": [{"confidence": 0.8}],
            },
            "financial": {"available": False, "confidence": 0.0},
            "has_website": True,
        }
    )
    with_finance = RuleLeadScoringEngine().score(
        {
            "extraction": {
                "business_segment": "product_owner",
                "prepackaged_products": "yes",
                "temperature_requirement": ["chilled"],
                "source_evidence": [{"confidence": 0.8}],
            },
            "financial": {"available": True, "capacity_score": 4},
            "has_website": True,
        }
    )
    assert with_unknown["score_components_json"].get("financial") == 0
    assert with_finance["score_components_json"].get("financial") == 4
    assert with_unknown["confidence_score"] < with_finance["confidence_score"]
    assert with_unknown["explainable_json"]["financial_status"] == "unknown"
