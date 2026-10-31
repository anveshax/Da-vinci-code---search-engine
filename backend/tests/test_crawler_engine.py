"""
Comprehensive Unit Test Suite for ANVESHA Web Crawler & Search Indexing Engine.

Tests:
1. URL Normalization, canonicalization & link extraction.
2. SSRF Protection, private IP blocking & cloud metadata defense.
3. Content extraction, boilerplate removal & technical structure preservation.
4. Deduplication: exact content hash (SHA-256) & near-duplicate Jaccard similarity.
5. SQLite FTS5 search indexing, BM25 scoring & snippet highlights.
6. Robots.txt policy parsing & politeness handling.
7. Crawler REST API endpoints.
"""
import unittest
import json
import uuid
import time
from fastapi.testclient import TestClient

from app.main import app
from app.core.db import get_db_connection, init_db
from engine.crawler.security import (
    validate_crawl_url,
    is_ip_blocked,
    resolve_and_validate_hostname,
    SSRFSecurityError,
    validate_content_type,
)
from engine.crawler.url_utils import normalize_url, extract_canonical_url, extract_links
from engine.crawler.robots import DomainRobotsPolicy
from engine.crawler.extractor import extract_content, ExtractedDocument
from engine.crawler.dedup import DeduplicationEngine, compute_shingles, jaccard_similarity
from engine.crawler.indexer import SQLiteFTS5Indexer
from engine.crawler.engine import web_intelligence_engine


