from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from lead_bot.config import get_settings
from lead_bot.models import (
    Contact,
    CostEvent,
    Establishment,
    Evidence,
    Feature,
    Organization,
    Website,
)
from lead_bot.providers.crawler import HttpxWebsiteCrawler
from lead_bot.providers.geo import nearby_density, persist_postgis_point
from lead_bot.providers.llm import OpenAICompatibleExtractor
from lead_bot.providers.nbb import get_nbb_provider
from lead_bot.providers.places import get_places_provider
from lead_bot.providers.social import SocialMediaDiscoveryProvider
from lead_bot.services.entity_resolution import resolve_external_entity
from lead_bot.services.suppression import add_suppression, is_suppressed
from lead_bot.services.timing import extract_job_news_timing, extract_timing_signals


def suppress_stage(db: Session, establishment_id: int) -> dict:
    est, org = _entities(db, establishment_id)
    match = is_suppressed(
        db,
        enterprise_number=org.enterprise_number,
        establishment_number=est.establishment_number,
    )
    if match:
        est.review_status = "rejected" if match.permanent else "suppressed_temporary"
    elif org.is_natural_person:
        est.review_status = "quarantined_np"
    return {"suppressed": bool(match), "reason": match.reason if match else None}


def resolve_stage(db: Session, establishment_id: int) -> dict:
    est, org = _entities(db, establishment_id)
    if _blocked(est):
        return {"skipped": True, "reason": est.review_status}
    link = resolve_external_entity(
        db,
        source_type="kbo",
        source_identifier=est.establishment_number,
        enterprise_number=org.enterprise_number,
        establishment_number=est.establishment_number,
        name=est.name or org.official_name,
        address=_address(est),
    )
    return {"resolved": bool(link), "record_type": type(link).__name__ if link else None}


def discover_website_stage(db: Session, establishment_id: int) -> dict:
    est, org = _entities(db, establishment_id)
    if _blocked(est):
        return {"skipped": True, "reason": est.review_status}
    existing = (
        db.query(Website)
        .filter((Website.establishment_id == est.id) | (Website.organization_id == org.id))
        .order_by(Website.is_official.desc(), Website.match_confidence.desc())
        .first()
    )
    if existing:
        return {"url": existing.url, "source": existing.source, "cached": True}
    kbo = (
        db.query(Contact)
        .filter(
            Contact.organization_id == org.id,
            Contact.contact_type == "website",
            Contact.status == "active",
        )
        .first()
    )
    if kbo:
        website = _store_website(db, org.id, est.id, kbo.contact_value, "kbo", 1.0)
        return {"url": website.url, "source": "kbo", "cached": False}
    provider = get_places_provider()
    place = provider.match_establishment(est.name or org.official_name, _address(est))
    provider_name = getattr(provider, "provider_name", "places")
    cost = (
        get_settings().google_places_cost_eur
        if provider_name == "google_places" and getattr(provider, "available", False)
        else 0.0
    )
    _cost(
        db,
        est.id,
        provider_name,
        "match_establishment",
        cost,
        {"available": getattr(provider, "available", True), "source": provider_name},
        days=30,
    )
    if not place:
        return {
            "url": None,
            "source": "places_unavailable" if not getattr(provider, "available", True) else provider_name,
        }
    if place.get("business_status") in {"CLOSED_PERMANENTLY", "permanently_closed"}:
        est.review_status = "rejected"
        _replace_feature(db, org.id, est.id, "places_match", place, 0.95, hours=24 * 30)
        add_suppression(
            db,
            "business_closed",
            enterprise_number=org.enterprise_number,
            establishment_number=est.establishment_number,
            source=provider_name,
            permanent=True,
            notes="business_status=CLOSED_PERMANENTLY",
        )
        return {"url": None, "source": provider_name, "rejected": "business_closed"}
    _replace_feature(db, org.id, est.id, "places_match", place, 0.9, hours=24 * 30)
    website_url = place.get("website") or place.get("websiteUri")
    phone = place.get("phone") or place.get("internationalPhoneNumber") or place.get(
        "nationalPhoneNumber"
    )
    resolve_external_entity(
        db,
        source_type=provider_name,
        source_identifier=str(place.get("id") or ""),
        name=place.get("name")
        or ((place.get("displayName") or {}).get("text") if isinstance(place.get("displayName"), dict) else ""),
        address=place.get("formatted_address") or place.get("formattedAddress") or "",
        domain=urlparse(website_url or "").netloc,
        phone=phone,
    )
    lat = place.get("latitude")
    lng = place.get("longitude")
    location = place.get("location") or {}
    if lat is None:
        lat = location.get("latitude")
    if lng is None:
        lng = location.get("longitude")
    if lat is not None and lng is not None:
        est.latitude, est.longitude = lat, lng
        est.geo_source = provider_name
        est.geo_updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        persist_postgis_point(db, est.id, est.latitude, est.longitude)
    if phone:
        exists = (
            db.query(Contact)
            .filter_by(organization_id=org.id, contact_type="phone", contact_value=phone)
            .one_or_none()
        )
        if not exists:
            db.add(
                Contact(
                    organization_id=org.id,
                    establishment_id=est.id,
                    contact_type="phone",
                    contact_value=phone,
                    generic_business_contact=True,
                    source_url=provider_name,
                    verification_state="source_verified",
                    status="active",
                )
            )
    if website_url:
        website = _store_website(db, org.id, est.id, website_url, provider_name, 0.9)
        return {"url": website.url, "source": provider_name, "cached": False}
    return {"url": None, "source": provider_name}


