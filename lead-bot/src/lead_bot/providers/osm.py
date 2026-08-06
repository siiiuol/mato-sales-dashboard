from __future__ import annotations

import re
import time
from typing import Any

import httpx

from lead_bot.providers.base import PlacesProvider

# Public Overpass endpoints — rotate on failure; be polite with rate limits.
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)

# Approximate south,west,north,east for Flanders territories.
REGION_BBOX: dict[str, tuple[float, float, float, float]] = {
    "Oost-Vlaanderen België": (50.70, 3.30, 51.45, 4.40),
    "Oost-Vlaanderen": (50.70, 3.30, 51.45, 4.40),
    "West-Vlaanderen België": (50.70, 2.50, 51.40, 3.55),
    "West-Vlaanderen": (50.70, 2.50, 51.40, 3.55),
    "Vlaanderen": (50.65, 2.50, 51.50, 5.90),
}

# Dutch/French CRM category labels → OSM shop/amenity tags.
CATEGORY_TAGS: dict[str, list[tuple[str, str]]] = {
    "bakkerij": [("shop", "bakery")],
    "bakery": [("shop", "bakery")],
    "broodjeszaak": [("shop", "bakery"), ("amenity", "fast_food")],
    "patisserie": [("shop", "pastry"), ("shop", "bakery")],
    "pastry": [("shop", "pastry")],
    "chocolaterie": [("shop", "chocolate"), ("shop", "confectionery")],
    "chocolatier": [("shop", "chocolate"), ("shop", "confectionery")],
    "chocolate": [("shop", "chocolate")],
    "traiteur": [("shop", "deli"), ("shop", "convenience")],
    "deli": [("shop", "deli")],
    "slagerij": [("shop", "butcher")],
    "butcher": [("shop", "butcher")],
    "kaaswinkel": [("shop", "cheese")],
    "cheese": [("shop", "cheese")],
    "florist": [("shop", "florist")],
    "bloemen": [("shop", "florist")],
    "hoevewinkel": [("shop", "farm"), ("shop", "convenience")],
    "farm shop": [("shop", "farm")],
}

_last_request_at = 0.0
_MIN_INTERVAL_S = 1.1


def normalize_osm_element(element: dict[str, Any]) -> dict[str, Any] | None:
    """Map an Overpass element into the shared places_match shape."""
    tags = element.get("tags") or {}
    name = tags.get("name") or tags.get("brand") or tags.get("operator")
    if not name:
        return None

    lat = element.get("lat")
    lon = element.get("lon")
    center = element.get("center") or {}
    if lat is None:
        lat = center.get("lat")
    if lon is None:
        lon = center.get("lon")

    street = tags.get("addr:street") or ""
    housenumber = tags.get("addr:housenumber") or ""
    postcode = tags.get("addr:postcode") or ""
    city = tags.get("addr:city") or tags.get("addr:municipality") or ""
    address = " ".join(
        part for part in (f"{street} {housenumber}".strip(), postcode, city) if part
    ).strip()

    phone = tags.get("phone") or tags.get("contact:phone") or tags.get("telephone")
    website = (
        tags.get("website")
        or tags.get("contact:website")
        or tags.get("url")
        or tags.get("contact:facebook")
    )
    if website and not website.startswith("http"):
        website = "https://" + website

    hours_raw = tags.get("opening_hours") or ""
    closed_evenings, closed_days = _hours_gap_from_osm(hours_raw)

    disused = any(
        tags.get(k) in {"yes", "disused", "abandoned"}
        for k in ("disused", "abandoned", "derelict")
    ) or tags.get("shop") in {"vacant", "closed"}
    status = "CLOSED_PERMANENTLY" if disused else "OPERATIONAL"

    osm_type = element.get("type", "node")
    osm_id = element.get("id")
    place_id = f"osm:{osm_type}/{osm_id}"

    return {
        "id": place_id,
        "name": name,
        "formatted_address": address or None,
        "website": website,
        "phone": phone,
        "business_status": status,
        "rating": None,
        "rating_count": 0,
        "userRatingCount": 0,
        "opening_hours": {
            "weekday_descriptions": [hours_raw] if hours_raw else [],
            "closed_evenings": closed_evenings,
            "closed_days_per_week": closed_days,
            "raw": hours_raw or None,
        },
        "closed_evenings": closed_evenings,
        "closed_days_per_week": closed_days,
        "location": {"latitude": lat, "longitude": lon},
        "latitude": lat,
        "longitude": lon,
        "source": "openstreetmap",
        "raw": element,
    }


def _hours_gap_from_osm(hours: str) -> tuple[str, int | None]:
    if not hours:
        return "unknown", None
    low = hours.lower()
    # OSM often uses 24/7 or ranges like Mo-Fr 08:00-18:00
    if "24/7" in low:
        return "no", 0
    evening_open = bool(re.search(r"(1[89]|2[0-2]):\d{2}", hours))
    closes_early = bool(re.search(r"(16|17):\d{2}", hours)) and not evening_open
    closed_days = 0
    for day in ("mo", "tu", "we", "th", "fr", "sa", "su"):
        # "Su off" pattern
        if re.search(rf"{day}\s+off", low):
            closed_days += 1
    if evening_open:
        return "no", closed_days or None
    if closes_early or closed_days:
        return "yes", closed_days or None
    return "unknown", closed_days or None


