"""
WorldPulse Public API Provider for ANVESHA.
Fetches verified world event signals, outlet counts, and reliability scores without API keys.
Docs: https://world-pulse.io/developers
"""
import time
import httpx
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from .models import NewsArticle, ProviderHealth
from .news_normalizer import (
    canonicalize_url,
    generate_article_id,
    clean_text_snippet,
    parse_datetime_to_iso,
    map_category_slug,
)
from engine.http_client import get_shared_client

WORLDPULSE_BASE = "https://api.world-pulse.io"


class WorldPulseProvider:
    def __init__(self, timeout: float = 8.0):
        self.timeout = timeout
        self.health = ProviderHealth(
            source_id="worldpulse",
            source_name="WorldPulse Public API",
            provider="worldpulse",
            status="healthy",
        )

    async def fetch_signals(
        self,
        category: Optional[str] = None,
        limit: int = 30,
        offset: int = 0
    ) -> List[NewsArticle]:
        """Fetches latest verified world signals from WorldPulse public endpoint."""
        url = f"{WORLDPULSE_BASE}/api/v1/public/signals"
        params: Dict[str, Any] = {"limit": min(limit, 50), "offset": offset}
        if category and category.lower() not in ("all", "top"):
            # Map ANVESHA category to WorldPulse categories where appropriate
            wp_cat_map = {
                "world": "geopolitics",
                "politics": "politics",
                "technology": "technology",
                "science": "science",
                "finance": "finance",
                "business": "economy",
                "health": "health",
                "climate": "climate",
                "environment": "climate",
                "breaking": "breaking",
                "cybersecurity": "security",
                "sports": "sports",
            }
            params["category"] = wp_cat_map.get(category.lower(), category.lower())

        start_time = time.time()
        self.health.last_attempt_at = parse_datetime_to_iso(time.time())

        try:
            client = get_shared_client()
            res = await client.get(url, params=params, headers={"User-Agent": "ANVESHA-GlobalNews/1.0"}, timeout=self.timeout)
            self.health.response_time_ms = round((time.time() - start_time) * 1000, 2)

            if res.status_code == 200:
                data = res.json()
                signals = data.get("data", [])
                self.health.status = "healthy"
                self.health.last_success_at = parse_datetime_to_iso(time.time())
                self.health.consecutive_failures = 0
                self.health.error_message = None

                articles: List[NewsArticle] = []
                for item in signals:
                    articles.append(self._to_article(item))
                return articles
            else:
                self.health.consecutive_failures += 1
                self.health.status = "degraded" if self.health.consecutive_failures < 3 else "down"
                self.health.error_message = f"HTTP {res.status_code}"
                return []
        except Exception as e:
            self.health.consecutive_failures += 1
            self.health.status = "degraded" if self.health.consecutive_failures < 3 else "down"
            self.health.error_message = str(e)
            return []

    async def search(self, query: str, limit: int = 25) -> List[NewsArticle]:
        """Searches WorldPulse verified signals by keyword/topic."""
        url = f"{WORLDPULSE_BASE}/api/v1/search"
        params = {"q": query, "type": "signals", "limit": min(limit, 40)}

        try:
            client = get_shared_client()
            res = await client.get(url, params=params, headers={"User-Agent": "ANVESHA-GlobalNews/1.0"}, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                results = data.get("data", {}).get("results", {}).get("signals", [])
                return [self._to_article(item) for item in results]
            return []
        except Exception as e:
            self.health.error_message = str(e)
            return []

    async def fetch_daily_briefing(self) -> Dict[str, Any]:
        """Fetches top 20 signals of the last 24 hours aggregated by category."""
        url = f"{WORLDPULSE_BASE}/api/v1/briefing/daily"
        try:
            client = get_shared_client()
            res = await client.get(url, headers={"User-Agent": "ANVESHA-GlobalNews/1.0"}, timeout=self.timeout)
            if res.status_code == 200:
                return res.json().get("data", {})
            return {}
        except Exception:
            return {}

    def _to_article(self, item: Dict[str, Any]) -> NewsArticle:
        raw_url = item.get("source_url") or item.get("url") or f"{WORLDPULSE_BASE}/signals/{item.get('id')}"
        canon_url = canonicalize_url(raw_url)
        title = item.get("title", "").strip()
        art_id = generate_article_id(canon_url, title)

        # Source attribution & independent outlet identification
        sites = item.get("sites") or []
        site_info = item.get("site_info") or []
        first_site_info = site_info[0] if site_info else {}

        source_name = first_site_info.get("name") or (sites[0] if sites else "WorldPulse Verified")
        source_domain = first_site_info.get("site") or (sites[0] if sites else urlparse(canon_url).netloc)

        # Outlets count representing independent outlets that reported this signal
        outlets_count = item.get("outlets") or len(sites) or 1
        reliability = float(item.get("reliability_score") or 0.82)
        location = item.get("location_name") or ""
        country_code = first_site_info.get("country", "WORLD")

        summary = clean_text_snippet(
            item.get("summary") or
            f"Verified world event across {outlets_count} independent outlets in {location or 'global regions'}."
        )

        return NewsArticle(
            id=art_id,
            title=title,
            original_url=canon_url,
            source_name=source_name,
            source_domain=source_domain,
            category=map_category_slug(item.get("category")),
            country=country_code.upper() if len(country_code) == 2 else "WORLD",
            language="en",
            published_at=parse_datetime_to_iso(item.get("published_at")),
            summary=summary,
            image_url=item.get("image_url"),
            provider="worldpulse",
            outlets_count=outlets_count,
            reliability_score=reliability,
            is_breaking=(item.get("severity") in ("high", "critical") or item.get("category") == "breaking"),
            raw_metadata={
                "worldpulse_id": item.get("id"),
                "sites": sites,
                "site_info": site_info,
                "severity": item.get("severity"),
                "location_name": location,
            }
        )
