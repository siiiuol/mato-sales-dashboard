from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from lead_bot.config import get_settings
from lead_bot.engines.scoring import DEFAULT_RULE_CONFIG, RuleLeadScoringEngine
from lead_bot.models import (
    Contact,
    Establishment,
    Feature,
    LeadScore,
    MachineRecommendation,
    Organization,
    RuleVersion,
    ScorerRun,
    Website,
)
from lead_bot.providers.geo import HaversineGeoProvider, nearby_density
from lead_bot.services.learning import estimate_expected_margin
from lead_bot.services.suppression import is_suppressed

FEATURE_NAMES = (
    "website_extraction",
    "social_profiles",
    "financial_profile",
    "timing_signals",
    "places_match",
    "geo_context",
    "crawl_pages",
    "expansion_context",
)


def enrichment_depth(preliminary: float) -> str:
    if preliminary < 30:
        return "stop"
    if preliminary < 50:
        return "homepage"
    if preliminary < 65:
        return "key_pages"
    return "full"


def _latest_feature(db: Session, est_id: int, name: str) -> Feature | None:
    return (
        db.query(Feature)
        .filter_by(establishment_id=est_id, feature_name=name)
        .order_by(Feature.calculated_at.desc())
        .first()
    )


def _feature_map(db: Session, est_id: int) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name in FEATURE_NAMES:
        row = _latest_feature(db, est_id, name)
        if row:
            out[name] = {
                "value": row.value_json,
                "confidence": row.confidence,
                "calculated_at": row.calculated_at.isoformat() if row.calculated_at else None,
                "model_version": row.model_version,
            }
    return out


