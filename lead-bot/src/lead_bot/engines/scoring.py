from __future__ import annotations

from typing import Any

from lead_bot.config import get_settings
from lead_bot.providers.base import LeadScoringEngine

DEFAULT_RULE_CONFIG = {
    "priority_multipliers": {
        "quality_confidence_base": 0.65,
        "quality_confidence_weight": 0.35,
        "timing_base": 0.80,
        "timing_weight": 0.20,
        "strategic_base": 0.90,
        "strategic_weight": 0.10,
    },
    "tiers": {"A+": 85, "A": 75, "B": 60, "C": 45},
    "penalties": {"outside_territory": 30, "existing_vending": 8, "stale": 10},
    "gross_margin_rate": 0.35,
}


def recommend_machine(extraction: dict[str, Any]) -> dict[str, Any]:
    temps = extraction.get("temperature_requirement") or []
    fragility = extraction.get("product_fragility") or "unknown"
    dims = extraction.get("estimated_product_dimensions") or "unknown"
    segment = extraction.get("business_segment") or "uncertain"
    reasons: list[str] = []
    alts: list[str] = []
    features = ["cashless_payment", "telemetry"]
    primary = "spiral"
    conf = 0.55
    questions = []

    if "frozen" in temps:
        primary = "frozen"
        reasons.append("Products appear to require frozen storage")
        features.append("temperature_monitoring")
        conf = 0.8
    elif "chilled" in temps:
        if fragility in {"medium", "high"} or dims in {"medium", "large"}:
            primary = "refrigerated_lift"
            reasons.append("Chilled products that should not drop on delivery")
            features.extend(["temperature_monitoring", "lift_delivery"])
            alts.append("refrigerated_locker")
            conf = 0.84
        else:
            primary = "refrigerated"
            reasons.append("The business sells chilled products")
            features.append("temperature_monitoring")
            alts.append("refrigerated_lift")
            conf = 0.75
    elif segment == "host_location":
        primary = "spiral"
        reasons.append("Host location typically suited to robust snack/drink spirals")
        conf = 0.7
    elif fragility == "high":
        primary = "lift"
        reasons.append("Delicate products need lift delivery")
        features.append("lift_delivery")
        conf = 0.78

    if extraction.get("online_ordering") == "yes" or dims == "large":
        alts.append("locker")
        if "click" in (extraction.get("vending_opportunity_summary") or "").lower():
            primary = "locker"
            reasons.append("Click-and-collect / irregular sizes suggest lockers")

    if not reasons:
        reasons.append("Default recommendation pending richer product data")
        questions.append("Exact packaging dimensions")
        questions.append("Required shelf life")

    if extraction.get("estimated_product_dimensions") == "unknown":
        questions.append("Exact packaging dimensions")
    if extraction.get("shelf_life_signal") == "unknown":
        questions.append("Required shelf life")

    return {
        "recommended_machine": primary,
        "recommendation_confidence": conf,
        "reasons": reasons[:5],
        "required_features": list(dict.fromkeys(features)),
        "alternative_machines": list(dict.fromkeys(alts))[:2],
        "unresolved_questions": questions[:5],
    }