def crawl_stage(db: Session, establishment_id: int) -> dict:
    est, org = _entities(db, establishment_id)
    if _blocked(est):
        return {"skipped": True, "reason": est.review_status}
    website = (
        db.query(Website)
        .filter((Website.establishment_id == est.id) | (Website.organization_id == org.id))
        .order_by(Website.match_confidence.desc())
        .first()
    )
    if not website:
        return {"pages": 0, "status": "no_website"}
    pages = HttpxWebsiteCrawler().crawl(website.url)
    website.last_crawled_at = datetime.now(timezone.utc).replace(tzinfo=None)
    website.crawl_status = "done" if pages else "empty"
    _replace_feature(db, org.id, est.id, "crawl_pages", {"pages": pages}, 0.9, hours=24 * 7)
    _cost(db, est.id, "crawler", "crawl", 0, {"pages": len(pages)}, days=7, units=len(pages))
    return {"pages": len(pages), "status": website.crawl_status}


def extract_stage(db: Session, establishment_id: int) -> dict:
    est, org = _entities(db, establishment_id)
    if _blocked(est):
        return {"skipped": True, "reason": est.review_status}
    feature = _latest_feature(db, est.id, "crawl_pages")
    pages = ((feature.value_json if feature else {}) or {}).get("pages") or []
    extraction = OpenAICompatibleExtractor().extract(pages, org.official_name)
    _replace_feature(
        db, org.id, est.id, "website_extraction", extraction, 0.7, hours=24 * 30
    )
    settings = get_settings()
    _cost(
        db,
        est.id,
        "llm",
        "extract",
        0.02 if settings.openai_api_key else 0,
        {"model": (extraction.get("_meta") or {}).get("model")},
        days=30,
    )
    return {"evidence": len(extraction.get("source_evidence") or [])}


def social_stage(db: Session, establishment_id: int) -> dict:
    est, org = _entities(db, establishment_id)
    if _blocked(est):
        return {"skipped": True, "reason": est.review_status}
    feature = _latest_feature(db, est.id, "crawl_pages")
    pages = ((feature.value_json if feature else {}) or {}).get("pages") or []
    known = [
        c.contact_value
        for c in db.query(Contact)
        .filter(
            Contact.organization_id == org.id,
            Contact.contact_type.in_(
                ["website", "instagram", "facebook", "tiktok", "linkedin", "youtube", "x"]
            ),
            Contact.status == "active",
        )
        .all()
    ]
    discovery = SocialMediaDiscoveryProvider().discover(
        pages=pages,
        company_name=est.name or org.official_name,
        known_urls=known,
        soft_verify=True,
    )
    for profile in discovery.get("profiles") or []:
        exists = (
            db.query(Contact)
            .filter_by(
                organization_id=org.id,
                contact_type=profile["platform"],
                contact_value=profile["url"],
            )
            .one_or_none()
        )
        if exists:
            continue
        db.add(
            Contact(
                organization_id=org.id,
                establishment_id=est.id,
                contact_type=profile["platform"],
                contact_value=profile["url"],
                generic_business_contact=True,
                source_url=profile.get("source"),
                verification_state="source_verified",
                verification_provider="social_discovery",
                status="active",
            )
        )
    for item in discovery.get("source_evidence") or []:
        db.add(
            Evidence(
                organization_id=org.id,
                establishment_id=est.id,
                feature_name=str(item.get("field") or "social_profile"),
                feature_value=str(item.get("value")),
                source_type="social",
                source_url=item.get("source_url"),
                source_text=item.get("source_text"),
                source_reliability=0.8,
                extraction_confidence=float(item.get("confidence") or 0.7),
            )
        )
    _replace_feature(db, org.id, est.id, "social_profiles", discovery, 0.8, hours=24 * 14)
    _cost(
        db,
        est.id,
        "social",
        "discover",
        0,
        {"platforms": discovery.get("platforms") or [], "count": discovery.get("platform_count", 0)},
        days=14,
        units=max(1, discovery.get("platform_count", 0)),
    )
    return {
        "platforms": discovery.get("platforms") or [],
        "platform_count": discovery.get("platform_count", 0),
    }


def geo_stage(db: Session, establishment_id: int) -> dict:
    est, org = _entities(db, establishment_id)
    if _blocked(est):
        return {"skipped": True, "reason": est.review_status}
    if est.latitude is not None and est.longitude is not None:
        persist_postgis_point(db, est.id, est.latitude, est.longitude)
        ctx = nearby_density(db, est.latitude, est.longitude, est.postcode)
        _replace_feature(db, org.id, est.id, "geo_context", ctx, 0.75, hours=24 * 30)
        return {"available": True, "lat": est.latitude, "lng": est.longitude, **ctx}
    return {"available": False, "reason": "No coordinates from configured provider"}


