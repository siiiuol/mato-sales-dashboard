from __future__ import annotations

from lead_bot.models import Establishment
from lead_bot.services.config_loader import nace_matches

BAKERY_LOCAL_BOOST = [
    "bakkerij",
    "bakker",
    "brood",
    "patisserie",
    "banket",
    "chocolat",
    "chocolaterie",
    "traiteur",
    "slagerij",
    "slager",
    "hoeve",
    "hoevewinkel",
    "ijssalon",
    "bloemist",
]


def compute_preliminary(
    est: Establishment, nace_codes: list[str], nace_cfg: dict
) -> tuple[float, str | None]:
    """Cheap pre-crawl score 0–100 and segment hint — bakery/local food first."""
    po_prefixes = nace_cfg.get("product_owner", {}).get("nace_2008", [])
    host_prefixes = nace_cfg.get("host_location", {}).get("nace_2008", [])

    po_hit = any(nace_matches(c, po_prefixes) for c in nace_codes)
    host_hit = any(nace_matches(c, host_prefixes) for c in nace_codes)

    name = (est.name or "").lower()
    po_kw = nace_cfg.get("product_owner", {}).get("keywords", [])
    host_kw = nace_cfg.get("host_location", {}).get("keywords", [])
    if any(k in name for k in po_kw):
        po_hit = True
    if any(k in name for k in host_kw):
        host_hit = True

    bakery_boost = any(k in name for k in BAKERY_LOCAL_BOOST)
    bakery_nace = any(
        nace_matches(c, ["1071", "1072", "4724", "1082", "4722", "562", "1085"])
        for c in nace_codes
    )

    if not po_hit and not host_hit and not bakery_boost:
        return 15.0, "uncertain"

    score = 35.0
    if po_hit or bakery_boost:
        score += 25
    if bakery_boost or bakery_nace:
        score += 18  # strong preference for bakeries / local food
    if host_hit and not (po_hit or bakery_boost):
        score += 10
    if est.postcode:
        score += 5
    if est.status == "AC":
        score += 5

    # Prefer product_owner whenever bakery/local signals exist
    if po_hit or bakery_boost or bakery_nace:
        hint = "product_owner"
    elif host_hit:
        hint = "host_location"
    else:
        hint = "uncertain"

    return min(score, 95.0), hint


def category_label_for(name: str | None, segment: str | None, nace_codes: list[str] | None = None) -> str:
    """Map establishment to Review group label."""
    text = (name or "").lower()
    codes = nace_codes or []
    rules = [
        ("Bakeries", ["bakkerij", "bakker", "bakery", "brood", "patisserie", "banket"], ["1071", "1072", "4724"]),
        ("Butcheries / deli", ["slagerij", "slager", "butcher", "delicatessen", "vlees"], ["4722", "101"]),
        ("Traiteurs / meal prep", ["traiteur", "cater", "mealprep", "meal-prep", "maaltijd"], ["562", "1085"]),
        ("Chocolatiers / sweets", ["chocolat", "chocolaterie", "ijssalon", "ice cream", "confiserie"], ["1082"]),
        ("Host locations", ["fabriek", "magazijn", "fitness", "hotel", "school", "ziekenhuis", "kantoor", "logi"], ["52", "55", "85", "86", "93"]),
    ]
    for label, kws, nace_list in rules:
        if any(k in text for k in kws):
            return label
        if any(nace_matches(c, nace_list) for c in codes):
            return label
    if segment == "host_location":
        return "Host locations"
    if segment == "product_owner":
        return "Other local"
    return "Other local"
