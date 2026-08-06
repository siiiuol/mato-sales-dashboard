from __future__ import annotations

from lead_bot.providers.osm import (
    OverpassPlacesProvider,
    normalize_osm_element,
)
from lead_bot.providers.places import GooglePlacesProvider, get_places_provider


SAMPLE_NODE = {
    "type": "node",
    "id": 123456,
    "lat": 51.05,
    "lon": 3.72,
    "tags": {
        "name": "Bakkerij De Korst",
        "shop": "bakery",
        "phone": "+32 9 000 00 00",
        "website": "https://example.be",
        "addr:street": "Korenmarkt",
        "addr:housenumber": "1",
        "addr:postcode": "9000",
        "addr:city": "Gent",
        "opening_hours": "Mo-Fr 07:00-18:00; Sa 07:00-13:00; Su off",
    },
}


def test_normalize_osm_element_maps_shared_shape():
    place = normalize_osm_element(SAMPLE_NODE)
    assert place is not None
    assert place["id"] == "osm:node/123456"
    assert place["name"] == "Bakkerij De Korst"
    assert place["phone"] == "+32 9 000 00 00"
    assert place["website"] == "https://example.be"
    assert place["business_status"] == "OPERATIONAL"
    assert place["latitude"] == 51.05
    assert place["source"] == "openstreetmap"
    assert place["closed_evenings"] in {"yes", "no", "unknown"}


def test_normalize_marks_disused_closed():
    el = {
        "type": "node",
        "id": 9,
        "lat": 51.0,
        "lon": 3.7,
        "tags": {"name": "Closed Shop", "shop": "vacant", "disused": "yes"},
    }
    place = normalize_osm_element(el)
    assert place is not None
    assert place["business_status"] == "CLOSED_PERMANENTLY"


def test_get_places_provider_defaults_to_osm(monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    from lead_bot.config import get_settings

    get_settings.cache_clear()
    provider = get_places_provider()
    assert isinstance(provider, OverpassPlacesProvider)
    assert provider.available is True
    assert provider.provider_name == "openstreetmap"
    get_settings.cache_clear()


def test_get_places_provider_uses_google_when_keyed(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key-not-real")
    from lead_bot.config import get_settings

    get_settings.cache_clear()
    provider = get_places_provider()
    assert isinstance(provider, GooglePlacesProvider)
    assert provider.provider_name == "google_places"
    get_settings.cache_clear()
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)


def test_search_category_parses_mock_overpass():
    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"elements": [SAMPLE_NODE]}

    class FakeClient:
        def post(self, *args, **kwargs):
            return FakeResponse()

    provider = OverpassPlacesProvider(client=FakeClient())
    results = provider.search_category("bakkerij", region_bias="Oost-Vlaanderen", page_size=5)
    assert len(results) == 1
    assert results[0]["name"] == "Bakkerij De Korst"


def test_discovery_sweep_cost_zero_for_osm(db, monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    from lead_bot.config import get_settings
    from lead_bot.models import CostEvent
    from lead_bot.services.discovery import places_category_sweep

    get_settings.cache_clear()

    class FakeProvider:
        available = True
        provider_name = "openstreetmap"

        def search_category(self, query, region_bias="", page_size=8):
            return [normalize_osm_element(SAMPLE_NODE)]

    monkeypatch.setattr(
        "lead_bot.services.discovery.get_places_provider", lambda: FakeProvider()
    )
    monkeypatch.setattr(
        "lead_bot.services.discovery.resolve_external_entity", lambda *a, **k: None
    )
    result = places_category_sweep(
        db,
        queries=("bakkerij",),
        regions=("Oost-Vlaanderen België",),
        page_size=1,
        schedule=False,
    )
    assert result["available"] is True
    assert result["provider"] == "openstreetmap"
    assert result["found"] >= 1
    costs = db.query(CostEvent).filter_by(provider="openstreetmap").all()
    assert costs
    assert all(c.estimated_cost_eur == 0 for c in costs)
    get_settings.cache_clear()
