from __future__ import annotations

from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from lead_bot.config import get_settings
from lead_bot.models import EntityLink, Establishment, MatchCandidate, Organization


def match_score(
    *,
    name_a: str,
    name_b: str,
    address_a: str = "",
    address_b: str = "",
    domain_a: str | None = None,
    domain_b: str | None = None,
    phone_a: str | None = None,
    phone_b: str | None = None,
    same_postcode: bool = False,
    geo_close: bool = False,
    type_similar: bool = False,
) -> float:
    """Composite entity match 0–1 per MATO spec weights."""
    name_sim = fuzz.token_sort_ratio(name_a or "", name_b or "") / 100.0
    addr_sim = fuzz.token_sort_ratio(address_a or "", address_b or "") / 100.0
    domain_match = 1.0 if domain_a and domain_b and domain_a == domain_b else 0.0
    phone_match = (
        1.0
        if phone_a and phone_b and _digits(phone_a) == _digits(phone_b)
        else 0.0
    )
    geographic = 1.0 if geo_close or same_postcode else 0.0
    biz = 1.0 if type_similar else 0.0
    return (
        0.30 * name_sim
        + 0.25 * addr_sim
        + 0.15 * domain_match
        + 0.15 * phone_match
        + 0.10 * geographic
        + 0.05 * biz
    )


def decide_match(score: float) -> str:
    settings = get_settings()
    if score >= settings.entity_auto_match_threshold:
        return "auto"
    if score >= settings.entity_review_threshold:
        return "manual"
    return "separate"


def _digits(value: str) -> str:
    return "".join(c for c in value if c.isdigit())


def resolve_external_entity(
    db: Session,
    *,
    source_type: str,
    source_identifier: str,
    enterprise_number: str | None = None,
    establishment_number: str | None = None,
    name: str = "",
    address: str = "",
    domain: str | None = None,
    phone: str | None = None,
) -> EntityLink | MatchCandidate | None:
    """Persist exact-identifier links first, then scored fuzzy candidates."""
    existing = db.query(EntityLink).filter_by(
        source_type=source_type,
        source_identifier=source_identifier,
        target_type="establishment",
    ).one_or_none()
    if existing:
        return existing

    exact = None
    if establishment_number:
        exact = db.query(Establishment).filter_by(
            establishment_number=_digits(establishment_number)
        ).one_or_none()
    if not exact and enterprise_number:
        org = db.query(Organization).filter_by(
            enterprise_number=_digits(enterprise_number)
        ).one_or_none()
        if org and len(org.establishments) == 1:
            exact = org.establishments[0]
    if exact:
        link = EntityLink(
            source_type=source_type,
            source_identifier=source_identifier,
            target_type="establishment",
            target_id=exact.id,
            confidence=1.0,
        )
        db.add(link)
        db.flush()
        return link

    query = db.query(Establishment).join(Organization)
    postcode = next((part for part in address.split() if part.isdigit() and len(part) == 4), None)
    if postcode:
        query = query.filter(Establishment.postcode == postcode)
    best: tuple[float, Establishment] | None = None
    for est in query.limit(250).all():
        candidate_address = " ".join(
            x for x in (est.street, est.house_number, est.postcode, est.municipality) if x
        )
        score = match_score(
            name_a=name,
            name_b=est.name or est.organization.official_name,
            address_a=address,
            address_b=candidate_address,
            domain_a=domain,
            phone_a=phone,
            same_postcode=bool(postcode and postcode == est.postcode),
        )
        if best is None or score > best[0]:
            best = (score, est)
    if not best:
        return None
    score, est = best
    decision = decide_match(score)
    candidate = db.query(MatchCandidate).filter_by(
        source_type=source_type,
        source_identifier=source_identifier,
        target_type="establishment",
        target_id=est.id,
    ).one_or_none()
    if not candidate:
        candidate = MatchCandidate(
            source_type=source_type,
            source_identifier=source_identifier,
            target_type="establishment",
            target_id=est.id,
            match_method="fuzzy_name_address",
            score=score,
            decision=decision,
            evidence_json={"name": name, "address": address, "domain": domain, "phone": phone},
        )
        db.add(candidate)
        db.flush()
    if decision == "auto":
        link = EntityLink(
            source_type=source_type,
            source_identifier=source_identifier,
            target_type="establishment",
            target_id=est.id,
            match_candidate_id=candidate.id,
            confidence=score,
        )
        db.add(link)
        db.flush()
        return link
    return candidate
