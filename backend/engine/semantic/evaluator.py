"""
Relevance & Retrieval Quality Evaluation Framework for ANVESHA.

Measures and compares:
- BM25-only Keyword Retrieval
- Semantic-only Dense Vector Retrieval
- Hybrid Reciprocal Rank Fusion (RRF) Retrieval

Computes:
- Precision@K
- Recall@K
- MRR (Mean Reciprocal Rank)
- NDCG@K (Normalized Discounted Cumulative Gain)
- Average Retrieval Latency (ms)
"""
import time
import math
import logging
from typing import List, Dict, Any, Set, Optional
from dataclasses import dataclass

from engine.crawler.indexer import crawler_indexer
from engine.semantic.vector_store import vector_store
from engine.semantic.hybrid_retriever import hybrid_retriever

logger = logging.getLogger(__name__)


@dataclass
class EvaluationTestCase:
    id: str
    query: str
    category: str
    expected_domains_or_urls: List[str]
    description: str


# Comprehensive 8-category test suite
BENCHMARK_TEST_CASES: List[EvaluationTestCase] = [
    EvaluationTestCase(
        id="case_1_exact_keyword",
        query="Python built-ins reference",
        category="exact_keyword",
        expected_domains_or_urls=["builtins", "reference"],
        description="Exact keyword query matching page titles directly",
    ),
    EvaluationTestCase(
        id="case_2_semantic_paraphrase",
        query="How can I keep different Python projects packages separate?",
        category="semantic_paraphrase",
        expected_domains_or_urls=["howto", "tutorial", "venv"],
        description="Semantic phrasing with zero keyword match for virtual environments",
    ),
    EvaluationTestCase(
        id="case_3_short_query",
        query="PEP 8",
        category="short_query",
        expected_domains_or_urls=["howto", "tutorial", "whatsnew"],
        description="Short query containing acronyms and version numbers",
    ),
    EvaluationTestCase(
        id="case_4_long_natural_question",
        query="Where can I read the full historical background and software license of the Python programming language?",
        category="long_natural_question",
        expected_domains_or_urls=["license"],
        description="Long natural-language interrogative question",
    ),
    EvaluationTestCase(
        id="case_5_technical_documentation",
        query="standard type hierarchy numbers sequences mappings",
        category="technical_documentation",
        expected_domains_or_urls=["reference", "builtins", "introduction"],
        description="Technical conceptual terminology from language specification",
    ),
    EvaluationTestCase(
        id="case_6_abbreviations",
        query="GIL free threading Python 3.15",
        category="abbreviations",
        expected_domains_or_urls=["whatsnew", "3.15"],
        description="Modern technical abbreviations and release version tokens",
    ),
    EvaluationTestCase(
        id="case_7_ambiguous_intent",
        query="Python setup",
        category="ambiguous_intent",
        expected_domains_or_urls=["howto", "tutorial", "introduction"],
        description="Ambiguous multi-intent query spanning tutorials and installations",
    ),
    EvaluationTestCase(
        id="case_8_out_of_corpus",
        query="quantum mechanics schrodinger wave equation helium atom",
        category="out_of_corpus",
        expected_domains_or_urls=[],
        description="Query with no relevant documentation in index (negative test)",
    ),
]


def is_hit_relevant(url: str, title: str, expected_tokens: List[str]) -> bool:
    """Checks whether a retrieved URL or title matches expected ground-truth tokens."""
    if not expected_tokens:
        return False
    lower_url = (url or "").lower()
    lower_title = (title or "").lower()
    return any(token.lower() in lower_url or token.lower() in lower_title for token in expected_tokens)


def compute_precision_at_k(hits: List[Any], expected_tokens: List[str], k: int = 5) -> float:
    """Computes Precision@K: Fraction of top-K results that are relevant."""
    if not expected_tokens:
        # Negative query: 0 results returned is considered 1.0 precision
        return 1.0 if len(hits) == 0 else 0.0
    top_k = hits[:k]
    if not top_k:
        return 0.0
    relevant_count = sum(1 for h in top_k if is_hit_relevant(getattr(h, "url", ""), getattr(h, "title", ""), expected_tokens))
    return relevant_count / len(top_k)


def compute_recall_at_k(hits: List[Any], expected_tokens: List[str], k: int = 5) -> float:
    """Computes Recall@K: Did top-K retrieve at least one relevant document?"""
    if not expected_tokens:
        return 1.0 if len(hits) == 0 else 1.0
    top_k = hits[:k]
    for h in top_k:
        if is_hit_relevant(getattr(h, "url", ""), getattr(h, "title", ""), expected_tokens):
            return 1.0
    return 0.0


def compute_reciprocal_rank(hits: List[Any], expected_tokens: List[str]) -> float:
    """Computes Reciprocal Rank (1 / rank of first relevant item)."""
    if not expected_tokens:
        return 1.0 if len(hits) == 0 else 0.0
    for idx, h in enumerate(hits):
        if is_hit_relevant(getattr(h, "url", ""), getattr(h, "title", ""), expected_tokens):
            return 1.0 / (idx + 1)
    return 0.0


