from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

# Public-page keyword / evidence adapters (no paid news APIs).
JOB_TERMS = (
    "vacature",
    "we zoeken",
    "hiring",
    "job opening",
    "medewerker gezocht",
    "join our team",
    "solliciteer",
    "jobs",
)
NEWS_EXPANSION_TERMS = (
    "nieuwe vestiging",
    "new location",
    "tweede winkel",
    "uitbreiding",
    "expansion",
    "grand opening",
    "binnenkort open",
    "opening soon",
    "nu open",
    "now open",
    "nieuws",
)


def extract_timing_signals(extraction: dict[str, Any]) -> dict[str, Any]:
    signals = []
    if extraction.get("new_location_signals"):
        signals.append({"type": "new_location", "weight": 25})
    if extraction.get("growth_signals"):
        signals.append({"type": "growth", "weight": 20})
    if extraction.get("staff_shortage_signals"):
        signals.append({"type": "staff_shortage", "weight": 10})
    gap = extraction.get("opening_hours_gap") or {}
    if gap.get("closed_days_per_week") or gap.get("closed_evenings") == "yes":
        signals.append({"type": "availability_gap", "weight": 5})
    return {
        "signals": signals,
        "score": max(0, min(100, 40 + sum(item["weight"] for item in signals))),
        "calculated_at": datetime.now(timezone.utc).isoformat(),
    }


def extract_job_news_timing(pages: list[dict[str, Any]]) -> dict[str, Any]:
    """Keyword/evidence timing from public crawl pages (vacatures / nieuws)."""
    signals: list[dict[str, Any]] = []
    evidence: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc).isoformat()
    for page in pages or []:
        url = page.get("url") or ""
        text = (page.get("text") or "").lower()
        path = url.lower()
        is_jobs = any(x in path for x in ("vacature", "jobs", "careers", "werken-bij"))
        is_news = any(x in path for x in ("nieuws", "news", "blog", "actua"))
        for term in JOB_TERMS:
            if term in text or is_jobs:
                signals.append({"type": "hiring", "weight": 10, "term": term})
                evidence.append(
                    {
                        "field": "staff_shortage_signals",
                        "value": term,
                        "source_url": url,
                        "source_text": term,
                        "confidence": 0.7 if is_jobs else 0.55,
                        "retrieved_at": now,
                    }
                )
                break
        for term in NEWS_EXPANSION_TERMS:
            if term in text or (is_news and term in text):
                signals.append({"type": "news_expansion", "weight": 18, "term": term})
                evidence.append(
                    {
                        "field": "growth_signals",
                        "value": term,
                        "source_url": url,
                        "source_text": term,
                        "confidence": 0.65,
                        "retrieved_at": now,
                    }
                )
                break
    # de-dupe by type
    seen = set()
    uniq = []
    for s in signals:
        if s["type"] in seen:
            continue
        seen.add(s["type"])
        uniq.append(s)
    return {
        "signals": uniq,
        "source_evidence": evidence[:12],
        "score": max(0, min(100, 40 + sum(item["weight"] for item in uniq))),
        "calculated_at": now,
        "adapter": "job_news_public_pages",
    }
