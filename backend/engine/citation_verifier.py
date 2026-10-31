"""
Source Quality Evaluation & Citation Grounding Verifier for ANVESHA.

Ensures that:
1. Sources are ranked by domain authority, freshness, and evidence completeness.
2. Citations in Gemini AI generated answers are verified against retrieved evidence.
3. Unsupported claims and hallucinations are detected and flagged.
"""
import re
import logging
from typing import List, Dict, Any, Tuple, Optional

from engine.crawler.indexer import ENGLISH_STOPWORDS

logger = logging.getLogger(__name__)


class CitationVerifier:
    """
    Evaluates source credibility and cross-verifies generated claims against retrieved passages.
    """

    AUTHORITATIVE_PATTERNS = [
        "docs.python.org",
        "developer.mozilla.org",
        "github.com",
        "wikipedia.org",
        ".gov",
        ".edu",
        "arxiv.org",
        "peps.python.org",
    ]

    def assess_source_quality(self, source: Dict[str, Any], query: Optional[str] = None) -> float:
        """
        Computes a credibility and quality score (0.0 to 1.0) based on domain authority,
        topical relevance, content depth, and freshness.
        """
        score = 0.5  # neutral baseline
        domain = (source.get("source_domain", "") or source.get("domain", "")).lower()
        snippet = source.get("snippet", "") or ""
        title = (source.get("title", "") or "").lower()

        # 1. Topical relevance check (if query is provided)
        is_topical = True
        if query:
            clean_words = set(re.findall(r"\b[a-zA-Z0-9_\-]{2,}\b", query.lower()))
            content_words = {w for w in clean_words if w not in ENGLISH_STOPWORDS}
            if content_words:
                source_text = f"{title} {domain} {snippet}".lower()
                has_content_match = any(
                    re.search(r'\b' + re.escape(w) + r'\b', source_text) if len(w) <= 3 else (w in source_text)
                    for w in content_words
                )
                if not has_content_match:
                    is_topical = False
                    score -= 0.35  # penalize off-topic sources

        # 2. Domain Authority (only granted if source is topical)
        if is_topical:
            if any(auth in domain for auth in self.AUTHORITATIVE_PATTERNS):
                score += 0.30
            elif any(tld in domain for tld in [".org", ".io", "dev."]):
                score += 0.15

        # 3. Content Completeness (penalize stub snippets < 50 chars)
        if len(snippet) > 200:
            score += 0.1
        elif len(snippet) < 60:
            score -= 0.2

        # 4. Internal verified index bonus (only if topical)
        if source.get("is_internal_index") and is_topical:
            score += 0.05

        return min(1.0, max(0.05, round(score, 2)))

    def extract_cited_indices(self, answer_text: str) -> List[int]:
        """Extracts bracketed citation numbers from generated text (e.g. [1], [2], [1, 2])."""
        if not answer_text:
            return []
        citations = []
        matches = re.findall(r"\[(\d+(?:,\s*\d+)*)\]", answer_text)
        for m in matches:
            for num_str in m.split(","):
                try:
                    citations.append(int(num_str.strip()))
                except ValueError:
                    continue
        return sorted(list(set(citations)))

    def verify_answer_grounding(
        self,
        answer_text: str,
        sources: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Verifies citations in generated text against available evidence sources.
        Flags ungrounded claims and invalid citation indices.
        """
        if not answer_text or not sources:
            return {
                "verified": False,
                "grounding_score": 0.0,
                "valid_citations_count": 0,
                "unsupported_citations": [],
                "quality_tier": "insufficient_evidence",
            }

        cited_indices = self.extract_cited_indices(answer_text)
        total_sources = len(sources)

        valid_citations = []
        unsupported_citations = []

        for idx in cited_indices:
            if 1 <= idx <= total_sources:
                valid_citations.append(idx)
            else:
                unsupported_citations.append(idx)

        # Lexical overlap between answer and evidence
        answer_words = set(re.findall(r"\b\w{4,}\b", answer_text.lower()))
        combined_evidence = " ".join(s.get("snippet", "") for s in sources).lower()
        evidence_words = set(re.findall(r"\b\w{4,}\b", combined_evidence))

        overlap = len(answer_words & evidence_words)
        grounding_ratio = overlap / len(answer_words) if answer_words else 0.0

        # Adjust score by citation validity
        citation_penalty = len(unsupported_citations) * 0.15
        final_grounding_score = max(0.0, min(1.0, round(grounding_ratio - citation_penalty, 2)))

        tier = "highly_grounded" if final_grounding_score >= 0.65 else (
            "moderately_grounded" if final_grounding_score >= 0.4 else "weakly_grounded"
        )

        return {
            "verified": len(unsupported_citations) == 0 and final_grounding_score >= 0.4,
            "grounding_score": final_grounding_score,
            "valid_citations_count": len(valid_citations),
            "unsupported_citations": unsupported_citations,
            "quality_tier": tier,
        }


# Global verifier instance
citation_verifier = CitationVerifier()