def compute_ndcg_at_k(hits: List[Any], expected_tokens: List[str], k: int = 5) -> float:
    """
    Computes Normalized Discounted Cumulative Gain at K (NDCG@K).
    Strictly mathematically normalized within [0.0, 1.0].
    """
    if not expected_tokens:
        # Negative / out-of-corpus query: 1.0 if no hits or zero relevant items, 0.0 otherwise
        rel_in_top_k = sum(1 for h in hits[:k] if is_hit_relevant(getattr(h, "url", ""), getattr(h, "title", ""), expected_tokens))
        return 1.0 if rel_in_top_k == 0 else 0.0

    top_k = hits[:k]
    if not top_k:
        return 0.0

    dcg = 0.0
    rel_count = 0
    for idx, h in enumerate(top_k):
        rel = 1.0 if is_hit_relevant(getattr(h, "url", ""), getattr(h, "title", ""), expected_tokens) else 0.0
        if rel > 0.0:
            rel_count += 1
            dcg += rel / math.log2(idx + 2)

    if rel_count == 0 or dcg <= 0.0:
        return 0.0

    # Ideal DCG: Places all relevant items at highest ranks 0 .. rel_count - 1
    idcg = sum(1.0 / math.log2(i + 2) for i in range(min(rel_count, k)))
    if idcg <= 0.0:
        return 0.0

    ndcg = dcg / idcg
    return min(1.0, max(0.0, round(ndcg, 4)))


def compute_percentile(data: List[float], percentile: float) -> float:
    """Computes nearest-rank percentile for latency metrics."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    idx = int(math.ceil((percentile / 100.0) * len(sorted_data))) - 1
    idx = max(0, min(idx, len(sorted_data) - 1))
    return round(sorted_data[idx], 2)


class SearchRelevanceEvaluator:
    """Automated benchmark evaluator comparing BM25, Semantic, and Hybrid retrieval."""

    def __init__(self, test_cases: Optional[List[EvaluationTestCase]] = None):
        self.test_cases = test_cases or BENCHMARK_TEST_CASES

    def run_benchmark(self, k: int = 5) -> Dict[str, Any]:
        """
        Executes benchmark across BM25, Semantic, and Hybrid retrieval.
        Returns detailed per-query metrics and aggregate comparative scores.
        """
        methods = ["bm25", "semantic", "hybrid"]
        metrics_by_method: Dict[str, Dict[str, List[float]]] = {
            m: {"precision": [], "recall": [], "mrr": [], "ndcg": [], "latency_ms": []}
            for m in methods
        }

        detailed_results: List[Dict[str, Any]] = []

        for case in self.test_cases:
            query = case.query
            expected = case.expected_domains_or_urls

            case_detail: Dict[str, Any] = {
                "id": case.id,
                "query": query,
                "category": case.category,
                "methods": {},
            }

            # 1. BM25 Search
            t0 = time.time()
            bm25_hits = crawler_indexer.search(query=query, limit=k)
            t_bm25 = (time.time() - t0) * 1000

            # 2. Semantic Search
            t0 = time.time()
            semantic_hits = vector_store.search(query=query, limit=k)
            t_sem = (time.time() - t0) * 1000

            # 3. Hybrid RRF Search
            t0 = time.time()
            hybrid_hits = hybrid_retriever.search_sync(query=query, limit=k)
            t_hybrid = (time.time() - t0) * 1000

            runs = [
                ("bm25", bm25_hits, t_bm25),
                ("semantic", semantic_hits, t_sem),
                ("hybrid", hybrid_hits, t_hybrid),
            ]

            for m_name, hits, lat in runs:
                p = compute_precision_at_k(hits, expected, k=k)
                r = compute_recall_at_k(hits, expected, k=k)
                mrr = compute_reciprocal_rank(hits, expected)
                ndcg = compute_ndcg_at_k(hits, expected, k=k)

                metrics_by_method[m_name]["precision"].append(p)
                metrics_by_method[m_name]["recall"].append(r)
                metrics_by_method[m_name]["mrr"].append(mrr)
                metrics_by_method[m_name]["ndcg"].append(ndcg)
                metrics_by_method[m_name]["latency_ms"].append(lat)

                case_detail["methods"][m_name] = {
                    "hits_count": len(hits),
                    "top_title": hits[0].title if hits else "None",
                    "precision_at_k": round(p, 4),
                    "recall_at_k": round(r, 4),
                    "mrr": round(mrr, 4),
                    "ndcg_at_k": round(ndcg, 4),
                    "latency_ms": round(lat, 2),
                }

            detailed_results.append(case_detail)

        # Aggregate averages
        aggregates: Dict[str, Dict[str, float]] = {}
        for m in methods:
            p_list = metrics_by_method[m]["precision"]
            r_list = metrics_by_method[m]["recall"]
            mrr_list = metrics_by_method[m]["mrr"]
            ndcg_list = metrics_by_method[m]["ndcg"]
            lat_list = metrics_by_method[m]["latency_ms"]

            n = len(p_list)
            aggregates[m] = {
                f"mean_precision_at_{k}": round(sum(p_list) / n, 4) if n else 0.0,
                f"mean_recall_at_{k}": round(sum(r_list) / n, 4) if n else 0.0,
                "mean_mrr": round(sum(mrr_list) / n, 4) if n else 0.0,
                f"mean_ndcg_at_{k}": round(sum(ndcg_list) / n, 4) if n else 0.0,
                "latency_ms_avg": round(sum(lat_list) / n, 2) if n else 0.0,
                "latency_ms_p50": compute_percentile(lat_list, 50),
                "latency_ms_p95": compute_percentile(lat_list, 95),
                "latency_ms_p99": compute_percentile(lat_list, 99),
            }

        return {
            "total_test_cases": len(self.test_cases),
            "k": k,
            "aggregates": aggregates,
            "detailed_results": detailed_results,
        }


# Global evaluator instance
relevance_evaluator = SearchRelevanceEvaluator()
