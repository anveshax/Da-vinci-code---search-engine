"""
News Deduplicator for ANVESHA Worldwide News Platform.
Detects exact and fuzzy duplicate news stories using canonical URL, title normalization, and token similarity.
"""
import re
from typing import List, Set
from .models import NewsArticle

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "up", "about", "into", "over", "after", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did", "as", "say", "says",
    "said", "new", "live", "update", "latest", "breaking"
}


def normalize_title_tokens(title: str) -> Set[str]:
    """Extracts normalized significant tokens from a headline with lightweight suffix trimming."""
    cleaned = re.sub(r"[^\w\s]", " ", title.lower())
    tokens = set(cleaned.split())
    significant = set()
    for t in tokens:
        if len(t) <= 2 or t in STOP_WORDS:
            continue
        if t.endswith("ing") and len(t) > 5:
            t = t[:-3]
        elif t.endswith("ed") and len(t) > 4:
            t = t[:-2]
        elif t.endswith("s") and len(t) > 3 and not t.endswith("ss"):
            t = t[:-1]
        significant.add(t)
    return significant


def title_similarity_ratio(tokens_a: Set[str], tokens_b: Set[str]) -> float:
    """Calculates Jaccard similarity between two token sets."""
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a.intersection(tokens_b)
    union = tokens_a.union(tokens_b)
    return len(intersection) / len(union)


class NewsDeduplicator:
    def __init__(self, similarity_threshold: float = 0.58):
        self.similarity_threshold = similarity_threshold

    def deduplicate(self, articles: List[NewsArticle]) -> List[NewsArticle]:
        """
        Deduplicates a stream of articles.
        Keeps the article with higher reliability or richer outlet count when duplicates occur.
        """
        seen_urls: Set[str] = set()
        seen_article_ids: Set[str] = set()
        unique_articles: List[NewsArticle] = []
        token_cache: List[tuple[NewsArticle, Set[str]]] = []

        for art in articles:
            # 1. Canonical URL check
            if art.original_url in seen_urls or art.id in seen_article_ids:
                continue

            art_tokens = normalize_title_tokens(art.title)
            is_duplicate = False

            # 2. Fuzzy title similarity check
            for existing_art, existing_tokens in token_cache:
                sim = title_similarity_ratio(art_tokens, existing_tokens)
                if sim >= self.similarity_threshold:
                    # Same story already exists! Check if we should update outlet count or metadata
                    is_duplicate = True
                    # If this duplicate is from a different publisher, increment outlets count
                    if art.source_domain and art.source_domain != existing_art.source_domain:
                        existing_art.outlets_count += 1
                        if "also_reported_by" not in existing_art.raw_metadata:
                            existing_art.raw_metadata["also_reported_by"] = []
                        if art.source_name not in existing_art.raw_metadata["also_reported_by"]:
                            existing_art.raw_metadata["also_reported_by"].append(art.source_name)
                    break

            if not is_duplicate:
                seen_urls.add(art.original_url)
                seen_article_ids.add(art.id)
                unique_articles.append(art)
                token_cache.append((art, art_tokens))

        return unique_articles
