"""
Automated Test Suite for ANVESHA Phase 2 Advanced Search Modules:
- Module 2: Reranker & Near-Duplicate Elimination
- Module 3: SearXNG Client Adapter & Fallback
- Module 4: Freshness Intelligence & Conditional Recrawling
- Module 5: Source Quality & Citation Grounding Verifier
- Module 6: Cache Engine, Circuit Breaker & Performance Telemetry
- Module 7: Adaptive Search Router
"""
import unittest
import time
from backend.engine.semantic.reranker import DocumentReranker
from backend.engine.searxng_client import SearXNGClient
from backend.engine.crawler.freshness import FreshnessManager
from backend.engine.citation_verifier import CitationVerifier
from backend.engine.cache_engine import SearchCache, CircuitBreaker, PerformanceTelemetry
from backend.engine.adaptive_search_router import AdaptiveSearchRouter


class TestPhase2AdvancedSearch(unittest.TestCase):
    def setUp(self):
        self.reranker = DocumentReranker(jaccard_dedup_threshold=0.8)
        self.freshness = FreshnessManager()
        self.verifier = CitationVerifier()
        self.router = AdaptiveSearchRouter()

    def test_01_reranker_and_near_duplicate_removal(self):
        """Verify reranker boosts lexical coverage and filters near-duplicate passages."""
        query = "Python virtual environment dependencies"
        hits = [
            {
                "url": "https://example.com/p1",
                "title": "Python Virtual Environments Tutorial",
                "snippet": "Python virtual environments help isolate dependencies and package versions cleanly.",
                "score": 0.05,
                "source_domain": "docs.python.org",
                "retrieval_method": "hybrid",
            },
            {
                # Near duplicate of p1
                "url": "https://example.com/p1-duplicate",
                "title": "Python Virtual Environments Tutorial Mirror",
                "snippet": "Python virtual environments help isolate dependencies and package versions cleanly.",
                "score": 0.04,
                "source_domain": "mirror.example.com",
                "retrieval_method": "bm25",
            },
            {
                "url": "https://example.com/p2",
                "title": "History of Python",
                "snippet": "Python was created by Guido van Rossum in the late 1980s.",
                "score": 0.06,
                "source_domain": "example.com",
                "retrieval_method": "bm25",
            },
        ]
        reranked = self.reranker.rerank_hits(query=query, hits=hits, top_k=5)
        # Verify near-duplicate was eliminated
        urls = [h["url"] for h in reranked]
        self.assertNotIn("https://example.com/p1-duplicate", urls)
        # Verify p1 ranked higher than unrelated p2
        self.assertEqual(reranked[0]["url"], "https://example.com/p1")
        self.assertIn("rerank_score", reranked[0])

    def test_02_searxng_client_normalization(self):
        """Verify SearXNG client handles health check and offline state gracefully."""
        client = SearXNGClient(base_url="http://127.0.0.1:19999", timeout=0.5)
        import asyncio
        health = asyncio.run(client.check_health())
        self.assertIn("status", health)
        self.assertEqual(health["provider"], "searxng")

    def test_03_freshness_intelligence_and_conditional_headers(self):
        """Verify freshness intervals and HTTP conditional validation headers."""
        headers = self.freshness.build_conditional_headers(
            etag='"686897696a7c876b7e"',
            last_modified="Wed, 21 Oct 2026 07:28:00 GMT"
        )
        self.assertEqual(headers["If-None-Match"], '"686897696a7c876b7e"')
        self.assertEqual(headers["If-Modified-Since"], "Wed, 21 Oct 2026 07:28:00 GMT")

        interval = self.freshness.get_domain_interval("docs.python.org")
        self.assertGreaterEqual(interval, 86400 * 5)

    def test_04_citation_verifier_and_grounding(self):
        """Verify CitationVerifier scores source quality and flags invalid citation indices."""
        source_doc = {
            "source_domain": "docs.python.org",
            "snippet": "Python provides the venv module in its standard library to create lightweight virtual environments.",
            "is_internal_index": True,
        }
        quality = self.verifier.assess_source_quality(source_doc)
        self.assertGreaterEqual(quality, 0.8)

        # Valid citation verification
        answer_valid = "Python includes the venv module for creating isolated environments [1]."
        res_valid = self.verifier.verify_answer_grounding(answer_valid, [source_doc])
        self.assertTrue(res_valid["verified"])
        self.assertEqual(res_valid["valid_citations_count"], 1)

        # Invalid citation verification (cites [99] which doesn't exist)
        answer_invalid = "Python includes virtual environments [99]."
        res_invalid = self.verifier.verify_answer_grounding(answer_invalid, [source_doc])
        self.assertFalse(res_invalid["verified"])
        self.assertIn(99, res_invalid["unsupported_citations"])

    def test_05_cache_circuit_breaker_telemetry(self):
        """Verify cache expiration, circuit breaker state machine, and latency telemetry."""
        # Cache
        cache = SearchCache(max_size=5, ttl_seconds=1)
        cache.set("q1", "result_1")
        self.assertEqual(cache.get("q1"), "result_1")
        time.sleep(1.1)
        self.assertIsNone(cache.get("q1"))

        # Circuit Breaker
        breaker = CircuitBreaker(failure_threshold=2, reset_timeout=0.5)
        self.assertTrue(breaker.is_available())
        breaker.record_failure()
        self.assertTrue(breaker.is_available())
        breaker.record_failure()
        self.assertFalse(breaker.is_available())  # Tripped to OPEN
        time.sleep(0.6)
        self.assertTrue(breaker.is_available())  # HALF-OPEN trial

        # Telemetry
        telemetry = PerformanceTelemetry()
        telemetry.record("search_total_ms", 120.0)
        telemetry.record("search_total_ms", 180.0)
        summary = telemetry.get_summary()
        self.assertEqual(summary["search_total_ms"]["count"], 2)
        self.assertEqual(summary["search_total_ms"]["avg_ms"], 150.0)

    def test_06_adaptive_search_router(self):
        """Verify query categorization across direct, programming, deep research, and factual."""
        route_direct = self.router.route_query("hello")
        self.assertEqual(route_direct["category"], "direct")
        self.assertFalse(route_direct["use_external_web"])

        route_code = self.router.route_query("def get_symbol_suggestions(self, prefix: str):")
        self.assertEqual(route_code["category"], "programming")
        self.assertTrue(route_code["use_internal_bm25"])

        route_deep = self.router.route_query("comprehensive comparison and trade-offs of microservices vs monoliths")
        self.assertEqual(route_deep["category"], "deep_research")
        self.assertTrue(route_deep["use_searxng"])

        route_recent = self.router.route_query("latest Python 3.15 release news")
        self.assertEqual(route_recent["category"], "recent")
        self.assertTrue(route_recent["use_external_web"])


if __name__ == "__main__":
    unittest.main()