class RuleLeadScoringEngine(LeadScoringEngine):
    def score(self, context: dict[str, Any]) -> dict[str, Any]:
        settings = get_settings()
        config = DEFAULT_RULE_CONFIG
        extraction = context.get("extraction") or {}
        segment = extraction.get("business_segment") or context.get("segment_hint") or "uncertain"
        if segment in {"product_owner", "multi_location"}:
            quality, components = _score_product_owner(extraction, context)
        elif segment == "host_location":
            quality, components = _score_host(extraction, context)
        else:
            quality, components = _score_product_owner(extraction, context)
            quality *= 0.7
            segment = "uncertain"

        quality = _apply_penalties(quality, context, extraction, config["penalties"])
        confidence = _confidence_score(extraction, context)
        timing = _timing_score(extraction, context)
        locations = max(
            1,
            int(
                context.get("location_count")
                or extraction.get("number_of_locations")
                or 1
            ),
        )
        strategic = _strategic_score(extraction, locations, context)
        expected_deal_value = _expected_deal_value(
            machine=recommend_machine(extraction), locations=locations
        )
        distance = context.get("distance_km")
        territory_mult = _territory_multiplier(distance, segment)

        weights = config["priority_multipliers"]
        priority = quality * (
            weights["quality_confidence_base"]
            + weights["quality_confidence_weight"] * confidence / 100
        )
        priority *= weights["timing_base"] + weights["timing_weight"] * timing / 100
        priority *= (
            weights["strategic_base"] + weights["strategic_weight"] * strategic / 100
        )
        priority *= territory_mult
        if context.get("expansion_lead"):
            priority = min(100, priority * 1.08)
        priority = max(0, min(100, priority))

        if context.get("hard_reject"):
            tier = "rejected"
            priority = 0
            quality = 0
        elif confidence < 40 and quality >= 45:
            tier = "needs_more_data"
        else:
            tier = _tier(priority, config["tiers"])

        machine = recommend_machine(extraction)
        positives = _top_positives(extraction, components, context)
        risks = list(extraction.get("risk_factors") or [])[:3]
        if confidence < 50:
            risks.append("Latest enrichment confidence is limited")
        financial = context.get("financial") or {}
        if financial and not financial.get("available"):
            risks.append("Financial capacity unknown (NBB unavailable)")
        why = _why_now(extraction, context)
        angle = extraction.get("vending_opportunity_summary") or (
            "Extend product availability without a second staffed outlet."
            if segment == "product_owner"
            else "Improve on-site food and drink convenience for staff or visitors."
        )
        plain = _plain_language(extraction, machine, timing, context)

        explainable = {
            "lead_score": round(quality, 1),
            "confidence_score": round(confidence, 1),
            "timing_score": round(timing, 1),
            "priority_score": round(priority, 1),
            "strategic_score": round(strategic, 1),
            "expected_deal_value_eur": round(expected_deal_value, 2),
            "location_count": locations,
            "lead_tier": tier,
            "segment": segment,
            "recommended_machine": machine["recommended_machine"],
            "top_positive_reasons": positives,
            "main_risks": risks,
            "why_contact_now": why,
            "recommended_contact_angle": angle,
            "recommended_next_action": "Human review followed by telephone call"
            if priority >= 75
            else "Review when more data is available",
            "evidence_count": len(extraction.get("source_evidence") or []),
            "last_verified_at": (extraction.get("_meta") or {}).get("retrieved_at"),
            "machine_recommendation": machine,
            "why_this_company": plain["why_this_company"],
            "what_to_say": plain["what_to_say"],
            "rank_explanation": plain["rank_explanation"],
            "places_rating_count": (context.get("places") or {}).get("rating_count"),
            "financial_status": (
                "available"
                if financial.get("available")
                else "unknown"
                if financial
                else "missing"
            ),
        }

        return {
            "segment": segment,
            "quality_score": quality,
            "confidence_score": confidence,
            "timing_score": timing,
            "priority_score": priority,
            "strategic_score": strategic,
            "expected_deal_value_eur": expected_deal_value,
            "tier": tier,
            "score_components_json": components,
            "explainable_json": explainable,
            "model_version": settings.scorer_version,
            "machine": machine,
        }


