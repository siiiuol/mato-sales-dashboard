from __future__ import annotations


import yaml

from lead_bot.config import CONFIG_DIR


def load_territory(name: str) -> dict:
    data = yaml.safe_load((CONFIG_DIR / "territory.yaml").read_text(encoding="utf-8"))
    if name not in data:
        raise ValueError(f"Unknown territory: {name}")
    return data[name]


def load_nace_segments() -> dict:
    return yaml.safe_load((CONFIG_DIR / "nace_segments.yaml").read_text(encoding="utf-8"))


def postcode_in_territory(postcode: str | None, territory: dict) -> bool:
    if not postcode:
        return False
    digits = "".join(c for c in postcode if c.isdigit())
    if len(digits) < 4:
        return False
    pc = int(digits[:4])
    for start, end in territory.get("postcode_ranges", []):
        if start <= pc <= end:
            return True
    return False


def region_from_postcode(postcode: str | None) -> str | None:
    if not postcode:
        return None
    digits = "".join(c for c in postcode if c.isdigit())
    if len(digits) < 4:
        return None
    pc = int(digits[:4])
    if 8000 <= pc <= 8999:
        return "West-Vlaanderen"
    if 9000 <= pc <= 9999:
        return "Oost-Vlaanderen"
    if 2000 <= pc <= 2999:
        return "Antwerpen"
    if 3000 <= pc <= 3499 or 1500 <= pc <= 1999:
        return "Vlaams-Brabant"
    if 3500 <= pc <= 3999:
        return "Limburg"
    return None


def nace_matches(code: str, prefixes: list[str]) -> bool:
    c = code.replace(".", "").strip()
    return any(c.startswith(p.replace(".", "")) for p in prefixes)
