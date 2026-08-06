from __future__ import annotations

import math

from sqlalchemy import text
from sqlalchemy.orm import Session

from lead_bot.config import get_settings
from lead_bot.providers.base import GeographicContextProvider


class HaversineGeoProvider(GeographicContextProvider):
    def distance_km(self, lat: float, lng: float) -> float:
        settings = get_settings()
        return haversine_km(settings.mato_lat, settings.mato_lng, lat, lng)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearby_density(
    db: Session,
    lat: float,
    lng: float,
    postcode: str | None = None,
    radius_km: float = 3.0,
) -> dict:
    """Cheap demand/competition proxy from nearby establishments in the graph."""
    from lead_bot.models import Establishment

    rows = (
        db.query(Establishment)
        .filter(
            Establishment.latitude.isnot(None),
            Establishment.longitude.isnot(None),
            Establishment.status == "AC",
        )
        .limit(2500)
        .all()
    )
    nearby = 0
    same_postcode = 0
    for row in rows:
        if row.latitude is None or row.longitude is None:
            continue
        d = haversine_km(lat, lng, row.latitude, row.longitude)
        if d <= radius_km:
            nearby += 1
        if postcode and row.postcode == postcode:
            same_postcode += 1
    # Scale proxies into the 1–4 band used by scoring components.
    demand = max(1.0, min(4.0, 1.0 + math.log1p(nearby) * 0.7))
    competition = max(1.0, min(4.0, 4.0 - math.log1p(nearby) * 0.45))
    return {
        "nearby_establishments": nearby,
        "nearby_count": nearby,
        "same_postcode_active": same_postcode,
        "same_postcode_count": same_postcode,
        "demand_proxy": round(demand, 2),
        "competition_proxy": round(competition, 2),
        "radius_km": radius_km,
    }


def persist_postgis_point(db: Session, establishment_id: int, lat: float, lng: float) -> None:
    """Maintain the production geometry column while SQLite uses lat/lng."""
    if db.bind and db.bind.dialect.name == "postgresql":
        db.execute(
            text(
                "UPDATE establishments "
                "SET location = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) "
                "WHERE id = :id"
            ),
            {"id": establishment_id, "lat": lat, "lng": lng},
        )
