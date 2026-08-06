from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from lead_bot.config import Settings, get_settings
from lead_bot.engines.scoring import RuleLeadScoringEngine
from lead_bot.models import EntityLink, Establishment, Organization, Suppression
from lead_bot.providers.kbo import KboZipProvider
from lead_bot.services.entity_resolution import resolve_external_entity
from lead_bot.services.suppression import add_suppression, is_suppressed


def _org_est(db, number="0123456789", est_number="2123456799", name="Sample Bakery"):
    org = Organization(enterprise_number=number, official_name=name)
    db.add(org)
    db.flush()
    est = Establishment(
        organization_id=org.id,
        establishment_number=est_number,
        name=name,
        postcode="9000",
        municipality="Gent",
    )
    db.add(est)
    db.flush()
    return org, est


def test_suppression_is_indexed_normalized_and_transaction_safe(db):
    add_suppression(db, "do_not_contact", telephone="+32 9 123 45 67", email="INFO@EXAMPLE.BE")
    assert is_suppressed(db, telephone="0032 (9) 123-45-67") is not None
    assert is_suppressed(db, email="info@example.be") is not None
    db.rollback()
    assert db.query(Suppression).count() == 0


def test_production_rejects_default_key_and_open_cors(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("LEAD_BOT_API_KEY", "mato-dev-key")
    with pytest.raises(RuntimeError):
        Settings()
    monkeypatch.setenv("LEAD_BOT_API_KEY", "secure-production-key")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(RuntimeError):
        Settings()


def test_public_health_does_not_allow_unconfigured_origin():
    from lead_bot.api.main import app

    with TestClient(app) as client:
        response = client.get("/health", headers={"origin": "https://evil.example"})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_entity_resolution_exact_then_fuzzy(db):
    org, est = _org_est(db)
    exact = resolve_external_entity(
        db,
        source_type="places",
        source_identifier="place-1",
        establishment_number=est.establishment_number,
    )
    assert isinstance(exact, EntityLink)
    assert exact.confidence == 1.0
    fuzzy = resolve_external_entity(
        db,
        source_type="directory",
        source_identifier="directory-1",
        name="Sample Bakery",
        address="9000 Gent",
    )
    assert fuzzy is not None
    assert 0 <= fuzzy.confidence <= 1 if isinstance(fuzzy, EntityLink) else 0 <= fuzzy.score <= 1


def test_score_dimensions_remain_bounded_and_separate():
    result = RuleLeadScoringEngine().score(
        {
            "extraction": {
                "business_segment": "multi_location",
                "number_of_locations": 8,
                "prepackaged_products": "yes",
                "temperature_requirement": ["chilled"],
                "growth_signals": ["new shop"],
                "new_location_signals": ["opening"],
                "source_evidence": [{"confidence": 0.9}],
            },
            "has_website": True,
            "has_email": True,
            "has_phone": True,
        }
    )
    for key in (
        "quality_score",
        "confidence_score",
        "timing_score",
        "strategic_score",
        "priority_score",
    ):
        assert 0 <= result[key] <= 100
    assert result["expected_deal_value_eur"] > 0
    assert result["quality_score"] != result["priority_score"]


def test_social_discovery_finds_instagram_facebook_tiktok():
    from lead_bot.providers.social import SocialMediaDiscoveryProvider

    pages = [
        {
            "url": "https://bakery.example/contact",
            "text": "Volg ons op https://www.instagram.com/bakerygent en Facebook",
            "external_links": [
                "https://www.facebook.com/BakeryGent",
                "https://www.tiktok.com/@bakerygent",
                "https://www.instagram.com/bakerygent/reel/ABC123",
            ],
        }
    ]
    result = SocialMediaDiscoveryProvider().discover(pages=pages, company_name="Bakery Gent")
    assert result["platform_count"] >= 3
    assert result["has_instagram"]
    assert result["has_facebook"]
    assert result["has_tiktok"]
    platforms = {p["platform"] for p in result["profiles"]}
    assert {"instagram", "facebook", "tiktok"} <= platforms
    ig = next(p for p in result["profiles"] if p["platform"] == "instagram")
    assert "/reel/" not in ig["url"]


def test_social_presence_boosts_quality_and_timing():
    base = RuleLeadScoringEngine().score(
        {
            "extraction": {
                "business_segment": "product_owner",
                "prepackaged_products": "yes",
                "temperature_requirement": ["chilled"],
                "source_evidence": [{"confidence": 0.8}],
            },
            "has_website": True,
        }
    )
    boosted = RuleLeadScoringEngine().score(
        {
            "extraction": {
                "business_segment": "product_owner",
                "prepackaged_products": "yes",
                "temperature_requirement": ["chilled"],
                "source_evidence": [{"confidence": 0.8}],
                "social_profiles": [
                    {"platform": "instagram", "url": "https://www.instagram.com/x"},
                    {"platform": "tiktok", "url": "https://www.tiktok.com/@x"},
                ],
            },
            "has_website": True,
            "social": {
                "platform_count": 2,
                "has_instagram": True,
                "has_tiktok": True,
                "growth_signals": ["growth:nieuwe vestiging"],
                "profiles": [
                    {"platform": "instagram", "url": "https://www.instagram.com/x"},
                    {"platform": "tiktok", "url": "https://www.tiktok.com/@x"},
                ],
            },
        }
    )
    assert boosted["quality_score"] >= base["quality_score"]
    assert boosted["timing_score"] >= base["timing_score"]
    assert boosted["confidence_score"] >= base["confidence_score"]


def test_kbo_sample_idempotency_and_full_snapshot_semantics(db, tmp_path):
    root = tmp_path / "ingestion"
    first = root / "full-1"
    second = root / "full-2"
    first.mkdir(parents=True)
    second.mkdir(parents=True)
    sample = Path(__file__).parents[1] / "data" / "kbo" / "sample"
    for name in ("enterprise.csv", "establishment.csv", "activity.csv"):
        shutil.copy(sample / name, first / name)
    (second / "enterprise.csv").write_text(
        "EnterpriseNumber,Status,TypeOfEnterprise,Denomination,JuridicalForm\n"
        "0987654321,AC,2,Second Sample,BV\n",
        encoding="utf-8",
    )
    (second / "establishment.csv").write_text(
        "EstablishmentNumber,EnterpriseNumber,Status,Denomination,StreetNL,"
        "HouseNumber,Zipcode,MunicipalityNL\n"
        "2987654321,0987654321,AC,Second Site,Main Street,2,9000,Gent\n",
        encoding="utf-8",
    )
    (second / "activity.csv").write_text(
        "EstablishmentNumber,NaceCode,NaceVersion,Classification,Description\n"
        "2987654321,4724,2008,MAIN,Retail sale of bread\n",
        encoding="utf-8",
    )
    settings = get_settings()
    settings.ingestion_root = root.resolve()
    provider = KboZipProvider(db)
    first_result = provider.import_archive(str(first), "east_west_flanders", "full")
    repeat_result = provider.import_archive(str(first), "east_west_flanders", "full")
    assert first_result["establishment"] == 1
    assert repeat_result["status"] == "already_imported"
    provider.import_archive(str(second), "east_west_flanders", "full")
    old = db.query(Establishment).filter_by(establishment_number="2123456799").one()
    new = db.query(Establishment).filter_by(establishment_number="2987654321").one()
    assert old.status == "INACTIVE"
    assert new.status == "AC"