def _category_tags(query: str) -> list[tuple[str, str]]:
    key = (query or "").strip().lower()
    if key in CATEGORY_TAGS:
        return CATEGORY_TAGS[key]
    # fuzzy: first matching key contained in query
    for label, tags in CATEGORY_TAGS.items():
        if label in key or key in label:
            return tags
    return [("shop", "bakery")]


def _bbox_for_region(region_bias: str) -> tuple[float, float, float, float]:
    for key, bbox in REGION_BBOX.items():
        if key.lower() in (region_bias or "").lower() or (region_bias or "").lower() in key.lower():
            return bbox
    return REGION_BBOX["Vlaanderen"]


class OverpassPlacesProvider(PlacesProvider):
    """Free OpenStreetMap Overpass client — default Places replacement."""

    def __init__(
        self,
        endpoints: tuple[str, ...] | None = None,
        timeout: float = 45.0,
        client: httpx.Client | None = None,
    ):
        self.endpoints = endpoints or OVERPASS_ENDPOINTS
        self.timeout = timeout
        self._client = client

    @property
    def available(self) -> bool:
        return True

    @property
    def provider_name(self) -> str:
        return "openstreetmap"

    def match_establishment(self, name: str, address: str) -> dict[str, Any] | None:
        if not (name or "").strip():
            return None
        postcode = next(
            (p for p in (address or "").split() if p.isdigit() and len(p) == 4),
            None,
        )
        # Prefer postcode filter when available; else Flanders-wide name search.
        if postcode:
            query = f"""
            [out:json][timeout:25];
            (
              nwr["name"~{self._regex_literal(name)},i]["addr:postcode"="{postcode}"];
              nwr["brand"~{self._regex_literal(name)},i]["addr:postcode"="{postcode}"];
            );
            out center 5;
            """
        else:
            south, west, north, east = REGION_BBOX["Vlaanderen"]
            query = f"""
            [out:json][timeout:25];
            (
              nwr["name"~{self._regex_literal(name)},i]({south},{west},{north},{east});
            );
            out center 5;
            """
        results = self._query(query)
        return results[0] if results else None

    def search_category(
        self,
        query: str,
        region_bias: str = "Oost-Vlaanderen België",
        page_size: int = 10,
    ) -> list[dict[str, Any]]:
        tags = _category_tags(query)
        south, west, north, east = _bbox_for_region(region_bias)
        union_parts = []
        for key, value in tags:
            union_parts.append(
                f'  nwr["{key}"="{value}"]({south},{west},{north},{east});'
            )
        ql = f"""
        [out:json][timeout:40];
        (
        {chr(10).join(union_parts)}
        );
        out center {max(1, min(page_size, 40))};
        """
        return self._query(ql)[:page_size]

    def search_bbox(
        self,
        tags: list[tuple[str, str]],
        bbox: tuple[float, float, float, float],
        page_size: int = 25,
    ) -> list[dict[str, Any]]:
        south, west, north, east = bbox
        union_parts = [
            f'  nwr["{key}"="{value}"]({south},{west},{north},{east});'
            for key, value in tags
        ]
        ql = f"""
        [out:json][timeout:40];
        (
        {chr(10).join(union_parts)}
        );
        out center {max(1, min(page_size, 50))};
        """
        return self._query(ql)[:page_size]

    @staticmethod
    def _regex_literal(value: str) -> str:
        # Overpass regex in double quotes — escape specials lightly.
        escaped = re.escape((value or "").strip()[:80]).replace('"', "")
        return f'"{escaped}"'

    def _query(self, ql: str) -> list[dict[str, Any]]:
        global _last_request_at
        now = time.monotonic()
        wait = _MIN_INTERVAL_S - (now - _last_request_at)
        if wait > 0:
            time.sleep(wait)

        last_error: Exception | None = None
        for endpoint in self.endpoints:
            try:
                if self._client:
                    response = self._client.post(
                        endpoint, data={"data": ql}, timeout=self.timeout
                    )
                else:
                    response = httpx.post(
                        endpoint, data={"data": ql}, timeout=self.timeout
                    )
                _last_request_at = time.monotonic()
                if response.status_code in {429, 504, 502}:
                    last_error = RuntimeError(f"Overpass {response.status_code}")
                    time.sleep(2.0)
                    continue
                response.raise_for_status()
                elements = response.json().get("elements") or []
                out: list[dict[str, Any]] = []
                seen: set[str] = set()
                for el in elements:
                    normalized = normalize_osm_element(el)
                    if not normalized:
                        continue
                    pid = normalized["id"]
                    if pid in seen:
                        continue
                    seen.add(pid)
                    out.append(normalized)
                return out
            except Exception as exc:  # noqa: BLE001 — try next mirror
                last_error = exc
                continue
        if last_error:
            raise last_error
        return []