class TestWebCrawlerEngine(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        cls.indexer = SQLiteFTS5Indexer()

    # --- 1. URL Normalization Tests ---

    def test_01_url_normalization(self):
        # Tracking parameters removal
        raw = "HTTPS://Docs.Python.Org:443/3/tutorial/index.html?utm_source=twitter&version=3.12&utm_medium=social#getting-started"
        norm = normalize_url(raw)
        self.assertEqual(norm, "https://docs.python.org/3/tutorial/index.html?version=3.12")

        # Double slash collapse in path
        raw_slashes = "https://example.com//docs///guide//intro"
        norm_slashes = normalize_url(raw_slashes)
        self.assertEqual(norm_slashes, "https://example.com/docs/guide/intro")

        # Default port removal
        self.assertEqual(normalize_url("http://example.org:80/page"), "http://example.org/page")
        self.assertEqual(normalize_url("https://example.org:443/page"), "https://example.org/page")

    def test_02_canonical_url_extraction(self):
        html = """
        <html>
            <head>
                <link rel="canonical" href="/reference/models" />
            </head>
            <body>Content</body>
        </html>
        """
        canonical = extract_canonical_url(html, "https://fastapi.tiangolo.com/subpage/")
        self.assertEqual(canonical, "https://fastapi.tiangolo.com/reference/models")

    def test_03_link_extraction_with_boundaries(self):
        html = """
        <html>
            <body>
                <a href="/docs/intro">Intro</a>
                <a href="https://docs.python.org/3/library/">Library</a>
                <a href="https://malicious-external.com/hack">External</a>
                <a href="javascript:void(0)">JS Action</a>
                <a href="mailto:test@example.com">Email</a>
            </body>
        </html>
        """
        links = extract_links(html, "https://docs.python.org/3/", allowed_domains=["docs.python.org"])
        self.assertTrue(any("intro" in l for l in links))
        self.assertTrue(any("library" in l for l in links))
        # Ensure external and non-http schemes are excluded
        self.assertFalse(any("malicious-external.com" in l for l in links))
        self.assertFalse(any("javascript:" in l for l in links))
        self.assertFalse(any("mailto:" in l for l in links))

    # --- 2. SSRF Security & Protection Tests ---

    def test_04_ssrf_ip_blocking(self):
        # Loopback
        blocked, _ = is_ip_blocked("127.0.0.1")
        self.assertTrue(blocked)

        blocked_v6, _ = is_ip_blocked("::1")
        self.assertTrue(blocked_v6)

        # Private RFC 1918
        blocked_priv1, _ = is_ip_blocked("10.0.1.5")
        self.assertTrue(blocked_priv1)

        blocked_priv2, _ = is_ip_blocked("192.168.1.1")
        self.assertTrue(blocked_priv2)

        blocked_priv3, _ = is_ip_blocked("172.16.10.20")
        self.assertTrue(blocked_priv3)

        # Cloud Metadata (AWS/GCP/Azure)
        blocked_meta, _ = is_ip_blocked("169.254.169.254")
        self.assertTrue(blocked_meta)

        # Valid Public IP (Cloudflare 1.1.1.1)
        blocked_pub, _ = is_ip_blocked("1.1.1.1")
        self.assertFalse(blocked_pub)

    def test_05_ssrf_url_validation(self):
        # Forbidden schemes
        safe, reason = validate_crawl_url("file:///etc/passwd")
        self.assertFalse(safe)
        self.assertIn("scheme", reason.lower())

        safe_ftp, _ = validate_crawl_url("ftp://internal-server/data")
        self.assertFalse(safe_ftp)

        # Localhost rejection
        safe_local, _ = validate_crawl_url("http://localhost:8000/admin")
        self.assertFalse(safe_local)

        safe_ip_loop, _ = validate_crawl_url("http://127.0.0.1:8000/internal")
        self.assertFalse(safe_ip_loop)

        # Blocked executable extensions
        safe_bin, _ = validate_crawl_url("https://example.com/payload.exe")
        self.assertFalse(safe_bin)

    def test_06_content_type_validation(self):
        self.assertTrue(validate_content_type("text/html; charset=UTF-8")[0])
        self.assertTrue(validate_content_type("application/xhtml+xml")[0])
        self.assertFalse(validate_content_type("application/octet-stream")[0])
        self.assertFalse(validate_content_type("application/zip")[0])

    # --- 3. Robots.txt Policy Tests ---

    def test_07_robots_policy_parsing(self):
        robots_txt = """
        User-agent: *
        Disallow: /admin/
        Disallow: /private/
        Crawl-delay: 2.5
        Sitemap: https://example.com/sitemap.xml
        """
        policy = DomainRobotsPolicy("example.com", robots_txt, status_code=200)
        self.assertTrue(policy.can_fetch("https://example.com/docs/intro"))
        self.assertFalse(policy.can_fetch("https://example.com/admin/login"))
        self.assertFalse(policy.can_fetch("https://example.com/private/keys"))
        self.assertEqual(policy.crawl_delay, 2.5)
        self.assertIn("https://example.com/sitemap.xml", policy.sitemaps)

        # 404 policy (permissive)
        policy_404 = DomainRobotsPolicy("example.com", "", status_code=404)
        self.assertTrue(policy_404.can_fetch("https://example.com/anything"))

    # --- 4. Content Extraction & Boilerplate Removal Tests ---

    def test_08_content_extraction(self):
        html = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>FastAPI Concurrency Guide</title>
            <meta name="description" content="Learn how asynchronous endpoints work in FastAPI." />
            <meta name="author" content="Sebastián Ramírez" />
        </head>
        <body>
            <nav><a href="/">Home</a><a href="/login">Login</a></nav>
            <div class="cookie-banner">Please accept cookies.</div>
            <main>
                <h1>Asynchronous Def Endpoints</h1>
                <p>When you declare a path operation function with <code>async def</code>, FastAPI executes it in the main async event loop.</p>
                <pre><code>@app.get("/items")
async def read_items():
    return [{"item_id": 1}]</code></pre>
            </main>
            <footer>Copyright 2026 FastAPI</footer>
            <script>console.log("tracker");</script>
        </body>
        </html>
        """
        doc = extract_content(html, "https://fastapi.tiangolo.com/async/")
        self.assertIsNotNone(doc)
        self.assertEqual(doc.title, "FastAPI Concurrency Guide")
        self.assertEqual(doc.author, "Sebastián Ramírez")
        self.assertEqual(doc.language, "en")
        self.assertIn("Asynchronous Def Endpoints", doc.headings)
        self.assertIn("async event loop", doc.content)
        # Ensure boilerplate is purged
        self.assertNotIn("Please accept cookies", doc.content)
        self.assertNotIn("console.log", doc.content)
        self.assertNotIn("Copyright 2026", doc.content)
        self.assertTrue(len(doc.content_hash) == 64)

    # --- 5. Deduplication Tests ---

    def test_09_deduplication(self):
        text_a = "FastAPI uses Starlette for the web parts and Pydantic for the data parts."
        text_b = "FastAPI uses Starlette for the web parts and Pydantic for the data parts."
        text_c = "Django is a high-level Python web framework that encourages rapid development."

        # Exact match
        hash_a = "abc123hash"
        self.assertTrue(DeduplicationEngine.is_exact_duplicate(hash_a, hash_a))
        self.assertFalse(DeduplicationEngine.is_exact_duplicate(hash_a, "xyz999hash"))

        # Jaccard near-duplicate
        is_dup, sim = DeduplicationEngine.is_near_duplicate(text_a, text_b, threshold=0.85)
        self.assertTrue(is_dup)
        self.assertAlmostEqual(sim, 1.0)

        is_dup_diff, sim_diff = DeduplicationEngine.is_near_duplicate(text_a, text_c, threshold=0.85)
        self.assertFalse(is_dup_diff)
        self.assertLess(sim_diff, 0.3)

    # --- 6. Search Indexing & BM25 Scoring Tests ---

    def test_10_fts5_indexing_and_bm25_search(self):
        doc_id = f"test_doc_{uuid.uuid4().hex[:8]}"
        unique_token = f"asynctok_{uuid.uuid4().hex[:6]}"
        test_url = f"https://docs.python.org/3/library/test-asyncio-{uuid.uuid4().hex[:8]}.html"
        doc = ExtractedDocument(
            url=test_url,
            title=f"Coroutines and Tasks in Python Asyncio {unique_token}",
            content=f"Asyncio is a library {unique_token} to write concurrent code using the async/await syntax. Coroutines declared with async def are the preferred way of writing asyncio applications.",
            description="Guide to coroutines and event loops in Python.",
            headings=["Coroutines and Tasks", "Awaiting a Future"],
            language="en"
        )

        # Index document
        success = self.indexer.index_document(doc, doc_id)
        self.assertTrue(success)

        # Search by keyword including unique token
        hits = self.indexer.search(f"coroutines {unique_token}", limit=5)
        self.assertGreater(len(hits), 0)
        top_hit = hits[0]
        self.assertEqual(top_hit.doc_id, doc_id)
        self.assertEqual(top_hit.domain, "docs.python.org")
        self.assertIn("Python", top_hit.title)
        self.assertGreater(top_hit.score, 0.0)

        # Clean up
        self.indexer.delete_document(doc_id)
        hits_after = self.indexer.search(unique_token, limit=5)
        self.assertNotIn(doc_id, [h.doc_id for h in hits_after])

    # --- 7. Crawler REST API Endpoints Tests ---

    def test_11_crawler_rest_apis(self):
        # 1. Stats endpoint
        res_stats = self.client.get("/api/v2/crawler/stats")
        self.assertEqual(res_stats.status_code, 200)
        data_stats = res_stats.json()
        self.assertIn("crawled_pages", data_stats)
        self.assertIn("indexed_documents", data_stats)

        # 2. Domains endpoint
        res_domains = self.client.get("/api/v2/crawler/domains")
        self.assertEqual(res_domains.status_code, 200)
        self.assertGreater(len(res_domains.json().get("domains", [])), 0)

        # 3. Add domain endpoint with SSRF rejection check
        res_add_ssrf = self.client.post("/api/v2/crawler/domains", json={"domain": "localhost"})
        self.assertEqual(res_add_ssrf.status_code, 400)

        # 4. Monitoring endpoint
        res_mon = self.client.get("/api/v2/crawler/monitoring")
        self.assertEqual(res_mon.status_code, 200)
        self.assertIn("requests_per_minute", res_mon.json())

        # 5. Documents list endpoint
        res_docs = self.client.get("/api/v2/crawler/documents?limit=10")
        self.assertEqual(res_docs.status_code, 200)
        self.assertIn("documents", res_docs.json())


if __name__ == "__main__":
    unittest.main()
