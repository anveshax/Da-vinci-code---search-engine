"""
News Clusterer for ANVESHA Worldwide News Platform.
Groups multi-source articles covering the same global event into unified StoryClusters.
Identifies different publisher angles, key facts, and independent outlet counts.
"""
import hashlib
from typing import List, Dict, Set, Any
from datetime import datetime, timezone
from .models import NewsArticle, StoryCluster
from .news_deduplicator import normalize_title_tokens, title_similarity_ratio


class NewsClusterer:
    def __init__(self, clustering_threshold: float = 0.42):
        self.clustering_threshold = clustering_threshold

    def cluster_articles(self, articles: List[NewsArticle]) -> List[StoryCluster]:
        """
        Clusters articles by topical event.
        Returns a list of StoryClusters with primary article and related corroborating coverage.
        """
        if not articles:
            return []

        clusters: List[Dict[str, Any]] = []

        for art in articles:
            art_tokens = normalize_title_tokens(art.title)
            assigned_cluster = None

            for c in clusters:
                # Check similarity against cluster primary article or accumulated tokens
                cluster_tokens = c["tokens"]
                sim = title_similarity_ratio(art_tokens, cluster_tokens)

                # Same category and high semantic overlap indicates the same breaking event
                if sim >= self.clustering_threshold and (art.category == c["category"] or sim >= 0.55):
                    assigned_cluster = c
                    break

            if assigned_cluster:
                assigned_cluster["articles"].append(art)
                # Expand cluster tokens
                assigned_cluster["tokens"].update(art_tokens)
                if art.source_name not in assigned_cluster["participating_sources"]:
                    assigned_cluster["participating_sources"].append(art.source_name)
            else:
                clusters.append({
                    "primary": art,
                    "articles": [art],
                    "tokens": set(art_tokens),
                    "category": art.category,
                    "country": art.country,
                    "language": art.language,
                    "participating_sources": [art.source_name],
                })

        story_clusters: List[StoryCluster] = []
        for c in clusters:
            primary_art: NewsArticle = c["primary"]
            all_arts: List[NewsArticle] = c["articles"]
            related_arts = [a for a in all_arts if a.id != primary_art.id]

            # Calculate independent outlets
            independent_sources = set(a.source_domain for a in all_arts if a.source_domain)
            independent_count = max(len(independent_sources), primary_art.outlets_count)

            # Generate stable cluster ID
            cluster_id = f"cluster_{hashlib.md5(primary_art.title.lower().encode('utf-8')).hexdigest()[:16]}"
            for a in all_arts:
                a.cluster_id = cluster_id

            # Extract key reported facts from summaries
            key_facts = []
            if primary_art.summary:
                key_facts.append(primary_art.summary[:180])
            for rel in related_arts[:2]:
                if rel.summary and rel.summary[:180] not in key_facts:
                    key_facts.append(rel.summary[:180])

            story_clusters.append(StoryCluster(
                cluster_id=cluster_id,
                title=primary_art.title,
                primary_article=primary_art,
                related_articles=related_arts,
                outlets_count=independent_count,
                participating_sources=c["participating_sources"],
                key_facts=key_facts,
                conflicting_claims=[],
                category=primary_art.category,
                country=primary_art.country,
                language=primary_art.language,
                updated_at=datetime.now(timezone.utc).isoformat(),
            ))

        return story_clusters
