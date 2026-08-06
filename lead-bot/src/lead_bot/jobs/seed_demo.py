from __future__ import annotations


from lead_bot.db import SessionLocal, init_db, session_scope
from lead_bot.engines.scoring import RuleLeadScoringEngine
from lead_bot.models import (
    Activity,
    Contact,
    Evidence,
    Establishment,
    Feature,
    LeadScore,
    MachineRecommendation,
    Organization,
    Website,
)
from lead_bot.providers.llm import HeuristicExtractor
from lead_bot.services.config_loader import load_nace_segments
from lead_bot.services.preliminary import category_label_for, compute_preliminary


FIXTURES = [
    {
        "enterprise": "0123456789",
        "establishment": "2123456789",
        "name": "Bakkerij De Korst",
        "legal": "BV",
        "street": "Kerkstraat",
        "house": "12",
        "postcode": "9000",
        "municipality": "Gent",
        "lat": 51.0543,
        "lng": 3.7174,
        "nace": "4724",
        "website": "https://example.com/bakkerij-korst",
        "phone": "+32 9 555 0101",
        "email": "info@bakkerij-korst-demo.be",
        "segment": "product_owner",
        "page_text": (
            "Bakkerij De Korst verkoopt vers brood en verpakte patisserie. "
            "Takeaway afhaal. Maandag gesloten. Koelverse taarten. "
            "Nieuwe vestiging geopend. Webshop beschikbaar."
        ),
    },
    {
        "enterprise": "0123456790",
        "establishment": "2123456790",
        "name": "Broodhuis Van Acker",
        "legal": "BV",
        "street": "Stationsstraat",
        "house": "8",
        "postcode": "8500",
        "municipality": "Kortrijk",
        "lat": 50.8270,
        "lng": 3.2649,
        "nace": "1071",
        "website": "https://example.com/broodhuis",
        "phone": "+32 56 555 0111",
        "email": "info@broodhuis-demo.be",
        "segment": "product_owner",
        "page_text": (
            "Ambachtelijke bakkerij. Brood, pistolets, verpakte sandwiches. "
            "Zondag gesloten. Takeaway. Uitbreiding tweede winkel."
        ),
    },
    {
        "enterprise": "0123456791",
        "establishment": "2123456791",
        "name": "Patisserie Zoete Zonde",
        "legal": "BV",
        "street": "Markt",
        "house": "3",
        "postcode": "8000",
        "municipality": "Brugge",
        "lat": 51.2093,
        "lng": 3.2247,
        "nace": "1071",
        "website": "https://example.com/zoetezonde",
        "phone": "+32 50 555 0122",
        "email": "contact@zoetezonde-demo.be",
        "segment": "product_owner",
        "page_text": (
            "Patisserie en banket. Verpakte desserts koelvers. "
            "Dinsdag gesloten. Takeaway. Vacature personeelstekort."
        ),
    },
    {
        "enterprise": "0234567890",
        "establishment": "2234567890",
        "name": "Slagerij Vermeulen",
        "legal": "BV",
        "street": "Dorpsstraat",
        "house": "22",
        "postcode": "9800",
        "municipality": "Deinze",
        "lat": 50.9837,
        "lng": 3.5270,
        "nace": "4722",
        "website": "https://example.com/slagerij",
        "phone": "+32 9 555 0202",
        "email": "info@slagerij-demo.be",
        "segment": "product_owner",
        "page_text": (
            "Slagerij met verpakte vleeswaren en bereidingen. "
            "Koeling. Woensdag namiddag gesloten. Takeaway."
        ),
    },
    {
        "enterprise": "0234567891",
        "establishment": "2234567891",
        "name": "Traiteur Vlaamse Kost",
        "legal": "BV",
        "street": "Industrieweg",
        "house": "5",
        "postcode": "8790",
        "municipality": "Waregem",
        "lat": 50.8869,
        "lng": 3.4320,
        "nace": "5621",
        "website": "https://example.com/traiteur",
        "phone": "+32 56 555 0303",
        "email": "contact@traiteur-demo.be",
        "segment": "product_owner",
        "page_text": (
            "Traiteur maaltijden verpakt koelvers. Afhaal en levering. "
            "Maandag gesloten. Nieuwe product range. Webshop."
        ),
    },
    {
        "enterprise": "0567890123",
        "establishment": "2567890123",
        "name": "Chocolaterie Westveld",
        "legal": "BV",
        "street": "Korenmarkt",
        "house": "14",
        "postcode": "9700",
        "municipality": "Oudenaarde",
        "lat": 50.8436,
        "lng": 3.6089,
        "nace": "1082",
        "website": "https://example.com/chocolade",
        "phone": "+32 55 555 0505",
        "email": "info@chocolade-demo.be",
        "segment": "product_owner",
        "page_text": (
            "Chocolaterie pralines verpakt. Speciaalzaak. "
            "Gesloten op maandag. Takeaway. Tweede winkel gepland."
        ),
    },
    {
        "enterprise": "0345678901",
        "establishment": "2345678901",
        "name": "FitClub Brugge",
        "legal": "BV",
        "street": "Langestraat",
        "house": "100",
        "postcode": "8000",
        "municipality": "Brugge",
        "lat": 51.2100,
        "lng": 3.2300,
        "nace": "9313",
        "website": "https://example.com/fitclub",
        "phone": "+32 50 555 0404",
        "email": "hello@fitclub-demo.be",
        "segment": "host_location",
        "page_text": (
            "Fitness club met lange openingsuren. "
            "Medewerkersfaciliteiten. Uitbreiding gepland."
        ),
    },
]


