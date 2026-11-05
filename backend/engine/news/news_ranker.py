"""
News Ranker for ANVESHA Worldwide News Platform.
Ranks articles and clusters using recency decay, multi-source verification weight, and query relevance.
"""
import math
from datetime import datetime, timezone
from typing import List, Optional
from .models import NewsArticle, StoryCluster


def parse_iso_timestamp(ts: str) -> datetime:
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


class NewsRanker:
    def __init__(self, half_life_hours: float = 18.0):
        self.half_life_hours = half_life_hours

    def rank_articles(self, articles: List[NewsArticle], query: Optional[str] = None) -> List[NewsArticle]:
        """Ranks a list of NewsArticles by relevance, recency, and verification."""
        now = datetime.now(timezone.utc)
        query_terms = [t.lower() for t in query.split()] if query else []

        def _score(art: NewsArticle) -> float:
            # 1. Recency Score (Exponential Decay)
            pub_dt = parse_iso_timestamp(art.published_at)
            age_hours = max(0.0, (now - pub_dt).total_seconds() / 3600.0)
            recency = math.exp(-age_hours / self.half_life_hours)

            # 2. Multi-source Corroboration Boost
            outlets_boost = min(2.5, 1.0 + (math.log(max(1, art.outlets_count)) * 0.35))

            # 3. Reliability & Breaking Priority
            reliability = art.reliability_score
            breaking_boost = 1.35 if art.is_breaking else 1.0

            # 4. Search Query Relevance
            relevance_boost = 1.0
            if query_terms:
                title_lower = art.title.lower()
                summary_lower = art.summary.lower()
                matches = sum(1 for term in query_terms if term in title_lower) * 2.0
                matches += sum(1 for term in query_terms if term in summary_lower) * 0.8
                relevance_boost = 1.0 + (matches * 1.5)

            return recency * outlets_boost * reliability * breaking_boost * relevance_boost

        return sorted(articles, key=_score, reverse=True)

    def rank_clusters(self, clusters: List[StoryCluster], query: Optional[str] = None) -> List[StoryCluster]:
        """Ranks StoryClusters based on cluster size, recency of latest report, and relevance."""
        now = datetime.now(timezone.utc)
        query_terms = [t.lower() for t in query.split()] if query else []

        def _score(cluster: StoryCluster) -> float:
            pub_dt = parse_iso_timestamp(cluster.primary_article.published_at)
            age_hours = max(0.0, (now - pub_dt).total_seconds() / 3600.0)
            recency = math.exp(-age_hours / self.half_life_hours)

            cluster_size_boost = 1.0 + (min(5, len(cluster.related_articles)) * 0.25)
            outlets_boost = min(2.5, 1.0 + (math.log(max(1, cluster.outlets_count)) * 0.4))
            breaking_boost = 1.4 if cluster.primary_article.is_breaking else 1.0

            relevance_boost = 1.0
            if query_terms:
                title_lower = cluster.title.lower()
                matches = sum(1 for term in query_terms if term in title_lower) * 2.0
                relevance_boost = 1.0 + (matches * 1.5)

            return recency * cluster_size_boost * outlets_boost * breaking_boost * relevance_boost

        return sorted(clusters, key=_score, reverse=True)
