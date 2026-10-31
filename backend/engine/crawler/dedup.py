"""
Deduplication Engine for ANVESHA Web Crawler.

Performs URL-level, Canonical-URL, Exact Content Hash (SHA-256),
and Near-Duplicate Similarity Detection.
"""
from typing import Tuple, Optional, Set
import re

MULTI_SPACE = re.compile(r"\s+")


def compute_shingles(text: str, k: int = 3) -> Set[str]:
    """Generates k-shingles (word n-grams) for near-duplicate Jaccard comparison."""
    words = MULTI_SPACE.split(text.lower().strip())
    if len(words) < k:
        return set(words)
    return {" ".join(words[i:i+k]) for i in range(len(words) - k + 1)}


def jaccard_similarity(set_a: Set[str], set_b: Set[str]) -> float:
    """Computes Jaccard index between two shingle sets."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return float(intersection) / float(union) if union > 0 else 0.0


class DeduplicationEngine:
    """
    Evaluates new documents against existing index to prevent duplicate indexing.
    """

    @staticmethod
    def is_exact_duplicate(new_hash: str, existing_hash: Optional[str]) -> bool:
        """Compares SHA-256 content hashes."""
        if not new_hash or not existing_hash:
            return False
        return new_hash == existing_hash

    @staticmethod
    def is_near_duplicate(text_a: str, text_b: str, threshold: float = 0.85) -> Tuple[bool, float]:
        """
        Calculates whether two documents are near duplicates using 3-word shingles.
        Returns (is_near_dup, similarity_score).
        """
        shingles_a = compute_shingles(text_a, k=3)
        shingles_b = compute_shingles(text_b, k=3)
        sim = jaccard_similarity(shingles_a, shingles_b)
        return (sim >= threshold), sim
