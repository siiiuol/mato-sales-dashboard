from __future__ import annotations

import re
import time
from urllib.parse import urljoin, urlparse, urldefrag
from urllib import robotparser

import httpx
from bs4 import BeautifulSoup
from selectolax.parser import HTMLParser

from lead_bot.config import get_settings
from lead_bot.providers.base import WebsiteCrawler

PRIORITY_PATHS = [
    "/",
    "/producten",
    "/products",
    "/assortiment",
    "/menu",
    "/takeaway",
    "/shop",
    "/webshop",
    "/over-ons",
    "/about",
    "/contact",
    "/locations",
    "/winkels",
    "/nieuws",
    "/news",
    "/blog",
    "/jobs",
    "/vacatures",
]


class HttpxWebsiteCrawler(WebsiteCrawler):
    def __init__(self, max_pages: int | None = None):
        self.settings = get_settings()
        self.max_pages = max_pages or self.settings.crawl_max_pages

    def crawl(self, start_url: str) -> list[dict]:
        if not start_url.startswith("http"):
            start_url = "https://" + start_url
        parsed = urlparse(start_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        rp = robotparser.RobotFileParser()
        try:
            rp.set_url(urljoin(base, "/robots.txt"))
            rp.read()
        except Exception:
            rp = None

        delay = 1.0 / max(self.settings.crawl_max_rps, 0.1)
        pages: list[dict] = []
        seen: set[str] = set()
        queue: list[str] = [urljoin(base, p) for p in PRIORITY_PATHS]
        queue.insert(0, start_url)
        total_bytes = 0

        headers = {
            "User-Agent": "MATO-LeadBot/0.1 (+https://mato.local; research; respect robots)"
        }

        with httpx.Client(follow_redirects=True, timeout=15.0, headers=headers) as client:
            while queue and len(pages) < self.max_pages:
                url = queue.pop(0)
                url, _ = urldefrag(url)
                url = _strip_tracking(url)
                if url in seen:
                    continue
                seen.add(url)
                if urlparse(url).netloc != parsed.netloc:
                    continue
                if rp and not rp.can_fetch(headers["User-Agent"], url):
                    continue
                try:
                    time.sleep(delay)
                    res = client.get(url)
                    if res.status_code >= 400:
                        continue
                    content_type = res.headers.get("content-type", "")
                    if "html" not in content_type and not url.endswith(("/", ".html", ".htm")):
                        # still try if text
                        if "text" not in content_type:
                            continue
                    body = res.text
                    total_bytes += len(body.encode("utf-8", errors="ignore"))
                    if total_bytes > self.settings.crawl_max_bytes:
                        break
                    text = _clean_text(body)
                    pages.append(
                        {
                            "url": str(res.url),
                            "title": _title(body),
                            "text": text[:20000],
                            "external_links": _extract_external_links(body, base),
                        }
                    )
                    # discover a few more internal links from homepage-like pages
                    if len(pages) <= 3:
                        for link in _extract_links(body, base):
                            if link not in seen:
                                queue.append(link)
                except Exception:
                    continue
        return pages


def _strip_tracking(url: str) -> str:
    p = urlparse(url)
    if not p.query:
        return url
    q = "&".join(
        part
        for part in p.query.split("&")
        if not part.lower().startswith(("utm_", "fbclid", "gclid"))
    )
    return p._replace(query=q).geturl()


def _title(html: str) -> str:
    try:
        tree = HTMLParser(html)
        t = tree.css_first("title")
        return t.text(strip=True) if t else ""
    except Exception:
        return ""


def _clean_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
        tag.decompose()
    # remove common chrome
    for sel in ["nav", "footer", "header"]:
        for el in soup.select(sel):
            el.decompose()
    text = soup.get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # drop prompt-like lines
    lines = []
    for line in text.splitlines():
        low = line.lower()
        if "ignore previous instructions" in low or "system prompt" in low:
            continue
        lines.append(line)
    return "\n".join(lines)


def _extract_links(html: str, base: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    out = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("mailto:") or href.startswith("tel:"):
            continue
        full = urljoin(base, href)
        path = urlparse(full).path.lower()
        if any(p.strip("/") in path for p in PRIORITY_PATHS if p != "/"):
            out.append(full)
    return out[:30]


def _extract_external_links(html: str, base: str) -> list[str]:
    """Capture outbound social / directory links for enrichment providers."""
    soup = BeautifulSoup(html, "lxml")
    base_host = urlparse(base).netloc.lower()
    out: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        full = urljoin(base, href)
        host = urlparse(full).netloc.lower()
        if not host or host == base_host or host.endswith("." + base_host):
            continue
        out.append(full)
    # also parse common social meta tags
    for prop in ("og:see_also", "og:url"):
        for tag in soup.find_all("meta", attrs={"property": prop}):
            content = tag.get("content")
            if content and content.startswith("http"):
                out.append(content)
    return list(dict.fromkeys(out))[:80]