def _score_product_owner(ex: dict, ctx: dict) -> tuple[float, dict]:
    c: dict[str, float] = {}
    packaged = ex.get("prepackaged_products", "unknown")
    c["packaged"] = {"yes": 5, "partial": 3, "no": 0, "unknown": 0}.get(packaged, 0)
    temps = ex.get("temperature_requirement") or []
    if temps and temps != ["unknown"]:
        c["temperature"] = 4
    else:
        c["temperature"] = 0
    c["size"] = {"small": 4, "medium": 3, "large": 2, "mixed": 2, "unknown": 0}.get(
        ex.get("estimated_product_dimensions", "unknown"), 0
    )
    c["shelf"] = {"short": 1, "medium": 3, "long": 4, "unknown": 0}.get(
        ex.get("shelf_life_signal", "unknown"), 0
    )
    c["advice"] = 3 if ex.get("takeaway_available") == "yes" else 1
    c["price"] = 2
    c["frequency"] = 2
    gap = ex.get("opening_hours_gap") or {}
    c["closed"] = 5 if gap.get("closed_days_per_week") or gap.get("closed_evenings") == "yes" else 1
    c["takeaway"] = 4 if ex.get("takeaway_available") == "yes" else 1
    c["staff"] = 3 if ex.get("staff_shortage_signals") else 0
    c["after_hours"] = 4 if gap.get("closed_evenings") == "yes" else 1
    locations = int(ctx.get("location_count") or ex.get("number_of_locations") or 1)
    c["extra_loc"] = 4 if locations > 1 else 1
    # Financial: unknown → 0 contribution (not a fake mid score)
    financial = ctx.get("financial") or {}
    if financial.get("available") and financial.get("capacity_score") is not None:
        c["financial"] = max(0.0, min(5.0, float(financial["capacity_score"])))
    else:
        c["financial"] = 0
    c["multi"] = 4 if locations > 1 else 1
    c["capacity"] = 2
    c["ops"] = 2
    c["new_loc"] = 4 if ex.get("new_location_signals") else 0
    c["expansion"] = 4 if ex.get("growth_signals") else 0
    c["concept"] = 3 if ex.get("takeaway_available") == "yes" else 0
    c["recruit"] = 2 if ex.get("staff_shortage_signals") else 0
    c["young"] = 1
    geo = ctx.get("geo") or {}
    c["population"] = float(geo.get("demand_proxy") or 2)
    c["access"] = 2
    c["parking"] = 1
    c["competition"] = float(geo.get("competition_proxy") or 2)
    c["route"] = 1
    c["machine_clear"] = 4 if ex.get("possible_machine_types") else 2
    c["install"] = 2
    c["experience"] = 2
    c["multi_machine"] = 2 if locations > 1 else 0
    c["email"] = 2 if ctx.get("has_email") else 0
    c["phone"] = 1 if ctx.get("has_phone") else 0
    c["contact_page"] = 1 if ctx.get("has_contact_page") else 0
    c["decision"] = 1
    c["social_presence"] = _social_presence_bonus(ex, ctx)
    places = ctx.get("places") or {}
    rating_count = int(places.get("rating_count") or places.get("userRatingCount") or 0)
    if rating_count >= 50:
        c["places_activity"] = 2
    elif rating_count >= 10:
        c["places_activity"] = 1
    else:
        c["places_activity"] = 0
    return float(sum(c.values())), c


def _score_host(ex: dict, ctx: dict) -> tuple[float, dict]:
    c: dict[str, float] = {}
    c["people"] = 5
    c["captive"] = 5
    c["dwell"] = 3
    c["hours"] = 3
    c["buildings"] = 2
    c["food_gap"] = 4
    c["night"] = 3 if (ex.get("opening_hours_gap") or {}).get("closed_evenings") == "yes" else 1
    c["breakroom"] = 3
    c["visitors"] = 2
    geo = ctx.get("geo") or {}
    c["demand"] = float(geo.get("demand_proxy") or 1)
    c["space"] = 3
    c["power"] = 2
    c["protected"] = 2
    c["security"] = 1
    c["restock"] = 2
    c["org_size"] = 3
    financial = ctx.get("financial") or {}
    if financial.get("available") and financial.get("capacity_score") is not None:
        c["finance"] = max(0.0, min(4.0, float(financial["capacity_score"])))
    else:
        c["finance"] = 0
    c["procurement"] = 2
    locations = int(ctx.get("location_count") or ex.get("number_of_locations") or 1)
    c["sites"] = 3 if locations > 1 else 1
    c["owner"] = 2
    c["approval"] = 1
    c["restock_model"] = 2
    c["model_fit"] = 2
    c["new_building"] = 4 if ex.get("new_location_signals") else 0
    c["renovation"] = 1
    c["facilities"] = 1
    c["growth"] = 2 if ex.get("growth_signals") else 0
    c["email"] = 2 if ctx.get("has_email") else 0
    c["phone"] = 1 if ctx.get("has_phone") else 0
    c["contact_page"] = 1 if ctx.get("has_contact_page") else 0
    c["decision"] = 1
    c["social_presence"] = _social_presence_bonus(ex, ctx)
    return float(sum(c.values())), c


