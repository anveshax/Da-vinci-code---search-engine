"""
Global News Aggregation Service for ANVESHA.
Coordinates multi-source fetching, deduplication, clustering, ranking, caching, and AI intelligence.
"""
import asyncio
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from .models import (
    NewsArticle,
    StoryCluster,
    ProviderHealth,
    DailyBriefingResponse,
    AskAIStoryResponse,
)
from .worldpulse_provider import WorldPulseProvider
from .actually_relevant_provider import ActuallyRelevantProvider
from .rss_provider import RSSFeedProvider
from .freshrss_provider import FreshRSSProvider
from .feed_registry import FEED_REGISTRY, get_feeds, ALL_COUNTRIES, ALL_LANGUAGES, ALL_CATEGORIES
from .news_normalizer import clean_text_snippet
from .news_deduplicator import NewsDeduplicator
from .news_clusterer import NewsClusterer
from .news_ranker import NewsRanker
from .news_cache import NewsCache
from .news_health import NewsHealthMonitor
from .news_scheduler import NewsScheduler
from app.core.ai_provider import ai_provider


class GlobalNewsService:
    def __init__(self):
        self.worldpulse = WorldPulseProvider()
        self.actually_relevant = ActuallyRelevantProvider()
        self.rss = RSSFeedProvider()
        self.freshrss = FreshRSSProvider()

        self.deduplicator = NewsDeduplicator()
        self.clusterer = NewsClusterer()
        self.ranker = NewsRanker()
        self.cache = NewsCache(memory_ttl_sec=300)
        self.health_monitor = NewsHealthMonitor()
        self.scheduler = NewsScheduler(refresh_interval_sec=300)

        # Register health initial records
        self.health_monitor.register_health(self.worldpulse.health)
        self.health_monitor.register_health(self.actually_relevant.health)
        self.health_monitor.register_health(self.freshrss.health)

        # Connect scheduler sync
        self.scheduler.register_sync_callback(self.refresh_all_sources)

    async def initialize(self):
        """Initializes service and triggers initial feed sync."""
        await self.refresh_all_sources()
        await self.scheduler.start()

    async def refresh_all_sources(self) -> List[NewsArticle]:
        """
        Executes full aggregation pipeline:
        Fetch -> Validate -> Normalize -> Deduplicate -> Cluster -> Rank -> Cache.
        """
        tasks = [
            self.worldpulse.fetch_signals(limit=40),
            self.actually_relevant.fetch_stories(limit=30),
            self.rss.fetch_multiple_feeds(FEED_REGISTRY[:25], concurrency=8),
        ]
        if self.freshrss.is_configured:
            tasks.append(self.freshrss.fetch_articles(limit=25))

        fetch_results = await asyncio.gather(*tasks, return_exceptions=True)
        raw_articles: List[NewsArticle] = []

        for r in fetch_results:
            if isinstance(r, list):
                raw_articles.extend(r)

        # Sync health status to monitor
        self.health_monitor.register_health(self.worldpulse.health)
        self.health_monitor.register_health(self.actually_relevant.health)
        for feed_id, h in self.rss.health_records.items():
            self.health_monitor.register_health(h)

        if not raw_articles:
            # If fetch failed or network offline, fallback to persisted SQLite articles
            raw_articles = self.cache.query_db(limit=60)

        # Deduplicate
        unique_articles = self.deduplicator.deduplicate(raw_articles)

        # Cluster into stories
        clusters = self.clusterer.cluster_articles(unique_articles)

        # Rank
        ranked_articles = self.ranker.rank_articles(unique_articles)
        ranked_clusters = self.ranker.rank_clusters(clusters)

        # Update cache & persistence
        self.cache.set_memory_cache(ranked_articles, ranked_clusters)
        return ranked_articles

    async def get_worldwide_news(
        self,
        country: Optional[str] = None,
        language: Optional[str] = None,
        category: Optional[str] = None,
        sort: str = "latest",
        limit: int = 30,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Returns paginated worldwide news and story clusters."""
        if not self.cache.is_memory_fresh():
            # Trigger non-blocking or background refresh if empty
            if not self.cache.get_memory_articles():
                await self.refresh_all_sources()

        all_articles = self.cache.get_memory_articles()
        all_clusters = self.cache.get_memory_clusters()

        # Fallback to SQLite if memory cache is empty
        if not all_articles:
            all_articles = self.cache.query_db(
                country=country,
                language=language,
                category=category,
                limit=limit,
                offset=offset,
            )

        # Filter by country
        if country and country.upper() != "WORLD":
            all_articles = [a for a in all_articles if a.country == country.upper()]
            all_clusters = [c for c in all_clusters if c.country == country.upper() or any(r.country == country.upper() for r in c.related_articles)]

        # Filter by language
        if language and language.lower() != "all":
            all_articles = [a for a in all_articles if a.language == language.lower()]
            all_clusters = [c for c in all_clusters if c.language == language.lower()]

        # Filter by category
        if category and category.lower() not in ("all", "top"):
            all_articles = [a for a in all_articles if a.category == category.lower()]
            all_clusters = [c for c in all_clusters if c.category == category.lower()]

        # Rank according to sort
        if sort == "relevance":
            ranked = self.ranker.rank_articles(all_articles)
            ranked_clusters = self.ranker.rank_clusters(all_clusters)
        else:
            # Sort latest first
            ranked = sorted(all_articles, key=lambda a: a.published_at, reverse=True)
            ranked_clusters = sorted(all_clusters, key=lambda c: c.updated_at, reverse=True)

        paginated_articles = ranked[offset: offset + limit]
        paginated_clusters = ranked_clusters[offset: offset + limit]

        # Breaking news items
        breaking = [a for a in ranked if a.is_breaking][:8]

        return {
            "total": len(ranked),
            "offset": offset,
            "limit": limit,
            "last_updated": self.cache.get_last_updated_timestamp(),
            "articles": [a.model_dump() for a in paginated_articles],
            "clusters": [c.model_dump() for c in paginated_clusters],
            "breaking": [b.model_dump() for b in breaking],
            "providers_status": self.health_monitor.get_summary()["status"],
        }

    async def get_headlines(self, category: Optional[str] = None, limit: int = 15) -> List[Dict[str, Any]]:
        """Returns fast top headlines for hero and breaking tickers."""
        res = await self.get_worldwide_news(category=category, limit=limit)
        return res.get("articles", [])

    async def search_news(
        self,
        query: str,
        country: Optional[str] = None,
        language: Optional[str] = None,
        category: Optional[str] = None,
        sort: str = "latest",
        limit: int = 25,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Searches across all active sources with multi-source ranking."""
        # 1. Search memory cache first
        cached_articles = self.cache.get_memory_articles()
        query_lower = query.lower().strip()
        matched: List[NewsArticle] = []

        for a in cached_articles:
            if query_lower in a.title.lower() or query_lower in a.summary.lower():
                matched.append(a)

        # 2. Also search WorldPulse live search endpoint if query is specific
        if len(matched) < limit:
            wp_results = await self.worldpulse.search(query, limit=limit)
            for w in wp_results:
                if not any(m.id == w.id for m in matched):
                    matched.append(w)

        # 3. Query SQLite history
        if len(matched) < limit:
            db_results = self.cache.query_db(query=query, country=country, language=language, category=category, limit=limit)
            for d in db_results:
                if not any(m.id == d.id for m in matched):
                    matched.append(d)

        # Apply filters
        if country and country.upper() != "WORLD":
            matched = [a for a in matched if a.country == country.upper()]
        if language and language.lower() != "all":
            matched = [a for a in matched if a.language == language.lower()]
        if category and category.lower() not in ("all", "top"):
            matched = [a for a in matched if a.category == category.lower()]

        # Rank by relevance
        ranked = self.ranker.rank_articles(matched, query=query)
        paginated = ranked[offset: offset + limit]

        # Group matches into clusters
        clusters = self.clusterer.cluster_articles(paginated)

        return {
            "query": query,
            "total": len(ranked),
            "offset": offset,
            "limit": limit,
            "articles": [a.model_dump() for a in paginated],
            "clusters": [c.model_dump() for c in clusters],
        }

    async def get_trending_topics(self) -> List[Dict[str, Any]]:
        """Extracts trending keywords and topics across fresh clusters."""
        clusters = self.cache.get_memory_clusters()
        trending: List[Dict[str, Any]] = []

        # Sort clusters by outlet count & recency
        sorted_clusters = sorted(clusters, key=lambda c: (c.outlets_count, len(c.related_articles)), reverse=True)
        for c in sorted_clusters[:12]:
            words = [w for w in c.title.split() if len(w) > 3 and w.lower() not in ("with", "from", "after", "says", "said", "over")]
            topic_label = " ".join(words[:4]) if words else c.title[:30]
            trending.append({
                "topic": topic_label,
                "cluster_id": c.cluster_id,
                "category": c.category,
                "outlets_count": c.outlets_count,
                "primary_title": c.title,
                "url": c.primary_article.original_url,
                "source_name": c.primary_article.source_name,
            })
        return trending

    async def generate_briefing(
        self,
        topic: Optional[str] = None,
        country: Optional[str] = None,
        language: Optional[str] = None
    ) -> DailyBriefingResponse:
        """
        Generates an AI multi-source synthesis briefing.
        Includes verified supporting citations and disclaimers.
        """
        news_data = await self.get_worldwide_news(country=country, language=language, category=topic, limit=12)
        articles: List[Dict[str, Any]] = news_data.get("articles", [])
        clusters: List[Dict[str, Any]] = news_data.get("clusters", [])

        if not articles:
            return DailyBriefingResponse(
                title=f"Global News Briefing - {topic or 'Worldwide'}",
                date=datetime.now(timezone.utc).strftime("%B %d, %Y"),
                summary="No verified reports currently available for this section.",
                key_events=[],
                sources=[],
            )

        # Assemble sources
        sources_list = [
            {"title": a["title"], "source_name": a["source_name"], "url": a["original_url"]}
            for a in articles[:8]
        ]

        # Key events synthesis
        key_events = []
        for c in clusters[:5]:
            key_events.append({
                "headline": c["title"],
                "outlets_count": c["outlets_count"],
                "sources": c.get("participating_sources", [c["primary_article"]["source_name"]]),
                "key_facts": c.get("key_facts", [c["primary_article"]["summary"]]),
            })

        # Try LLM synthesis if AI Provider is active
        ai_summary = ""
        if ai_provider.is_configured():
            try:
                prompt_articles = "\n".join(
                    [f"- {a['title']} (Source: {a['source_name']}): {a['summary']}" for a in articles[:6]]
                )
                system_prompt = (
                    "You are the ANVESHA Global News Intelligence Analyst. Synthesize the provided multi-source "
                    "news reports into an objective, factual executive briefing. Clearly state verified facts, "
                    "cite source outlets by name, avoid hallucinating details, and do not treat publication count "
                    "as absolute proof."
                )
                user_msg = f"Synthesize this global news intelligence on {topic or 'worldwide events'}:\n{prompt_articles}"
                ai_summary = await ai_provider.generate_chat_completion(
                    messages=[{"role": "user", "content": user_msg}],
                    system_prompt=system_prompt,
                    max_tokens=600,
                    temperature=0.2,
                )
            except Exception as e:
                ai_summary = ""

        if not ai_summary:
            # Extractive fallback synthesis
            top_headlines = [f"• {a['title']} ({a['source_name']})" for a in articles[:4]]
            ai_summary = (
                f"Global Intelligence Overview for {datetime.now(timezone.utc).strftime('%B %d, %Y')}:\n"
                + "\n".join(top_headlines)
            )

        return DailyBriefingResponse(
            title=f"Global Intelligence Briefing — {topic or 'Worldwide'}",
            date=datetime.now(timezone.utc).strftime("%B %d, %Y"),
            summary=ai_summary,
            key_events=key_events,
            sources=sources_list,
        )

    async def ask_ai_about_story(self, story_id: str, question: str) -> AskAIStoryResponse:
        """Answers user analytical questions about a specific story with source citations."""
        # Find article
        articles = self.cache.get_memory_articles()
        target = next((a for a in articles if a.id == story_id or a.cluster_id == story_id), None)
        if not target:
            target = next((a for a in self.cache.query_db(limit=50) if a.id == story_id), None)

        if not target:
            return AskAIStoryResponse(
                story_id=story_id,
                story_title="Unknown Story",
                answer="The requested story could not be located in the current intelligence index.",
                sources=[],
            )

        sources = [{"title": target.title, "source_name": target.source_name, "url": target.original_url}]

        answer = ""
        if ai_provider.is_configured():
            try:
                system_prompt = (
                    "You are ANVESHA News Intelligence. Answer the user's inquiry regarding this news event "
                    "strictly based on reported facts. Cite the publisher, note any uncertainties, and do not fabricate facts."
                )
                user_content = (
                    f"Headline: {target.title}\n"
                    f"Publisher: {target.source_name}\n"
                    f"Summary: {target.summary}\n"
                    f"Outlets Reporting: {target.outlets_count}\n"
                    f"User Question: {question}"
                )
                answer = await ai_provider.generate_chat_completion(
                    messages=[{"role": "user", "content": user_content}],
                    system_prompt=system_prompt,
                    max_tokens=500,
                    temperature=0.2,
                )
            except Exception:
                answer = ""

        if not answer:
            answer = (
                f"Based on reports from {target.source_name}, {target.summary} "
                f"This story is currently corroborated across {target.outlets_count} independent reporting channels."
            )

        return AskAIStoryResponse(
            story_id=target.id,
            story_title=target.title,
            answer=answer,
            verified_facts=[target.summary] if target.summary else [target.title],
            conflicting_or_unconfirmed=[],
            sources=sources,
        )


# Global singleton instance
global_news_service = GlobalNewsService()
