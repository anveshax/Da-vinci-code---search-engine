"""
SearXNG Integration Client & Provider Adapter for ANVESHA.

Connects to an independent SearXNG instance over HTTP JSON API (/search?q=...&format=json).
Respects AGPL-3.0 licensing boundaries by treating SearXNG as an isolated external network microservice.
Provides automatic result normalization, engine attribution, health checks,
and fallback to DuckDuckGo when SearXNG is unreachable.
"""
import os
import time
import asyncio
import logging
from typing import List, Dict, Any, Optional
import httpx

from engine.web_search import validate_and_sanitize_url, extract_source_domain

logger = logging.getLogger(__name__)


class SearXNGClient:
    """
    Client adapter for independent SearXNG instances.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 4.0,
        max_retries: int = 2,
    ):
        self.base_url = (base_url or os.getenv("SEARXNG_URL", "http://localhost:8080")).rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries

    async def check_health(self) -> Dict[str, Any]:
        """Validates connectivity to the SearXNG JSON endpoint."""
        url = f"{self.base_url}/search"
        params = {"q": "ping", "format": "json"}
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "status": "healthy",
                        "provider": "searxng",
                        "url": self.base_url,
                        "engines_active": len(data.get("engines", [])),
                        "message": "Connected to independent SearXNG instance.",
                    }
                return {
                    "status": "degraded",
                    "provider": "searxng",
                    "url": self.base_url,
                    "http_status": res.status_code,
                    "message": f"SearXNG returned HTTP {res.status_code}.",
                }
        except Exception as exc:
            return {
                "status": "offline",
                "provider": "searxng",
                "url": self.base_url,
                "error": str(exc),
                "message": "SearXNG service is offline or unreachable. DuckDuckGo fallback active.",
            }

    async def search(
        self,
        query: str,
        categories: str = "general",
        max_results: int = 8,
        page: int = 1,
        time_range: Optional[str] = None,
        safesearch: int = 0,
    ) -> Dict[str, Any]:
        """
        Executes query against SearXNG JSON API and normalizes results into ANVESHA format.
        Supports categories, pagination, time filters, and safesearch.
        """
        clean_query = query.strip()
        if not clean_query:
            return {"results": [], "query": query, "provider": "searxng"}

        url = f"{self.base_url}/search"
        params: Dict[str, Any] = {
            "q": clean_query,
            "format": "json",
            "categories": categories,
            "pageno": max(1, page),
        }
        if time_range:
            params["time_range"] = time_range
        if safesearch:
            params["safesearch"] = safesearch

        last_error = None
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(url, params=params)

                if response.status_code == 200:
                    data = response.json()
                    raw_results = data.get("results", [])

                    normalized: List[Dict[str, Any]] = []
                    seen_urls = set()

                    for item in raw_results:
                        raw_url = item.get("url", "")
                        safe_url = validate_and_sanitize_url(raw_url)
                        if not safe_url or safe_url in seen_urls:
                            continue
                        seen_urls.add(safe_url)

                        domain = extract_source_domain(safe_url)
                        snippet = item.get("content", "") or item.get("snippet", "")
                        title = item.get("title", "") or domain
                        engine = item.get("engine", "searxng")

                        normalized.append({
                            "title": title.strip(),
                            "url": safe_url,
                            "source_domain": domain,
                            "snippet": snippet.strip(),
                            "score": float(item.get("score", 1.0)),
                            "engine": engine,
                            "source": f"SearXNG ({engine})",
                            "is_internal_index": False,
                            "retrieval_method": "searxng",
                            "published_date": item.get("publishedDate"),
                        })

                        if len(normalized) >= max_results:
                            break

                    return {
                        "results": normalized,
                        "query": clean_query,
                        "provider": "searxng",
                        "total_returned": len(normalized),
                        "page": page,
                    }

                elif response.status_code in (429, 503):
                    last_error = f"SearXNG status {response.status_code}"
                    await asyncio.sleep(0.5)
                    continue
                else:
                    last_error = f"SearXNG status {response.status_code}"
                    break

            except httpx.RequestError as exc:
                last_error = str(exc)
                break

        logger.info(f"SearXNG unavailable ({last_error}). Falling back to primary web search providers.")
        from engine.web_search import execute_web_search
        return await asyncio.to_thread(
            execute_web_search,
            clean_query,
            max_results=max_results,
            page=page,
            category=categories,
        )


# Global singleton SearXNG client
searxng_client = SearXNGClient()
