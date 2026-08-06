from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse, urlunparse

import httpx

# Public business-profile discovery only. No login-walled scraping or private content.
PLATFORM_HOSTS: dict[str, tuple[str, ...]] = {
    "instagram": ("instagram.com", "www.instagram.com"),
    "facebook": ("facebook.com", "www.facebook.com", "fb.com", "www.fb.com", "m.facebook.com"),
    "tiktok": ("tiktok.com", "www.tiktok.com", "vm.tiktok.com"),
    "linkedin": ("linkedin.com", "www.linkedin.com"),
    "youtube": ("youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"),
    "x": ("x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"),
    "pinterest": ("pinterest.com", "www.pinterest.com", "pin.it"),
}

URL_RE = re.compile(
    r"https?://(?:www\.)?(?:"
    r"instagram\.com|facebook\.com|fb\.com|tiktok\.com|vm\.tiktok\.com|"
    r"linkedin\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|pinterest\.com|pin\.it"
    r")/[^\s\"'<>]+",
    re.IGNORECASE,
)

HANDLE_HINTS = re.compile(
    r"(?:instagram|ig|tiktok|facebook|fb|linkedin|youtube|twitter|x)\s*[:/]\s*@?([A-Za-z0-9._-]{2,64})",
    re.IGNORECASE,
)

GROWTH_TERMS = (
    "nieuwe vestiging",
    "new location",
    "opening soon",
    "binnenkort open",
    "uitbreiding",
    "expansion",
    "tweede winkel",
    "grand opening",
    "now open",
    "nu open",
)
HIRING_TERMS = (
    "we zoeken",
    "vacature",
    "hiring",
    "job opening",
    "medewerker gezocht",
    "join our team",
)


@dataclass
class SocialProfile:
    platform: str
    url: str
    handle: str | None
    source: str
    confidence: float
    signals: list[str]