def main() -> None:
    init_db()
    nace_cfg = load_nace_segments()
    ids: list[int] = []

    with session_scope() as db:
        # Clear previous demo scores for clean reseed of review list
        for score in db.query(LeadScore).all():
            db.query(MachineRecommendation).filter_by(lead_score_id=score.id).delete()
            db.delete(score)
        db.flush()

        for fx in FIXTURES:
            org = db.query(Organization).filter_by(enterprise_number=fx["enterprise"]).one_or_none()
            if not org:
                org = Organization(
                    enterprise_number=fx["enterprise"],
                    official_name=fx["name"],
                    legal_form=fx["legal"],
                    entity_type="2",
                    status="AC",
                    is_natural_person=False,
                )
                db.add(org)
                db.flush()
            else:
                org.official_name = fx["name"]

            est = (
                db.query(Establishment)
                .filter_by(establishment_number=fx["establishment"])
                .one_or_none()
            )
            if not est:
                est = Establishment(
                    organization_id=org.id,
                    establishment_number=fx["establishment"],
                    name=fx["name"],
                    status="AC",
                    street=fx["street"],
                    house_number=fx["house"],
                    postcode=fx["postcode"],
                    municipality=fx["municipality"],
                    region="Oost-Vlaanderen"
                    if fx["postcode"].startswith("9")
                    else "West-Vlaanderen",
                    latitude=fx["lat"],
                    longitude=fx["lng"],
                    geocode_confidence=0.9,
                )
                db.add(est)
                db.flush()
            else:
                est.name = fx["name"]
                est.municipality = fx["municipality"]
                est.postcode = fx["postcode"]
                est.street = fx["street"]
                est.house_number = fx["house"]
                est.latitude = fx["lat"]
                est.longitude = fx["lng"]

            if not est.activities:
                db.add(
                    Activity(
                        establishment_id=est.id,
                        nace_version="2008",
                        nace_code=fx["nace"],
                        activity_type="MAIN",
                        description="demo",
                    )
                )
                db.flush()

            codes = [a.nace_code for a in est.activities] or [fx["nace"]]
            pre, hint = compute_preliminary(est, codes, nace_cfg)
            est.preliminary_score = max(pre, 72)
            est.segment_hint = fx["segment"]

            if not db.query(Website).filter_by(establishment_id=est.id).first():
                db.add(
                    Website(
                        organization_id=org.id,
                        establishment_id=est.id,
                        url=fx["website"],
                        domain="example.com",
                        source="fixture",
                        is_official=True,
                    )
                )
            if not db.query(Contact).filter_by(
                organization_id=org.id, contact_value=fx["email"]
            ).first():
                db.add(
                    Contact(
                        organization_id=org.id,
                        establishment_id=est.id,
                        contact_type="email",
                        contact_value=fx["email"],
                        generic_business_contact=True,
                        status="active",
                    )
                )
                db.add(
                    Contact(
                        organization_id=org.id,
                        establishment_id=est.id,
                        contact_type="phone",
                        contact_value=fx["phone"],
                        generic_business_contact=True,
                        status="active",
                    )
                )
            ids.append(est.id)
        db.flush()

    db = SessionLocal()
    try:
        for fx, est_id in zip(FIXTURES, ids):
            pages = [
                {
                    "url": fx["website"],
                    "title": fx["name"],
                    "text": fx["page_text"],
                }
            ]
            extraction = HeuristicExtractor().extract(pages, fx["name"])
            extraction["business_segment"] = fx["segment"]
            est = db.get(Establishment, est_id)
            org = db.get(Organization, est.organization_id)
            assert est and org

            db.add(
                Feature(
                    organization_id=org.id,
                    establishment_id=est.id,
                    feature_name="website_extraction",
                    value_json=extraction,
                    confidence=0.8,
                    model_version="demo-bakery",
                )
            )
            for item in extraction.get("source_evidence") or []:
                db.add(
                    Evidence(
                        organization_id=org.id,
                        establishment_id=est.id,
                        feature_name=str(item.get("field")),
                        feature_value=str(item.get("value")),
                        source_type="website",
                        source_url=item.get("source_url"),
                        source_text=item.get("source_text"),
                        extraction_confidence=float(item.get("confidence") or 0.7),
                    )
                )

            result = RuleLeadScoringEngine().score(
                {
                    "extraction": extraction,
                    "segment_hint": fx["segment"],
                    "distance_km": 20 if fx["segment"] == "product_owner" else 35,
                    "has_email": True,
                    "has_phone": True,
                    "has_website": True,
                    "has_contact_page": True,
                }
            )
            # Ensure bakery/local leads land in review tiers
            floor = 82 if "bakker" in fx["name"].lower() or "brood" in fx["name"].lower() or "patisserie" in fx["name"].lower() else 76
            if fx["segment"] == "host_location":
                floor = 62
            result["priority_score"] = max(result["priority_score"], floor)
            if result["priority_score"] >= 85:
                result["tier"] = "A+"
            elif result["priority_score"] >= 75:
                result["tier"] = "A"
            elif result["priority_score"] >= 60:
                result["tier"] = "B"
            result["explainable_json"]["priority_score"] = result["priority_score"]
            result["explainable_json"]["lead_tier"] = result["tier"]
            result["explainable_json"]["category_label"] = category_label_for(
                fx["name"], fx["segment"], [fx["nace"]]
            )

            score = LeadScore(
                organization_id=org.id,
                establishment_id=est.id,
                segment=result["segment"],
                quality_score=result["quality_score"],
                confidence_score=result["confidence_score"],
                timing_score=result["timing_score"],
                priority_score=result["priority_score"],
                tier=result["tier"],
                score_components_json=result["score_components_json"],
                explainable_json=result["explainable_json"],
                model_version="demo-bakery",
            )
            db.add(score)
            db.flush()
            m = result["machine"]
            db.add(
                MachineRecommendation(
                    lead_score_id=score.id,
                    primary_machine=m["recommended_machine"],
                    alternative_machines_json=m["alternative_machines"],
                    required_features_json=m["required_features"],
                    reasons_json=m["reasons"],
                    questions_json=m["unresolved_questions"],
                    confidence=m["recommendation_confidence"],
                )
            )
            est.review_status = "ready_for_review"
            est.enrichment_stage = "full"
        db.commit()
        print(f"Seeded {len(ids)} bakery/local demo establishments for review.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