def _social_presence_bonus(ex: dict, ctx: dict) -> float:
    social = ctx.get("social") or {}
    profiles = social.get("profiles") or ex.get("social_profiles") or []
    count = social.get("platform_count")
    if count is None:
        count = len(profiles)
    if count <= 0:
        return 0.0
    bonus = min(4.0, 1.0 + count)
    if social.get("has_instagram") or social.get("has_tiktok"):
        bonus += 1.0
    return min(5.0, bonus)


def _apply_penalties(quality: float, ctx: dict, ex: dict, penalties: dict[str, float]) -> float:
    q = quality
    if ctx.get("inactive"):
        return 0
    if ctx.get("suppressed_permanent"):
        return 0
    if ctx.get("hard_reject"):
        return 0
    if ctx.get("outside_territory"):
        q -= penalties["outside_territory"]
    if ex.get("existing_vending") == "yes":
        q -= penalties["existing_vending"]
    if ctx.get("stale"):
        q -= penalties["stale"]
    return max(0, min(100, q))


def _confidence_score(ex: dict, ctx: dict) -> float:
    evidence = ex.get("source_evidence") or []
    if not evidence:
        base = 35.0
    else:
        confs = [float(e.get("confidence", 0.5)) for e in evidence]
        base = 40 + 50 * (sum(confs) / len(confs))
    if ctx.get("has_website"):
        base += 5
    social = ctx.get("social") or {}
    if (social.get("platform_count") or 0) >= 2:
        base += 4
    elif (social.get("platform_count") or 0) == 1:
        base += 2
    places = ctx.get("places") or {}
    if places.get("business_status") == "OPERATIONAL":
        base += 4
    if places.get("phone") or places.get("website"):
        base += 2
    if int(places.get("rating_count") or places.get("userRatingCount") or 0) >= 10:
        base += 2
    financial = ctx.get("financial") or {}
    if financial and not financial.get("available"):
        base -= 8  # unknown NBB lowers confidence, does not invent quality
    if ex.get("prepackaged_products") == "unknown":
        base -= 4
    temps = ex.get("temperature_requirement") or []
    if not temps or temps == ["unknown"]:
        base -= 3
    if ex.get("business_segment") in {"unsuitable", "uncertain"}:
        base -= 10
    return max(0, min(100, base))


def _timing_score(ex: dict, ctx: dict | None = None) -> float:
    score = 40.0
    ctx = ctx or {}
    timing = ctx.get("timing") or {}
    if timing.get("score") is not None:
        score = float(timing["score"])
    else:
        if ex.get("new_location_signals"):
            score += 25
        if ex.get("growth_signals"):
            score += 20
        if ex.get("staff_shortage_signals"):
            score += 10
        gap = ex.get("opening_hours_gap") or {}
        if gap.get("closed_days_per_week") or gap.get("closed_evenings") == "yes":
            score += 5
    social = ctx.get("social") or {}
    if social.get("growth_signals"):
        score += 8
    if social.get("hiring_signals"):
        score += 5
    if (social.get("platform_count") or 0) >= 2:
        score += 3
    places = ctx.get("places") or {}
    if places.get("closed_evenings") == "yes" or (
        (places.get("opening_hours") or {}).get("closed_evenings") == "yes"
    ):
        score += 4
    return max(0, min(100, score))


def _strategic_score(ex: dict, locations: int, ctx: dict | None = None) -> float:
    score = 35.0
    score += min(35, max(0, locations - 1) * 7)
    if ex.get("growth_signals"):
        score += 15
    if ex.get("new_location_signals"):
        score += 10
    if ex.get("business_segment") == "multi_location":
        score += 10
    if (ctx or {}).get("expansion_lead"):
        score += 12
    return max(0, min(100, score))


