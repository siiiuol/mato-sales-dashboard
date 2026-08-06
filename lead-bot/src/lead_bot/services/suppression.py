from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from lead_bot.models import Organization, Suppression


def is_suppressed(
    db: Session,
    *,
    enterprise_number: str | None = None,
    establishment_number: str | None = None,
    domain: str | None = None,
    telephone: str | None = None,
    email: str | None = None,
) -> Suppression | None:
    checks = []
    if enterprise_number:
        checks.append(Suppression.enterprise_number == enterprise_number)
    if establishment_number:
        checks.append(Suppression.establishment_number == establishment_number)
    if domain:
        checks.append(Suppression.domain == domain.strip().lower())
    if telephone:
        checks.append(Suppression.telephone == _norm_phone(telephone))
    if email:
        checks.append(Suppression.email == email.strip().lower())
    if not checks:
        return None
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return (
        db.query(Suppression)
        .filter(or_(*checks))
        .filter(or_(Suppression.permanent.is_(True), Suppression.expiry_date > now))
        .order_by(Suppression.permanent.desc(), Suppression.requested_date.desc())
        .first()
    )


def add_suppression(
    db: Session,
    reason: str,
    *,
    enterprise_number: str | None = None,
    establishment_number: str | None = None,
    domain: str | None = None,
    email: str | None = None,
    telephone: str | None = None,
    source: str = "manual",
    permanent: bool = True,
    notes: str | None = None,
) -> Suppression:
    s = Suppression(
        enterprise_number=enterprise_number,
        establishment_number=establishment_number,
        domain=domain.strip().lower() if domain else None,
        email=email.strip().lower() if email else None,
        telephone=_norm_phone(telephone) if telephone else None,
        reason=reason,
        source=source,
        permanent=permanent,
        notes=notes,
    )
    db.add(s)
    db.flush()
    return s


def exclude_natural_person_marketing(db: Session, enterprise_number: str) -> bool:
    org = db.query(Organization).filter_by(enterprise_number=enterprise_number).one_or_none()
    return bool(org and org.is_natural_person)


def _norm_phone(value: str) -> str:
    digits = "".join(c for c in value if c.isdigit())
    return digits[2:] if digits.startswith("00") else digits
