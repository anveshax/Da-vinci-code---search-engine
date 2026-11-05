"""
Actually Relevant Public API Provider for ANVESHA.
Fetches high-relevance synthesized stories and incremental updates without API keys.
Docs: https://actuallyrelevant.news/developers
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

ACTUALLY_RELEVANT_BASE = "https://api.actuallyrelevant.news"


class ActuallyRelevantProvider:
    def __init__(self, timeout: float = 8.0):
        self.timeout = timeout
        self.health = ProviderHealth(
            source_id="actually_relevant",
            source_name="Actually Relevant Public API",
            provider="actually_relevant",
            status="healthy",
        )

    async def fetch_stories(
        self,
        published_since: Optional[str] = None,
        min_relevance: int = 5,
        limit: int = 25
    ) -> List[NewsArticle]:
        """Fetches latest curated stories with optional incremental sync."""
        url = f"{ACTUALLY_RELEVANT_BASE}/api/stories"
        params: Dict[str, Any] = {
            "minRelevance": min_relevance,
            "pageSize": min(limit, 40),
        }
        if published_since:
            params["publishedSince"] = published_since

        start_time = time.time()
        self.health.last_attempt_at = parse_datetime_to_iso(time.time())

        try:
            client = get_shared_client()
            res = await client.get(url, params=params, headers={"User-Agent": "ANVESHA-GlobalNews/1.0"}, timeout=self.timeout)
            self.health.response_time_ms = round((time.time() - start_time) * 1000, 2)

            if res.status_code == 200:
                data = res.json()
                stories = data.get("data", [])
                self.health.status = "healthy"
                self.health.last_success_at = parse_datetime_to_iso(time.time())
                self.health.consecutive_failures = 0
                self.health.error_message = None

                return [self._to_article(item) for item in stories]
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

    def _to_article(self, item: Dict[str, Any]) -> NewsArticle:
        raw_url = item.get("sourceUrl") or f"https://actuallyrelevant.news/stories/{item.get('slug', item.get('id'))}"
        canon_url = canonicalize_url(raw_url)
        title = item.get("title") or item.get("sourceTitle") or "Untitled Story"
        art_id = generate_article_id(canon_url, title)

        # Source attribution
        feed_info = item.get("feed") or {}
        source_name = feed_info.get("displayTitle") or feed_info.get("title") or item.get("sourceTitle") or "Actually Relevant"
        source_domain = urlparse(canon_url).netloc or "actuallyrelevant.news"

        # Categorization based on issues & labels
        issue_name = item.get("issue", {}).get("name") or item.get("titleLabel") or "world"
        category = map_category_slug(issue_name)

        summary = clean_text_snippet(item.get("summary") or item.get("relevanceSummary") or "")
        relevance_score = min(1.0, max(0.5, float(item.get("relevance", 7)) / 10.0))

        return NewsArticle(
            id=art_id,
            title=title.strip(),
            original_url=canon_url,
            source_name=source_name.strip(),
            source_domain=source_domain,
            category=category,
            country="WORLD",
            language="en",
            published_at=parse_datetime_to_iso(item.get("datePublished") or item.get("dateCrawled")),
            summary=summary,
            image_url=item.get("imageUrl") or item.get("image") or item.get("thumbnail") or None,
            provider="actually_relevant",
            outlets_count=1,
            reliability_score=relevance_score,
            is_breaking=bool(item.get("relevance", 0) >= 9),
            raw_metadata={
                "slug": item.get("slug"),
                "relevanceReasons": item.get("relevanceReasons"),
                "quote": item.get("quote"),
                "quoteAttribution": item.get("quoteAttribution"),
                "emotionTag": item.get("emotionTag"),
                "issue": issue_name,
            }
        )
