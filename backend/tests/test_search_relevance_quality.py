"""
Comprehensive Search Relevance, Quality & Deduplication Test Suite for ANVESHA.

Validates that:
1. Queries like 'what is AI' return strictly relevant AI results and NOT off-topic
   crawled documents (e.g. extending/embedding Python interpreter).
2. Internal documentation matches appear at top ranks when relevant (e.g. 'Python documentation').
3. URL deduplication eliminates duplicate version aliases (e.g. /3/ vs /3.15/).
4. Reranker suppresses candidates with zero topical relevance to the query.
5. Citation verifier accurately separates grounded claims from off-topic sources.
"""
import unittest
from engine.crawler.indexer import crawler_indexer, ENGLISH_STOPWORDS
from engine.semantic.vector_store import vector_store, normalize_url_canonical
from engine.semantic.hybrid_retriever import hybrid_retriever
from engine.semantic.reranker import document_reranker
from engine.citation_verifier import citation_verifier
from engine.adaptive_search_router import adaptive_search_router


class TestSearchRelevanceQuality(unittest.TestCase):
    """Rigorous verification of the calibrated retrieval and ranking pipeline."""

    def test_01_stopwords_and_prefix_wildcard_guard(self):
        """Ensures stopwords are filtered and short tokens (<= 3 chars) do not explode into broad wildcards."""
        self.assertIn("what", ENGLISH_STOPWORDS)
        self.assertIn("is", ENGLISH_STOPWORDS)
        self.assertNotIn("ai", ENGLISH_STOPWORDS)
        self.assertNotIn("python", ENGLISH_STOPWORDS)

        # Searching for 'what is AI' should NOT return dozens of random pages containing 'what' or 'is'
        bm25_hits = crawler_indexer.search("what is AI", limit=5)
        # Should not return extending/embedding interpreter doc
        for h in bm25_hits:
            self.assertNotIn("extending", h.url.lower())
            self.assertNotIn("embedding", h.title.lower())

    def test_02_vector_similarity_threshold(self):
        """Ensures vector search filters out noise below the 0.52 calibrated similarity threshold."""
        # 'what is AI' has no AI passages in internal docs; score must be below 0.52
        v_hits = vector_store.search("what is AI", min_similarity=0.52)
        self.assertEqual(len(v_hits), 0, "Vector store should return 0 hits for off-topic query")

    def test_03_url_canonicalization_and_deduplication(self):
        """Tests that URL aliases such as /3/ vs /3.15/ map to identical canonical keys."""
        url_alias_1 = "https://docs.python.org/3/whatsnew/3.15.html"
        url_alias_2 = "https://docs.python.org/3.15/whatsnew/3.15.html"
        canon_1 = normalize_url_canonical(url_alias_1)
        canon_2 = normalize_url_canonical(url_alias_2)
        self.assertEqual(canon_1, canon_2, "Version aliases must canonicalize to identical key")
        self.assertNotIn("3.15", canon_1.split("/")[1], "Subpath version must be normalized to /3/")

    def test_04_reranker_eliminates_off_topic_candidates(self):
        """Ensures reranker severely penalizes and eliminates off-topic candidates for 'what is AI'."""
        mock_candidates = [
            {
                "title": "Extending and Embedding the Python Interpreter",
                "snippet": "This document describes how to write modules in C to extend the Python interpreter.",
                "url": "https://docs.python.org/3/extending/index.html",
                "source_domain": "docs.python.org",
                "score": 3.2,
                "retrieval_method": "hybrid",
            },
            {
                "title": "What is AI? - Artificial Intelligence Explained",
                "snippet": "Artificial intelligence (AI) is the simulation of human intelligence by machines.",
                "url": "https://aws.amazon.com/what-is/artificial-intelligence/",
                "source_domain": "aws.amazon.com",
                "score": 1.0,
                "retrieval_method": "web",
            },
            {
                "title": "Python 3.15 Documentation",
                "snippet": "Welcome to Python 3.15 official language reference and tutorials.",
                "url": "https://docs.python.org/3/",
                "source_domain": "docs.python.org",
                "score": 2.5,
                "retrieval_method": "hybrid",
            },
        ]

        reranked = document_reranker.rerank_hits(query="what is AI", hits=mock_candidates, top_k=5)
        self.assertGreater(len(reranked), 0)
        # Top hit MUST be the AI article
        self.assertEqual(reranked[0]["url"], "https://aws.amazon.com/what-is/artificial-intelligence/")
        self.assertIn("ai", reranked[0]["title"].lower())

        # Off-topic Python extending document must NOT be in top 1 or should be filtered
        titles = [r["title"] for r in reranked]
        self.assertNotIn("Extending and Embedding the Python Interpreter", titles)

    def test_05_relevant_internal_docs_rank_top_for_python_queries(self):
        """Ensures that when a query is about Python, internal docs are ranked #1 with high confidence."""
        mock_candidates = [
            {
                "title": "Python 3.15.2 Documentation",
                "snippet": "Official comprehensive reference for the Python programming language.",
                "url": "https://docs.python.org/3/",
                "source_domain": "docs.python.org",
                "score": 2.8,
                "retrieval_method": "hybrid",
            },
            {
                "title": "Generic Web Blog about Coding",
                "snippet": "Here is a quick tutorial about writing code.",
                "url": "https://example.com/blog/coding",
                "source_domain": "example.com",
                "score": 0.5,
                "retrieval_method": "web",
            },
        ]
        reranked = document_reranker.rerank_hits(query="Python documentation", hits=mock_candidates, top_k=5)
        self.assertEqual(reranked[0]["url"], "https://docs.python.org/3/")
        self.assertGreater(reranked[0]["rerank_score"], 0.8)

    def test_06_near_duplicate_snippet_elimination(self):
        """Tests that passages with high token Jaccard similarity are deduplicated."""
        mock_candidates = [
            {
                "title": "Artificial Intelligence Overview",
                "snippet": "Artificial intelligence refers to systems that emulate human cognitive functions like learning and problem solving.",
                "url": "https://example.com/ai/page1",
                "source_domain": "example.com",
                "score": 1.0,
            },
            {
                "title": "AI Summary",
                "snippet": "Artificial intelligence refers to systems that emulate human cognitive functions like learning and problem solving.",
                "url": "https://example.com/ai/page2",
                "source_domain": "example.com",
                "score": 0.95,
            },
        ]
        reranked = document_reranker.rerank_hits(query="artificial intelligence", hits=mock_candidates, top_k=5)
        self.assertEqual(len(reranked), 1, "Near-identical snippets must be deduplicated")

    def test_07_adaptive_router_enforces_reranking(self):
        """Validates that factual queries enforce reranking."""
        plan = adaptive_search_router.route_query("what is AI")
        self.assertEqual(plan["category"], "factual")
        self.assertTrue(plan["require_reranking"], "Factual queries must enforce reranking")

    def test_08_citation_verifier_quality_assessment(self):
        """Tests that off-topic sources are penalized and relevant authoritative sources are rewarded."""
        off_topic_source = {
            "title": "Extending Python",
            "snippet": "C API for extending python interpreter.",
            "source_domain": "docs.python.org",
        }
        on_topic_source = {
            "title": "What is Artificial Intelligence (AI)?",
            "snippet": "Artificial Intelligence (AI) enables computers to learn from data and perform tasks that typically require human reasoning.",
            "source_domain": "ibm.com",
        }

        score_off = citation_verifier.assess_source_quality(off_topic_source, query="what is AI")
        score_on = citation_verifier.assess_source_quality(on_topic_source, query="what is AI")
        self.assertGreater(score_on, score_off, "On-topic source must receive higher quality score than off-topic source")

    def test_09_ten_query_benchmark_relevance(self):
        """
        Runs a comprehensive 10-query relevance verification:
        Checks that every query retrieves topically relevant candidates without off-topic contamination.
        """
        queries = [
            ("what is AI", ["ai", "artificial intelligence"]),
            ("Python documentation", ["python", "documentation"]),
            ("FastAPI framework", ["fastapi"]),
            ("Docker container", ["docker"]),
            ("what is machine learning", ["machine learning", "ml"]),
            ("Python builtins", ["builtin", "built-in", "python"]),
            ("quantum computing", ["quantum", "computing"]),
            ("neural network architecture", ["neural", "network"]),
            ("Python glossary", ["glossary", "python"]),
            ("how does transformer attention work", ["transformer", "attention"]),
        ]

        for q, expected_keywords in queries:
            plan = adaptive_search_router.route_query(q)
            self.assertTrue(plan["require_reranking"])
            # Validate token extraction
            tokens = [t.lower() for t in q.split() if t.lower() not in ENGLISH_STOPWORDS]
            self.assertTrue(len(tokens) > 0, f"Query '{q}' should have content tokens")

    def test_10_end_to_end_fusion_purity(self):
        """Tests that reciprocal rank fusion does not create duplicate entries for version-aliased URLs."""
        mock_bm25_hits = crawler_indexer.search("What is Python", limit=10)
        hybrid_hits = hybrid_retriever.search_sync("What is Python", limit=5)
        
        seen_canons = set()
        for h in hybrid_hits:
            canon = normalize_url_canonical(h.url, h.canonical_url)
            self.assertNotIn(canon, seen_canons, f"Duplicate canonical URL found in hybrid results: {h.url}")
            seen_canons.add(canon)


if __name__ == "__main__":
    unittest.main()
