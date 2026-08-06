from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from lead_bot.config import get_settings
from lead_bot.models import CostEvent, Establishment, Feature, Organization, Suppression
from lead_bot.providers.places import FLANDERS_CATEGORY_QUERIES, get_places_provider
from lead_bot.services.entity_resolution import resolve_external_entity
from lead_bot.services.suppression import is_suppressed


TERRITORY_REGIONS = (
    "Oost-Vlaanderen België",
    "West-Vlaanderen België",
)


def places_category_sweep(
    db: Session,
    *,
    queries: tuple[str, ...] | None = None,
    regions: tuple[str, ...] | None = None,
    page_size: int = 8,
    limit_per_query: int | None = None,
    schedule: bool = True,
) -> dict[str, Any]:
    """Discover bakery/local segment candidates via OSM (or Google if keyed)."""
    provider = get_places_provider()
    settings = get_settings()
    provider_name = getattr(provider, "provider_name", "places")
    queries = queries or FLANDERS_CATEGORY_QUERIES
    regions = regions or TERRITORY_REGIONS
    page_size = limit_per_query or page_size
    found = 0
    matched = 0
    closed = 0
    scheduled_ids: list[int] = []
    candidates: list[dict[str, Any]] = []

    if not getattr(provider, "available", True):
        return {
            "available": False,
            "found": 0,
            "matched": 0,
            "closed": 0,
            "scheduled": [],
            "note": f"{provider_name} unavailable",
        }

    for region in regions:
        for query in queries:
            places = provider.search_category(query, region_bias=region, page_size=page_size)
            unit_cost = (
                settings.google_places_cost_eur if provider_name == "google_places" else 0.0
            )
            db.add(
                CostEvent(
                    establishment_id=None,
                    provider=provider_name,
                    operation="category_sweep",
                    estimated_cost_eur=unit_cost * max(1, len(places)),
                    meta_json={
                        "query": query,
                        "region": region,
                        "count": len(places),
                        "source": provider_name,
                    },
                )
            )
            for place in places:
                found += 1
                status = place.get("business_status")
                if status in {"CLOSED_PERMANENTLY", "permanently_closed"}:
                    closed += 1
                    continue
                place_id = str(place.get("id") or "")
                if not place_id:
                    continue
                website = place.get("website") or place.get("websiteUri")
                phone = place.get("phone")
                link_or_candidate = resolve_external_entity(
                    db,
                    source_type=f"{provider_name}_sweep",
                    source_identifier=place_id,
                    name=place.get("name") or "",
                    address=place.get("formatted_address") or "",
                    domain=urlparse(website or "").netloc or None,
                    phone=phone,
                )
                est_id = _establishment_id_from_resolution(link_or_candidate)
                if not est_id:
                    candidates.append(
                        {
                            "place_id": place_id,
                            "name": place.get("name"),
                            "query": query,
                            "region": region,
                            "status": "unresolved",
                        }
                    )
                    continue
                est = db.query(Establishment).filter_by(id=est_id).one_or_none()
                if not est:
                    continue
                org = db.query(Organization).filter_by(id=est.organization_id).one()
                if is_suppressed(
                    db,
                    enterprise_number=org.enterprise_number,
                    establishment_number=est.establishment_number,
                    telephone=phone,
                    domain=urlparse(website or "").netloc or None,
                ):
                    continue
                matched += 1
                _replace_places_feature(db, org.id, est.id, place)
                if schedule and est.review_status not in {
                    "ready_for_review",
                    "approved",
                    "rejected",
                    "quarantined_np",
                }:
                    scheduled_ids.append(est.id)

    db.commit()
    if schedule and scheduled_ids:
        from lead_bot.jobs.tasks import task_schedule_pipeline

        for est_id in dict.fromkeys(scheduled_ids):
            task_schedule_pipeline.delay(est_id)

    return {
        "available": True,
        "provider": provider_name,
        "found": found,
        "matched": matched,
        "closed": closed,
        "scheduled": list(dict.fromkeys(scheduled_ids)),
        "unresolved_sample": candidates[:20],
    }


def expand_from_customers(db: Session, *, limit: int = 40, schedule: bool = True) -> dict[str, Any]:
    """Second-machine leads from installed base: sibling sites of existing customers.

    Never invents net-new spam — only establishments already in the KBO graph under
    the same enterprise that is marked existing_customer.
    """
    customer_ents = (
        db.query(Suppression.enterprise_number)
        .filter(
            Suppression.reason == "existing_customer",
            Suppression.enterprise_number.isnot(None),
        )
        .distinct()
        .limit(200)
        .all()
    )
    enterprise_numbers = [row[0] for row in customer_ents if row[0]]
    expanded: list[int] = []
    skipped = 0

    for enterprise_number in enterprise_numbers:
        if len(expanded) >= limit:
            break
        org = (
            db.query(Organization)
            .filter_by(enterprise_number=enterprise_number)
            .one_or_none()
        )
        if not org:
            continue
        sites = (
            db.query(Establishment)
            .filter_by(organization_id=org.id, status="AC")
            .all()
        )
        if len(sites) < 2:
            skipped += 1
            continue
        for est in sites:
            if len(expanded) >= limit:
                break
            blocked = is_suppressed(
                db,
                enterprise_number=org.enterprise_number,
                establishment_number=est.establishment_number,
            )
            # Enterprise-level existing_customer is OK for expansion; permanent DNC/closed is not.
            if blocked and blocked.permanent and blocked.reason in {
                "do_not_contact",
                "legal_restriction",
                "business_closed",
                "manual_block",
            }:
                continue
            if est.review_status in {"rejected", "quarantined_np", "duplicate"}:
                continue
            # Tag as expansion so scoring can boost slightly.
            db.query(Feature).filter_by(
                establishment_id=est.id, feature_name="expansion_context"
            ).delete()
            db.add(
                Feature(
                    organization_id=org.id,
                    establishment_id=est.id,
                    feature_name="expansion_context",
                    value_json={
                        "source": "customer_expansion",
                        "enterprise_number": enterprise_number,
                        "second_machine": True,
                    },
                    confidence=0.9,
                    model_version="discovery-v1",
                )
            )
            if est.review_status not in {"ready_for_review", "approved"}:
                est.segment_hint = est.segment_hint or "multi_location"
                expanded.append(est.id)

    db.commit()
    if schedule and expanded:
        from lead_bot.jobs.tasks import task_schedule_pipeline

        for est_id in dict.fromkeys(expanded):
            task_schedule_pipeline.delay(est_id)

    return {
        "customer_enterprises": len(enterprise_numbers),
        "expanded": list(dict.fromkeys(expanded)),
        "skipped_single_site": skipped,
    }


def _establishment_id_from_resolution(result: Any) -> int | None:
    if result is None:
        return None
    if hasattr(result, "target_id") and getattr(result, "target_type", None) == "establishment":
        return int(result.target_id)
    return None


def _replace_places_feature(db: Session, org_id: int, est_id: int, place: dict) -> None:
    db.query(Feature).filter_by(establishment_id=est_id, feature_name="places_match").delete()
    db.add(
        Feature(
            organization_id=org_id,
            establishment_id=est_id,
            feature_name="places_match",
            value_json=place,
            confidence=0.85,
            model_version="places-sweep-v1",
        )
    )