def enrich_establishment(db: Session, establishment_id: int) -> dict[str, Any]:
    """Score from staged features only — never re-crawl or re-extract here."""
    settings = get_settings()
    est = db.query(Establishment).filter_by(id=establishment_id).one()
    org = db.query(Organization).filter_by(id=est.organization_id).one()

    suppressed = is_suppressed(
        db,
        enterprise_number=org.enterprise_number,
        establishment_number=est.establishment_number,
    )
    if suppressed and suppressed.permanent and suppressed.reason in {
        "do_not_contact",
        "legal_restriction",
        "business_closed",
        "manual_block",
    }:
        est.review_status = "rejected"
        db.commit()
        return {"status": "rejected", "reason": suppressed.reason}

    if org.is_natural_person:
        est.review_status = "quarantined_np"
        db.commit()
        return {"status": "quarantined_np"}

    depth = enrichment_depth(est.preliminary_score)
    est.enrichment_stage = depth
    if depth == "stop":
        db.commit()
        return {"status": "stopped", "preliminary": est.preliminary_score}

    features = _feature_map(db, est.id)
    places = (features.get("places_match") or {}).get("value") or {}
    if places.get("business_status") in {"CLOSED_PERMANENTLY", "permanently_closed"}:
        est.review_status = "rejected"
        if not (suppressed and suppressed.reason == "business_closed"):
            from lead_bot.services.suppression import add_suppression

            add_suppression(
                db,
                "business_closed",
                enterprise_number=org.enterprise_number,
                establishment_number=est.establishment_number,
                source="google_places",
                permanent=True,
                notes="Places businessStatus=CLOSED_PERMANENTLY",
            )
        db.commit()
        return {"status": "rejected", "reason": "business_closed"}

    extraction = dict((features.get("website_extraction") or {}).get("value") or {})
    social = dict((features.get("social_profiles") or {}).get("value") or {})
    financial = dict((features.get("financial_profile") or {}).get("value") or {})
    timing = dict((features.get("timing_signals") or {}).get("value") or {})
    geo_ctx = dict((features.get("geo_context") or {}).get("value") or {})
    expansion = dict((features.get("expansion_context") or {}).get("value") or {})

    if social:
        growth = list(extraction.get("growth_signals") or [])
        growth.extend(social.get("growth_signals") or [])
        extraction["growth_signals"] = list(dict.fromkeys(growth))
        staff = list(extraction.get("staff_shortage_signals") or [])
        staff.extend(social.get("hiring_signals") or [])
        extraction["staff_shortage_signals"] = list(dict.fromkeys(staff))
        evidence = list(extraction.get("source_evidence") or [])
        evidence.extend(social.get("source_evidence") or [])
        extraction["source_evidence"] = evidence
        extraction["social_profiles"] = social.get("profiles") or []

    if timing.get("signals"):
        for signal in timing["signals"]:
            stype = signal.get("type")
            if stype == "new_location" and not extraction.get("new_location_signals"):
                extraction["new_location_signals"] = ["timing_signal"]
            if stype in {"growth", "job_post", "news_expansion"} and stype not in (
                extraction.get("growth_signals") or []
            ):
                growth = list(extraction.get("growth_signals") or [])
                growth.append(stype)
                extraction["growth_signals"] = growth
            if stype in {"staff_shortage", "hiring"} and not extraction.get(
                "staff_shortage_signals"
            ):
                extraction["staff_shortage_signals"] = [stype]

    website = (
        db.query(Website)
        .filter(
            (Website.establishment_id == est.id) | (Website.organization_id == org.id)
        )
        .order_by(Website.id.desc())
        .first()
    )
    crawl_pages = ((features.get("crawl_pages") or {}).get("value") or {}).get("pages") or []

    geo = HaversineGeoProvider()
    distance = None
    if est.latitude is not None and est.longitude is not None:
        distance = geo.distance_km(est.latitude, est.longitude)
        if not geo_ctx:
            geo_ctx = nearby_density(db, est.latitude, est.longitude, est.postcode)

    has_email = (
        db.query(Contact)
        .filter_by(organization_id=org.id, contact_type="email")
        .count()
        > 0
    )
    has_phone = (
        db.query(Contact)
        .filter_by(organization_id=org.id, contact_type="phone")
        .count()
        > 0
    ) or bool(places.get("phone"))
    location_count = db.query(Establishment).filter_by(organization_id=org.id).count()
    # Prefer KBO establishment count over guessed website location counts.
    extraction["number_of_locations"] = location_count
    if location_count > 1 and extraction.get("business_segment") in {
        None,
        "uncertain",
        "product_owner",
    }:
        extraction["business_segment"] = "multi_location"

    places_hours = places.get("opening_hours") or places.get("regularOpeningHours") or {}
    if places_hours and not (extraction.get("opening_hours_gap") or {}).get(
        "closed_evenings"
    ):
        gap = dict(extraction.get("opening_hours_gap") or {})
        if places.get("closed_evenings") is not None:
            gap["closed_evenings"] = places["closed_evenings"]
        if places.get("closed_days_per_week") is not None:
            gap["closed_days_per_week"] = places["closed_days_per_week"]
        extraction["opening_hours_gap"] = gap

    engine = RuleLeadScoringEngine()
    result = engine.score(
        {
            "extraction": extraction
            or {
                "business_segment": est.segment_hint or "uncertain",
                "source_evidence": [],
                "temperature_requirement": ["unknown"],
                "opening_hours_gap": {},
                "risk_factors": ["No website extraction feature yet"],
                "vending_opportunity_summary": "NACE-based preliminary opportunity",
                "social_profiles": social.get("profiles") or [],
            },
            "segment_hint": est.segment_hint,
            "distance_km": distance,
            "has_email": has_email,
            "has_phone": has_phone,
            "has_website": bool(website) or bool(places.get("website")),
            "has_contact_page": any(
                "contact" in (p.get("url") or "") for p in crawl_pages
            ),
            "social": social,
            "financial": financial,
            "places": places,
            "geo": geo_ctx,
            "timing": timing,
            "suppressed_permanent": bool(suppressed and suppressed.permanent),
            "inactive": est.status != "AC",
            "location_count": location_count,
            "hard_reject": places.get("business_status")
            in {"CLOSED_PERMANENTLY", "permanently_closed"},
            "expansion_lead": bool(
                expansion.get("second_machine")
                or expansion.get("path") == "second_machine"
                or (suppressed and suppressed.reason == "existing_customer")
            ),
        }
    )

    ev = estimate_expected_margin(
        db,
        {
            "quality_score": result["quality_score"],
            "confidence_score": result["confidence_score"],
            "timing_score": result["timing_score"],
            "priority_score": result["priority_score"],
            "expected_deal_value_eur": result["expected_deal_value_eur"],
            "segment": result["segment"],
            "machine": result["machine"],
            "explainable_json": result["explainable_json"],
        },
    )
    result["expected_margin_eur"] = ev["expected_margin_eur"]
    result["explainable_json"] = {
        **result["explainable_json"],
        **ev["explainable"],
    }

    # Freeze the exact feature set used for learning / outcome joins.
    snapshot_payload = {
        "frozen_at": datetime.now(UTC).isoformat(),
        "features": {
            name: meta
            for name, meta in features.items()
            if name != "crawl_pages"  # pages blob is large; keep meta only
        },
        "feature_names": sorted(features.keys()),
        "location_count": location_count,
        "distance_km": distance,
        "places_status": places.get("business_status"),
        "financial_available": financial.get("available"),
        "score_inputs": {
            "segment": result["segment"],
            "quality": result["quality_score"],
            "priority": result["priority_score"],
            "expected_margin_eur": result["expected_margin_eur"],
        },
    }
    if "crawl_pages" in features:
        snapshot_payload["features"]["crawl_pages"] = {
            "page_count": len(crawl_pages),
            "confidence": features["crawl_pages"].get("confidence"),
            "calculated_at": features["crawl_pages"].get("calculated_at"),
        }
    db.query(Feature).filter_by(
        establishment_id=est.id, feature_name="score_feature_snapshot"
    ).delete()
    db.add(
        Feature(
            organization_id=org.id,
            establishment_id=est.id,
            feature_name="score_feature_snapshot",
            value_json=snapshot_payload,
            confidence=1.0,
            model_version=settings.scorer_version,
        )
    )

    score = LeadScore(
        organization_id=org.id,
        establishment_id=est.id,
        segment=result["segment"],
        quality_score=result["quality_score"],
        confidence_score=result["confidence_score"],
        timing_score=result["timing_score"],
        priority_score=result["priority_score"],
        strategic_score=result["strategic_score"],
        expected_deal_value_eur=result["expected_deal_value_eur"],
        expected_margin_eur=result["expected_margin_eur"],
        tier=result["tier"],
        score_components_json=result["score_components_json"],
        explainable_json=result["explainable_json"],
        model_version=result["model_version"],
    )
    db.add(score)
    db.flush()
    rule_version = db.query(RuleVersion).filter_by(version=result["model_version"]).one_or_none()
    if not rule_version:
        rule_version = RuleVersion(
            version=result["model_version"],
            config_json=DEFAULT_RULE_CONFIG,
            config_checksum=hashlib.sha256(
                json.dumps(DEFAULT_RULE_CONFIG, sort_keys=True).encode()
            ).hexdigest(),
            status="candidate",
            created_by="scoring-service",
        )
        db.add(rule_version)
        db.flush()
    db.add(
        ScorerRun(
            rule_version_id=rule_version.id,
            establishment_id=est.id,
            score_json={
                "quality": result["quality_score"],
                "priority": result["priority_score"],
                "tier": result["tier"],
                "expected_margin_eur": result["expected_margin_eur"],
                "ev_source": ev["explainable"].get("ev_source"),
                "insufficient_data": ev["explainable"].get("insufficient_data"),
            },
            input_checksum=hashlib.sha256(
                json.dumps(snapshot_payload, sort_keys=True, default=str).encode()
            ).hexdigest(),
            authoritative=True,
        )
    )
    machine = result["machine"]
    db.add(
        MachineRecommendation(
            lead_score_id=score.id,
            primary_machine=machine["recommended_machine"],
            alternative_machines_json=machine["alternative_machines"],
            required_features_json=machine["required_features"],
            reasons_json=machine["reasons"],
            questions_json=machine["unresolved_questions"],
            confidence=machine["recommendation_confidence"],
        )
    )

    if result["tier"] == "rejected":
        est.review_status = "rejected"
    elif result["priority_score"] >= 75 or result["expected_margin_eur"] >= 400:
        est.review_status = "ready_for_review"
    elif result["tier"] == "needs_more_data":
        est.review_status = "needs_more_data"
    else:
        est.review_status = "scored"

    db.commit()
    return {
        "status": "scored",
        "priority": result["priority_score"],
        "expected_margin_eur": result["expected_margin_eur"],
        "tier": result["tier"],
        "lead_score_id": score.id,
        "snapshot": True,
    }