def finance_stage(db: Session, establishment_id: int) -> dict:
    est, org = _entities(db, establishment_id)
    if _blocked(est):
        return {"skipped": True, "reason": est.review_status}
    profile = get_nbb_provider().financial_profile(org.enterprise_number)
    _replace_feature(db, org.id, est.id, "financial_profile", profile, profile["confidence"], hours=24 * 90)
    _cost(db, est.id, "nbb", "financial_profile", 0, {"available": profile["available"]}, days=90)
    return profile


def timing_stage(db: Session, establishment_id: int) -> dict:
    est, org = _entities(db, establishment_id)
    if _blocked(est):
        return {"skipped": True, "reason": est.review_status}
    extraction = _latest_feature(db, est.id, "website_extraction")
    social = _latest_feature(db, est.id, "social_profiles")
    crawl = _latest_feature(db, est.id, "crawl_pages")
    pages = ((crawl.value_json if crawl else {}) or {}).get("pages") or []
    payload = dict(extraction.value_json if extraction else {})
    if social and social.value_json:
        payload["social_profiles"] = social.value_json.get("profiles") or []
        growth = list(payload.get("growth_signals") or [])
        growth.extend(social.value_json.get("growth_signals") or [])
        payload["growth_signals"] = list(dict.fromkeys(growth))
        staff = list(payload.get("staff_shortage_signals") or [])
        staff.extend(social.value_json.get("hiring_signals") or [])
        payload["staff_shortage_signals"] = list(dict.fromkeys(staff))
    timing = extract_timing_signals(payload)
    job_news = extract_job_news_timing(pages)
    if job_news.get("signals"):
        merged = list(timing.get("signals") or [])
        seen = {s.get("type") for s in merged}
        for signal in job_news["signals"]:
            if signal.get("type") not in seen:
                merged.append(signal)
        timing["signals"] = merged
        timing["score"] = max(
            float(timing.get("score") or 40),
            float(job_news.get("score") or 40),
        )
        timing["job_news"] = {
            "adapter": job_news.get("adapter"),
            "evidence_count": len(job_news.get("source_evidence") or []),
        }
        for item in job_news.get("source_evidence") or []:
            db.add(
                Evidence(
                    organization_id=org.id,
                    establishment_id=est.id,
                    feature_name=str(item.get("field") or "timing"),
                    feature_value=str(item.get("value")),
                    source_type="public_page",
                    source_url=item.get("source_url"),
                    source_text=item.get("source_text"),
                    source_reliability=0.7,
                    extraction_confidence=float(item.get("confidence") or 0.6),
                )
            )
    _replace_feature(db, org.id, est.id, "timing_signals", timing, 0.7, hours=24 * 14)
    return timing


def review_stage(db: Session, establishment_id: int) -> dict:
    est, _ = _entities(db, establishment_id)
    if est.review_status not in {"rejected", "quarantined_np", "duplicate"}:
        est.review_status = "ready_for_review"
    return {"review_status": est.review_status, "human_approval_required": True}


def _entities(db: Session, establishment_id: int):
    est = db.query(Establishment).filter_by(id=establishment_id).one()
    return est, db.query(Organization).filter_by(id=est.organization_id).one()


def _blocked(est: Establishment) -> bool:
    return est.review_status in {"rejected", "quarantined_np", "duplicate"}


def _address(est: Establishment) -> str:
    return " ".join(
        x for x in (est.street, est.house_number, est.postcode, est.municipality) if x
    )


def _store_website(db, org_id, est_id, url, source, confidence):
    normalized = url if url.startswith(("http://", "https://")) else f"https://{url}"
    website = Website(
        organization_id=org_id,
        establishment_id=est_id,
        domain=urlparse(normalized).netloc.lower(),
        url=normalized,
        source=source,
        match_confidence=confidence,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30),
    )
    db.add(website)
    db.flush()
    return website


def _latest_feature(db, est_id, name):
    return (
        db.query(Feature)
        .filter_by(establishment_id=est_id, feature_name=name)
        .order_by(Feature.calculated_at.desc())
        .first()
    )


def _replace_feature(db, org_id, est_id, name, value, confidence, hours):
    db.query(Feature).filter_by(establishment_id=est_id, feature_name=name).delete()
    db.add(
        Feature(
            organization_id=org_id,
            establishment_id=est_id,
            feature_name=name,
            value_json=value,
            confidence=confidence,
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=hours),
        )
    )


def _cost(db, est_id, provider, operation, cost, meta, days, units=1):
    db.add(
        CostEvent(
            establishment_id=est_id,
            provider=provider,
            operation=operation,
            units=units,
            estimated_cost_eur=cost,
            meta_json=meta,
            data_fresh_until=datetime.now(timezone.utc).replace(tzinfo=None)
            + timedelta(days=days),
        )
    )
