"""
Hybrid Result Reranking & Near-Duplicate Elimination Engine for ANVESHA.

Provides:
1. Lightweight calibrated reranking combining BM25, semantic cosine similarity,
   title alignment, lexical query coverage, and acronym expansion.
2. Near-duplicate URL & passage detection using canonical URL normalization
   and token Jaccard similarity.
3. Provenance preservation: Retains raw BM25, semantic, and RRF scores.
"""
import re
import logging
from typing import List, Dict, Any, Optional

from engine.crawler.indexer import ENGLISH_STOPWORDS
from engine.semantic.vector_store import normalize_url_canonical

logger = logging.getLogger(__name__)

# Common acronym expansions to ensure high recall and precision on domain concepts
ACRONYM_EXPANSIONS = {
    "ai": {"artificial", "intelligence"},
    "ml": {"machine", "learning"},
    "dl": {"deep", "learning"},
    "nlp": {"natural", "language", "processing"},
    "os": {"operating", "system"},
    "db": {"database"},
    "api": {"application", "programming", "interface"},
    "ui": {"user", "interface"},
    "ux": {"user", "experience"},
    "rag": {"retrieval", "augmented", "generation"},
    "llm": {"large", "language", "model"},
}


class DocumentReranker:
    """
    Reranks candidate search hits to prioritize authoritative, contextually grounded,
    and non-redundant evidence for Gemini AI Overview generation.
    """

    def __init__(
        self,
        jaccard_dedup_threshold: float = 0.80,
        title_boost: float = 1.25,
        domain_authority_boost: float = 1.08,
        min_relevance_threshold: float = 0.15,
    ):
        self.jaccard_dedup_threshold = jaccard_dedup_threshold
        self.title_boost = title_boost
        self.domain_authority_boost = domain_authority_boost
        self.min_relevance_threshold = min_relevance_threshold

    def _tokenize(self, text: str) -> set:
        """Extracts lowercase alpha-numeric token set."""
        if not text:
            return set()
        return set(re.findall(r"\b[a-zA-Z0-9_\-]{2,}\b", text.lower()))

    def _jaccard_similarity(self, tokens_a: set, tokens_b: set) -> float:
        """Computes Jaccard similarity between two token sets."""
        if not tokens_a or not tokens_b:
            return 0.0
        intersection = len(tokens_a & tokens_b)
        union = len(tokens_a | tokens_b)
        return intersection / union if union > 0 else 0.0

    def rerank_hits(
        self,
        query: str,
        hits: List[Dict[str, Any]],
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Reranks a list of candidate hits, eliminating near-duplicate passages
        and assigning calibrated final reranking scores.
        """
        if not hits:
            return []

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return hits[:top_k]

        # Content tokens vs stopwords
        content_tokens = {t for t in query_tokens if t not in ENGLISH_STOPWORDS}
        eval_tokens = content_tokens if content_tokens else query_tokens

        # Expand acronyms for evaluation
        expanded_eval_tokens = set(eval_tokens)
        for token in eval_tokens:
            if token in ACRONYM_EXPANSIONS:
                expanded_eval_tokens.update(ACRONYM_EXPANSIONS[token])

        # Step 1: Canonical URL deduplication across candidates
        unique_by_url: List[Dict[str, Any]] = []
        seen_canon_urls = set()
        for h in hits:
            canon_key = normalize_url_canonical(h.get("url", ""), h.get("canonical_url"))
            if canon_key in seen_canon_urls:
                continue
            seen_canon_urls.add(canon_key)
            unique_by_url.append(h)

        # Normalize raw base scores to [0.0, 1.0]
        raw_scores = [float(h.get("score", 0.0)) for h in unique_by_url]
        max_base = max(raw_scores) if raw_scores and max(raw_scores) > 0 else 1.0
        min_base = min(raw_scores) if raw_scores else 0.0
        base_range = max(1e-5, max_base - min_base)

        scored_candidates: List[Dict[str, Any]] = []

        for h in unique_by_url:
            title = h.get("title", "")
            snippet = h.get("snippet", "")
            url = h.get("url", "")
            doc_all_text = f"{title} {snippet} {url}".lower()

            title_tokens = self._tokenize(title)
            snippet_tokens = self._tokenize(snippet)
            doc_tokens = title_tokens | snippet_tokens

            # Normalized base score [0.0, 1.0]
            raw_base = float(h.get("score", 0.0))
            norm_base_score = (raw_base - min_base) / base_range if base_range > 0 else 0.5

            # 2. Content token matching & coverage
            matched_content_in_title = len(expanded_eval_tokens & title_tokens) / len(expanded_eval_tokens) if expanded_eval_tokens else 0.0
            matched_content_in_snippet = len(expanded_eval_tokens & snippet_tokens) / len(expanded_eval_tokens) if expanded_eval_tokens else 0.0
            
            # Check for phrase match in title (e.g., query appears as exact substring)
            phrase_boost = 1.0
            q_clean = query.strip().lower()
            if q_clean in title.lower():
                phrase_boost = 1.35
            elif any(t in title.lower() for t in eval_tokens):
                phrase_boost = 1.15

            # Combined lexical coverage (prioritizing title relevance)
            lexical_coverage = (matched_content_in_title * 0.65) + (matched_content_in_snippet * 0.35)

            # Strict relevance gate: if document contains NONE of the content tokens or expansions,
            # it has zero topical relevance to the user's query
            has_any_content_match = bool(expanded_eval_tokens & doc_tokens) or any(
                re.search(r'\b' + re.escape(t) + r'\b', doc_all_text) for t in eval_tokens
            )

            if not has_any_content_match and content_tokens:
                # Off-topic document - drop score to near zero
                final_rerank_score = 0.01 * norm_base_score
                lexical_coverage = 0.0
            else:
                # 3. Domain Quality & Depth Signal
                domain_boost = 1.0
                domain = (h.get("source_domain", "") or h.get("domain", "")).lower()
                if any(tld in domain for tld in [".edu", ".gov", "wikipedia.org", "docs.", "developer."]):
                    domain_boost = self.domain_authority_boost

                # 4. Retrieval Method Prioritization (mild bonus for hybrid grounded index)
                method = h.get("retrieval_method", "web")
                method_boost = 1.08 if method == "hybrid" else (1.04 if method == "semantic" else 1.0)

                # Calibrated Final Rerank Score
                final_rerank_score = (
                    (norm_base_score * 0.30)
                    + (lexical_coverage * 0.70)
                ) * phrase_boost * domain_boost * method_boost

            updated_hit = dict(h)
            updated_hit["rerank_score"] = round(final_rerank_score, 4)
            updated_hit["query_coverage"] = round(lexical_coverage, 3)

            # Only retain candidates meeting minimum topical relevance threshold
            if final_rerank_score >= self.min_relevance_threshold or not content_tokens:
                scored_candidates.append(updated_hit)

        # Sort descending by rerank score
        scored_candidates.sort(key=lambda x: x["rerank_score"], reverse=True)

        # 5. Near-Duplicate Elimination using Jaccard Thresholding on snippets
        deduplicated: List[Dict[str, Any]] = []
        seen_token_sets: List[set] = []

        for candidate in scored_candidates:
            c_tokens = self._tokenize(candidate.get("snippet", ""))
            is_dup = False
            for accepted_tokens in seen_token_sets:
                if self._jaccard_similarity(c_tokens, accepted_tokens) >= self.jaccard_dedup_threshold:
                    is_dup = True
                    break

            if not is_dup:
                deduplicated.append(candidate)
                seen_token_sets.append(c_tokens)

            if len(deduplicated) >= top_k:
                break

        return deduplicated


# Global reranker instance
document_reranker = DocumentReranker()
