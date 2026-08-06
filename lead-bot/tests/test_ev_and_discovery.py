from __future__ import annotations

from lead_bot.engines.scoring import RuleLeadScoringEngine
from lead_bot.models import Establishment, Feature, LeadScore, Organization, Suppression
from lead_bot.services.discovery import expand_from_customers
from lead_bot.services.enrichment import enrich_establishment
from lead_bot.services.learning import estimate_expected_margin
from lead_bot.services.suppression import add_suppression
from lead_bot.services.timing import extract_job_news_timing
from test_backend import _org_est


def test_estimate_expected_margin_marks_insufficient_data(db):
    result = estimate_expected_margin(
        db,
        {
            "quality_score": 70,
            "confidence_score": 75,
            "timing_score": 60,
            "priority_score": 80,
            "expected_deal_value_eur": 10000,
            "machine": {"recommended_machine": "refrigerated", "recommendation_confidence": 0.8},
            "explainable_json": {"top_positive_reasons": ["Packaged chilled goods"]},
        },
    )
    assert result["expected_margin_eur"] > 0
    assert result["explainable"]["insufficient_data"] is True
    assert result["explainable"]["ev_source"] == "rule_fallback"
    assert "ranking_explanation" in result["explainable"]


def test_score_uses_staged_features_and_freezes_snapshot(db):
    org, est = _org_est(db, number="0456789012", est_number="2456789012")
    est.preliminary_score = 70
    est.status = "AC"
    est.latitude = 51.05
    est.longitude = 3.72
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="website_extraction",
            value_json={
                "business_segment": "product_owner",
                "prepackaged_products": "yes",
                "temperature_requirement": ["chilled"],
                "opening_hours_gap": {"closed_evenings": "yes"},
                "source_evidence": [{"confidence": 0.85, "field": "prepackaged"}],
                "vending_opportunity_summary": "After-hours bakery sales",
            },
            confidence=0.85,
        )
    )
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="places_match",
            value_json={
                "business_status": "OPERATIONAL",
                "rating_count": 40,
                "phone": "+3290000000",
                "closed_evenings": "yes",
            },
            confidence=0.9,
        )
    )
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="geo_context",
            value_json={"demand_proxy": 3.0, "competition_proxy": 2.0, "nearby_count": 12},
            confidence=0.75,
        )
    )
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="financial_profile",
            value_json={"available": False, "confidence": 0.2},
            confidence=0.2,
        )
    )
    db.commit()

    out = enrich_establishment(db, est.id)
    assert out["status"] == "scored"
    assert out["snapshot"] is True
    score = (
        db.query(LeadScore)
        .filter_by(establishment_id=est.id)
        .order_by(LeadScore.id.desc())
        .first()
    )
    assert score is not None
    assert score.expected_margin_eur > 0
    assert score.explainable_json.get("insufficient_data") is True
    snap = (
        db.query(Feature)
        .filter_by(establishment_id=est.id, feature_name="score_feature_snapshot")
        .one()
    )
    assert "places_match" in snap.value_json.get("feature_names", [])
    assert "financial_status" in score.explainable_json


def test_closed_places_hard_rejects(db):
    org, est = _org_est(db, number="0556789012", est_number="2556789012")
    est.preliminary_score = 80
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="places_match",
            value_json={"business_status": "CLOSED_PERMANENTLY"},
            confidence=0.95,
        )
    )
    db.commit()
    out = enrich_establishment(db, est.id)
    assert out["status"] == "rejected"
    db.refresh(est)
    assert est.review_status == "rejected"


def test_financial_unknown_does_not_invent_mid_score():
    with_fin = RuleLeadScoringEngine().score(
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
    without = RuleLeadScoringEngine().score(
        {
            "extraction": {
                "business_segment": "product_owner",
                "prepackaged_products": "yes",
                "temperature_requirement": ["chilled"],
                "source_evidence": [{"confidence": 0.8}],
            },
            "financial": {"available": False},
            "has_website": True,
        }
    )
    assert with_fin["quality_score"] > without["quality_score"]
    assert without["explainable_json"]["financial_status"] == "unknown"
    assert without["confidence_score"] < with_fin["confidence_score"]


def test_job_news_timing_adapter():
    pages = [
        {
            "url": "https://example.be/vacatures",
            "text": "Wij zoeken een medewerker. Vacature bakkerij.",
        },
        {
            "url": "https://example.be/nieuws/opening",
            "text": "Nieuwe vestiging binnenkort open in Gent.",
        },
    ]
    result = extract_job_news_timing(pages)
    types = {s["type"] for s in result["signals"]}
    assert "hiring" in types
    assert "news_expansion" in types
    assert result["adapter"] == "job_news_public_pages"


def test_customer_expansion_tags_sibling_sites(db):
    org = Organization(enterprise_number="0666789012", official_name="Multi Site BV")
    db.add(org)
    db.flush()
    a = Establishment(
        organization_id=org.id,
        establishment_number="2666789011",
        name="Site A",
        status="AC",
        review_status="existing_customer",
    )
    b = Establishment(
        organization_id=org.id,
        establishment_number="2666789012",
        name="Site B",
        status="AC",
        review_status="new",
    )
    db.add_all([a, b])
    db.flush()
    add_suppression(
        db,
        "existing_customer",
        enterprise_number=org.enterprise_number,
        source="crm",
        permanent=False,
        notes="installed base",
    )
    db.commit()

    result = expand_from_customers(db, limit=10, schedule=False)
    assert a.id in result["expanded"] or b.id in result["expanded"]
    feat = (
        db.query(Feature)
        .filter_by(establishment_id=b.id, feature_name="expansion_context")
        .one_or_none()
    )
    assert feat is not None
    assert feat.value_json.get("second_machine") is True