class SocialMediaDiscoveryProvider:
    """Discover public social profile URLs from website crawl artifacts.

    Platforms like TikTok/Instagram/Facebook are discovered via links published on
    the company website (and optional soft existence checks). This avoids
    browser-scraping walled gardens.
    """

    def discover(
        self,
        *,
        pages: list[dict[str, Any]] | None = None,
        company_name: str | None = None,
        known_urls: list[str] | None = None,
        soft_verify: bool = False,
    ) -> dict[str, Any]:
        found: dict[str, SocialProfile] = {}
        evidence: list[dict[str, Any]] = []
        page_blob = ""

        for page in pages or []:
            page_url = page.get("url") or ""
            text = page.get("text") or ""
            page_blob += "\n" + text.lower()
            candidates = list(page.get("external_links") or [])
            candidates.extend(URL_RE.findall(text))
            candidates.extend(URL_RE.findall(page_url))
            for href in candidates:
                profile = self._normalize_profile(href, source=page_url or "website")
                if not profile:
                    continue
                prev = found.get(profile.platform)
                if prev and prev.confidence >= profile.confidence:
                    continue
                found[profile.platform] = profile
                evidence.append(
                    {
                        "field": f"social_{profile.platform}",
                        "value": profile.url,
                        "source_url": page_url or profile.url,
                        "source_text": profile.handle or profile.platform,
                        "confidence": profile.confidence,
                    }
                )

        for url in known_urls or []:
            profile = self._normalize_profile(url, source="known_contact")
            if not profile:
                continue
            found.setdefault(profile.platform, profile)

        # Lightweight handle hints only map when a platform host was already found.
        for match in HANDLE_HINTS.finditer("\n".join((p.get("text") or "") for p in pages or [])):
            _ = match.group(1)

        signals = self._signals_from_text(page_blob)
        for profile in found.values():
            profile.signals = signals

        if soft_verify and found:
            self._soft_verify(found)

        profiles = [
            {
                "platform": p.platform,
                "url": p.url,
                "handle": p.handle,
                "source": p.source,
                "confidence": p.confidence,
                "signals": p.signals,
                "exists": True,
            }
            for p in found.values()
        ]
        platforms = sorted(found.keys())
        return {
            "profiles": profiles,
            "platforms": platforms,
            "platform_count": len(platforms),
            "has_instagram": "instagram" in found,
            "has_facebook": "facebook" in found,
            "has_tiktok": "tiktok" in found,
            "has_linkedin": "linkedin" in found,
            "has_youtube": "youtube" in found,
            "has_x": "x" in found,
            "growth_signals": [s for s in signals if s.startswith("growth:")],
            "hiring_signals": [s for s in signals if s.startswith("hiring:")],
            "source_evidence": evidence,
            "company_name": company_name,
            "discovery_method": "website_links",
        }

    def _normalize_profile(self, raw_url: str, source: str) -> SocialProfile | None:
        url = (raw_url or "").strip().rstrip(").,;'\"")
        if not url:
            return None
        if not url.startswith(("http://", "https://")):
            url = "https://" + url.lstrip("/")
        parsed = urlparse(url)
        host = (parsed.netloc or "").lower()
        if host.startswith("www."):
            host_key = host
        else:
            host_key = host
        platform = None
        for name, hosts in PLATFORM_HOSTS.items():
            if host_key in hosts or host in hosts:
                platform = name
                break
        if not platform:
            return None

        path = parsed.path or "/"
        # Skip share/login/noise paths
        low = path.lower()
        if any(
            part in low
            for part in (
                "/share",
                "/login",
                "/signup",
                "/help",
                "/privacy",
                "/watch",
                "/reel/",
                "/p/",
                "/posts/",
                "/status/",
                "/hashtag/",
                "/explore",
            )
        ):
            # Keep channel-like paths; drop single post deep links except youtube channels.
            if platform != "youtube" or "/channel/" not in low and "/@" not in low and "/c/" not in low:
                if platform in {"instagram", "tiktok", "facebook", "x"} and path.count("/") >= 2:
                    # e.g. /username/reel/... → keep username root
                    segments = [s for s in path.split("/") if s]
                    if segments:
                        path = "/" + segments[0]
                    else:
                        return None
                elif platform == "youtube" and ("/watch" in low or "/shorts/" in low):
                    return None

        clean = urlunparse(("https", host_key.removeprefix("www.") if platform != "linkedin" else host_key, path.rstrip("/") or "/", "", "", ""))
        # Prefer www-less canonical for consistency, except linkedin company paths.
        if platform == "linkedin":
            clean = urlunparse(("https", "www.linkedin.com", path.rstrip("/") or "/", "", "", ""))
        if platform == "facebook":
            clean = urlunparse(("https", "www.facebook.com", path.rstrip("/") or "/", "", "", ""))
        if platform == "instagram":
            clean = urlunparse(("https", "www.instagram.com", path.rstrip("/") or "/", "", "", ""))
        if platform == "tiktok":
            clean = urlunparse(("https", "www.tiktok.com", path.rstrip("/") or "/", "", "", ""))

        handle = None
        segments = [s for s in urlparse(clean).path.split("/") if s]
        if segments:
            handle = segments[-1].lstrip("@")
            if handle.lower() in {"pages", "company", "in", "channel", "c", "user"}:
                handle = segments[-1] if len(segments) == 1 else segments[-1]

        # Require a path beyond homepage for most platforms
        if urlparse(clean).path in {"", "/"} and platform != "youtube":
            return None

        return SocialProfile(
            platform=platform,
            url=clean,
            handle=handle,
            source=source,
            confidence=0.85 if source != "known_contact" else 0.95,
            signals=[],
        )

    def _signals_from_text(self, blob: str) -> list[str]:
        signals: list[str] = []
        for term in GROWTH_TERMS:
            if term in blob:
                signals.append(f"growth:{term}")
        for term in HIRING_TERMS:
            if term in blob:
                signals.append(f"hiring:{term}")
        return list(dict.fromkeys(signals))[:8]

    def _soft_verify(self, found: dict[str, SocialProfile]) -> None:
        headers = {
            "User-Agent": "MATO-LeadBot/0.1 (+https://mato.local; public-profile-check)"
        }
        with httpx.Client(follow_redirects=True, timeout=8.0, headers=headers) as client:
            for profile in found.values():
                try:
                    res = client.head(profile.url)
                    if res.status_code >= 400:
                        res = client.get(profile.url)
                    if res.status_code >= 400:
                        profile.confidence = max(0.4, profile.confidence - 0.25)
                except Exception:
                    profile.confidence = max(0.45, profile.confidence - 0.15)
