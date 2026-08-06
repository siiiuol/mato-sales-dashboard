from __future__ import annotations

from typing import Any

import httpx

from lead_bot.config import get_settings
from lead_bot.providers.base import PlacesProvider
from lead_bot.providers.osm import OverpassPlacesProvider

# Local bakery / food retail style sweeps for East & West Flanders.
FLANDERS_CATEGORY_QUERIES = (
    "bakkerij",
    "broodjeszaak",
    "patisserie",
    "chocolaterie",
    "traiteur",
    "slagerij",
    "kaaswinkel",
)


def get_places_provider() -> PlacesProvider:
    """Google Places when keyed; otherwise free OpenStreetMap Overpass."""
    settings = get_settings()
    if settings.google_places_api_key:
        return GooglePlacesProvider(api_key=settings.google_places_api_key)
    return OverpassPlacesProvider()


def normalize_place(place: dict[str, Any]) -> dict[str, Any]:
    """Normalize Places API (New) payload into scoring-friendly fields."""
    display = place.get("displayName") or {}
    location = place.get("location") or {}
    hours = place.get("regularOpeningHours") or place.get("currentOpeningHours") or {}
    weekday = hours.get("weekdayDescriptions") or hours.get("weekday_text") or []
    closed_evenings, closed_days = _hours_gap_from_descriptions(weekday)
    status = place.get("businessStatus") or place.get("business_status")
    rating_count = place.get("userRatingCount") or place.get("user_ratings_total") or 0
    return {
        "id": place.get("id") or place.get("place_id"),
        "name": display.get("text") if isinstance(display, dict) else display,
        "formatted_address": place.get("formattedAddress") or place.get("formatted_address"),
        "website": place.get("websiteUri") or place.get("website"),
        "phone": place.get("internationalPhoneNumber")
        or place.get("nationalPhoneNumber")
        or place.get("formatted_phone_number"),
        "business_status": status,
        "rating": place.get("rating"),
        "rating_count": int(rating_count or 0),
        "userRatingCount": int(rating_count or 0),
        "opening_hours": {
            "weekday_descriptions": weekday,
            "closed_evenings": closed_evenings,
            "closed_days_per_week": closed_days,
        },
        "closed_evenings": closed_evenings,
        "closed_days_per_week": closed_days,
        "location": location,
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "raw": place,
    }


def _hours_gap_from_descriptions(descriptions: list[str]) -> tuple[str, int | None]:
    closed_days = 0
    evening_open = False
    evening_closed = False
    for line in descriptions:
        low = (line or "").lower()
        if "closed" in low or "gesloten" in low:
            # day fully closed
            if ":" not in low.split(" ", 1)[-1] or low.endswith("closed") or low.endswith("gesloten"):
                closed_days += 1
        if any(tok in low for tok in ("18:", "19:", "20:", "21:", "22:")):
            evening_open = True
        if any(tok in low for tok in ("17:00", "17:30", "16:00", "16:30")) and not evening_open:
            evening_closed = True
    if evening_open:
        closed_evenings = "no"
    elif evening_closed or closed_days:
        closed_evenings = "yes"
    else:
        closed_evenings = "unknown"
    return closed_evenings, closed_days or None


class StubPlacesProvider(PlacesProvider):
    def match_establishment(self, name: str, address: str):
        return None

    def search_category(self, query: str, region_bias: str = "Vlaanderen"):
        return []


class GooglePlacesProvider(PlacesProvider):
    """Google Places API (New) client. Optional paid override — never scrapes."""

    endpoint = "https://places.googleapis.com/v1/places:searchText"

    FIELD_MASK = (
        "places.id,places.displayName,places.formattedAddress,places.websiteUri,"
        "places.nationalPhoneNumber,places.internationalPhoneNumber,places.location,"
        "places.businessStatus,places.rating,places.userRatingCount,"
        "places.regularOpeningHours,places.currentOpeningHours"
    )

    def __init__(self, api_key: str | None = None, timeout: float = 15.0):
        self.api_key = api_key or get_settings().google_places_api_key
        self.timeout = timeout

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    @property
    def provider_name(self) -> str:
        return "google_places"

    def match_establishment(self, name: str, address: str) -> dict[str, Any] | None:
        places = self._search(f"{name} {address}", page_size=1)
        return places[0] if places else None

    def search_category(
        self, query: str, region_bias: str = "Oost-Vlaanderen België", page_size: int = 10
    ) -> list[dict[str, Any]]:
        return self._search(f"{query} {region_bias}", page_size=page_size)

    def _search(self, text_query: str, page_size: int = 5) -> list[dict[str, Any]]:
        if not self.api_key:
            return []
        response = httpx.post(
            self.endpoint,
            headers={
                "X-Goog-Api-Key": self.api_key,
                "X-Goog-FieldMask": self.FIELD_MASK,
                "Content-Type": "application/json",
            },
            json={
                "textQuery": text_query,
                "languageCode": "nl",
                "regionCode": "BE",
                "pageSize": page_size,
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        raw = response.json().get("places") or []
        return [normalize_place(p) for p in raw]