def _expected_deal_value(machine: dict, locations: int) -> float:
    base = {
        "spiral": 6500,
        "refrigerated": 9500,
        "refrigerated_lift": 13500,
        "frozen": 14500,
        "lift": 10500,
        "locker": 16000,
    }.get(machine["recommended_machine"], 7500)
    rollout_units = min(max(locations, 1), 10)
    confidence = float(machine.get("recommendation_confidence") or 0.5)
    return base * rollout_units * (0.65 + 0.35 * confidence)


def _territory_multiplier(distance_km: float | None, segment: str) -> float:
    if segment == "multi_location":
        return 1.0
    if distance_km is None:
        return 1.0
    minutes = distance_km * 1.1
    if minutes <= 40:
        return 1.05
    if minutes <= 75:
        return 1.0
    if minutes <= 120:
        return 0.9
    return 0.75


def _tier(priority: float, tiers: dict[str, int]) -> str:
    if priority >= tiers["A+"]:
        return "A+"
    if priority >= tiers["A"]:
        return "A"
    if priority >= tiers["B"]:
        return "B"
    if priority >= tiers["C"]:
        return "C"
    return "D"


def _top_positives(ex: dict, components: dict, ctx: dict | None = None) -> list[str]:
    out = []
    if ex.get("prepackaged_products") == "yes":
        out.append("Products appear already packaged")
    if "chilled" in (ex.get("temperature_requirement") or []):
        out.append("Sells chilled products suitable for refrigerated machines")
    gap = ex.get("opening_hours_gap") or {}
    if gap.get("closed_days_per_week") or gap.get("closed_evenings") == "yes":
        out.append("Closed periods create after-hours demand opportunity")
    if ex.get("new_location_signals") or ex.get("growth_signals"):
        out.append("Recent expansion or growth signals detected")
    if ex.get("takeaway_available") == "yes":
        out.append("Existing takeaway demand")
    profiles = ex.get("social_profiles") or []
    if profiles:
        platforms = ", ".join(sorted({p.get("platform") for p in profiles if p.get("platform")}))
        out.append(f"Active social presence ({platforms})")
    places = (ctx or {}).get("places") or {}
    if int(places.get("rating_count") or 0) >= 20:
        out.append("Active Google Business Profile with customer reviews")
    if (ctx or {}).get("expansion_lead"):
        out.append("Existing customer — expansion / second machine opportunity")
    while len(out) < 3:
        out.append("Relevant sector for MATO vending")
        break
    return out[:3]


def _why_now(ex: dict, ctx: dict | None = None) -> str:
    if (ctx or {}).get("expansion_lead"):
        return "Existing customer — good moment to discuss an additional machine."
    if ex.get("new_location_signals"):
        return "Expansion / new location signals were detected on the website."
    if ex.get("staff_shortage_signals"):
        return "Staff-shortage signals suggest automation may be timely."
    if (ex.get("opening_hours_gap") or {}).get("closed_evenings") == "yes":
        return "Evening closures create an immediate unattended sales window."
    if ex.get("social_profiles"):
        return "Public social profiles reinforce local demand and brand activity."
    return "Profile matches MATO vending suitability heuristics."


def _plain_language(
    ex: dict, machine: dict, timing: float, ctx: dict
) -> dict[str, str]:
    machine_name = (machine.get("recommended_machine") or "vending").replace("_", " ")
    meeting_hint = "High chance of a useful first conversation" if timing >= 60 else (
        "Moderate chance of a useful first conversation"
    )
    why = (
        f"{meeting_hint} plus a clear {machine_name} fit."
    )
    if ex.get("prepackaged_products") == "yes":
        why = f"Packaged products suit a {machine_name}; {meeting_hint.lower()}."
    say = ex.get("vending_opportunity_summary") or (
        f"Ask whether after-hours sales with a {machine_name} would help their customers."
    )
    rank = why
    if ctx.get("expansion_lead"):
        rank = f"Expansion on an installed customer — {machine_name} follow-on."
    return {
        "why_this_company": why,
        "what_to_say": say,
        "rank_explanation": rank,
    }
