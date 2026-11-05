"""
Optional Self-Hosted FreshRSS Provider for ANVESHA.
Integrates with self-hosted FreshRSS instances via Google Reader API.
Remains 100% optional: gracefully skips if unconfigured.
Docs: https://github.com/FreshRSS/FreshRSS
"""
import os
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


class FreshRSSProvider:
    def __init__(self, timeout: float = 6.0):
        self.timeout = timeout
        self.base_url = os.getenv("FRESHRSS_URL", "").rstrip("/")
        self.user = os.getenv("FRESHRSS_USER", "")
        self.api_key = os.getenv("FRESHRSS_API_KEY", "")
        self.is_configured = bool(self.base_url and (self.user or self.api_key))

        self.health = ProviderHealth(
            source_id="freshrss",
            source_name="Self-Hosted FreshRSS",
            provider="freshrss",
            status="healthy" if self.is_configured else "disabled",
        )

    async def fetch_articles(self, limit: int = 25) -> List[NewsArticle]:
        """Fetches latest unread/stream stories from self-hosted FreshRSS instance."""
        if not self.is_configured:
            return []

        # Google Reader compatible endpoint in FreshRSS
        url = f"{self.base_url}/api/greader.php/reader/api/0/stream/contents/reading-list"
        params = {"n": min(limit, 40)}
        headers = {"User-Agent": "ANVESHA-GlobalNews/1.0"}
        if self.api_key:
            headers["Authorization"] = f"GoogleLogin auth={self.api_key}"

        start_time = time.time()
        self.health.last_attempt_at = parse_datetime_to_iso(time.time())

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.get(url, params=params, headers=headers)
                self.health.response_time_ms = round((time.time() - start_time) * 1000, 2)

                if res.status_code == 200:
                    data = res.json()
                    items = data.get("items", [])
                    self.health.status = "healthy"
                    self.health.last_success_at = parse_datetime_to_iso(time.time())
                    self.health.consecutive_failures = 0
                    self.health.error_message = None

                    articles: List[NewsArticle] = []
                    for it in items:
                        canon_url = canonicalize_url(it.get("canonical", [{}])[0].get("href") or it.get("alternate", [{}])[0].get("href") or "")
                        if not canon_url:
                            continue
                        title = it.get("title", "Untitled")
                        summary = clean_text_snippet(it.get("summary", {}).get("content", ""))
                        origin_title = it.get("origin", {}).get("title", "FreshRSS Feed")

                        articles.append(NewsArticle(
                            id=generate_article_id(canon_url, title),
                            title=title,
                            original_url=canon_url,
                            source_name=origin_title,
                            source_domain=urlparse(canon_url).netloc,
                            category="world",
                            country="WORLD",
                            language="en",
                            published_at=parse_datetime_to_iso(it.get("published")),
                            summary=summary,
                            image_url=None,
                            provider="freshrss",
                            outlets_count=1,
                            reliability_score=0.88,
                            is_breaking=False,
                            raw_metadata={"freshrss_item_id": it.get("id")}
                        ))
                    return articles
                else:
                    self.health.consecutive_failures += 1
                    self.health.status = "degraded"
                    self.health.error_message = f"HTTP {res.status_code}"
                    return []
        except Exception as e:
            self.health.consecutive_failures += 1
            self.health.status = "degraded"
            self.health.error_message = str(e)
            return []
