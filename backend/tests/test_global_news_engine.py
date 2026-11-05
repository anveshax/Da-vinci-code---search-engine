"""
Comprehensive Unit & Integration Test Suite for ANVESHA Worldwide Global News Aggregation Platform.
Covers:
- Provider modules (WorldPulse, Actually Relevant, RSS feeds, FreshRSS)
- Normalization & canonical URL stripping
- Deduplication and fuzzy title similarity
- Event clustering into StoryClusters
- Multi-factor ranking (recency, outlet count, credibility)
- Persistence and SQLite caching
- Health monitoring and isolated failure resilience
- AI briefing and story Q&A endpoints
"""
import unittest
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from engine.news.models import NewsArticle, StoryCluster
from engine.news.news_normalizer import canonicalize_url, generate_article_id, clean_text_snippet, map_category_slug
from engine.news.news_deduplicator import NewsDeduplicator, title_similarity_ratio, normalize_title_tokens
from engine.news.news_clusterer import NewsClusterer
from engine.news.news_ranker import NewsRanker
from engine.news.news_cache import NewsCache
from engine.news.news_health import NewsHealthMonitor
from engine.news.worldpulse_provider import WorldPulseProvider
from engine.news.actually_relevant_provider import ActuallyRelevantProvider
from engine.news.rss_provider import RSSFeedProvider
from engine.news.freshrss_provider import FreshRSSProvider
from engine.news.news_service import GlobalNewsService


class TestNewsNormalizer(unittest.TestCase):
    def test_canonicalize_url_strips_tracking(self):
        raw = "https://www.bbc.com/news/world-12345?utm_source=twitter&utm_medium=social&fbclid=abc123xyz#comments"
        canon = canonicalize_url(raw)
        self.assertEqual(canon, "https://bbc.com/news/world-12345")
        self.assertNotIn("utm_source", canon)
        self.assertNotIn("fbclid", canon)

    def test_generate_article_id_deterministic(self):
        url = "https://theguardian.com/world/2026/nov/05/summit"
        title = "Global Climate Summit Concludes With Historic Agreement"
        id1 = generate_article_id(url, title)
        id2 = generate_article_id(url, title)
        self.assertEqual(id1, id2)
        self.assertEqual(len(id1), 24)

    def test_clean_text_snippet_html(self):
        raw_html = "<p>Scientists at <b>CERN</b> have announced a <i>breakthrough</i> discovery.<br></p>"
        cleaned = clean_text_snippet(raw_html)
        self.assertEqual(cleaned, "Scientists at CERN have announced a breakthrough discovery.")

    def test_map_category_slug(self):
        self.assertEqual(map_category_slug("Artificial Intelligence"), "technology")
        self.assertEqual(map_category_slug("Cyber Attack Reports"), "cybersecurity")
        self.assertEqual(map_category_slug("Greenhouse Gas Emissions"), "climate")
        self.assertEqual(map_category_slug("Stock Markets & Banking"), "finance")
        self.assertEqual(map_category_slug("Delhi Assembly News"), "india")


class TestDeduplicationAndClustering(unittest.TestCase):
    def setUp(self):
        self.dedup = NewsDeduplicator(similarity_threshold=0.65)
        self.clusterer = NewsClusterer(clustering_threshold=0.40)

    def test_exact_duplicate_eliminated(self):
        art1 = NewsArticle(
            id="art1",
            title="Global Space Agency Launches Mars Orbit Mission",
            original_url="https://agency.org/mission-1",
            source_name="Agency Dispatch",
            category="science",
            published_at="2026-11-05T12:00:00Z",
            provider="rss",
        )
        art2 = NewsArticle(
            id="art2",
            title="Global Space Agency Launches Mars Orbit Mission",
            original_url="https://agency.org/mission-1",
            source_name="Agency Dispatch",
            category="science",
            published_at="2026-11-05T12:00:00Z",
            provider="rss",
        )
        result = self.dedup.deduplicate([art1, art2])
        self.assertEqual(len(result), 1)

    def test_fuzzy_duplicate_increments_outlets(self):
        art1 = NewsArticle(
            id="art1",
            title="Massive Earthquake Strikes Pacific Island Nation",
            original_url="https://reuters.com/eq-1",
            source_name="Reuters",
            source_domain="reuters.com",
            category="world",
            published_at="2026-11-05T12:00:00Z",
            provider="rss",
            outlets_count=1,
        )
        art2 = NewsArticle(
            id="art2",
            title="Massive Earthquake Strikes Pacific Island Nation As Evacuations Begin",
            original_url="https://apnews.com/eq-pacific",
            source_name="Associated Press",
            source_domain="apnews.com",
            category="world",
            published_at="2026-11-05T12:15:00Z",
            provider="rss",
            outlets_count=1,
        )
        result = self.dedup.deduplicate([art1, art2])
        self.assertEqual(len(result), 1)
        self.assertGreaterEqual(result[0].outlets_count, 2)

    def test_clustering_multi_source_articles(self):
        art1 = NewsArticle(
            id="art1",
            title="Central Bank Raises Interest Rates By 50 Basis Points",
            original_url="https://ft.com/rates-hike",
            source_name="Financial Times",
            source_domain="ft.com",
            category="finance",
            published_at="2026-11-05T10:00:00Z",
            summary="Central bank hikes benchmark rate amid inflation.",
            provider="rss",
        )
        art2 = NewsArticle(
            id="art2",
            title="Central Bank Raises Rates By 50 Basis Points Amid Inflation",
            original_url="https://bloomberg.com/rates-decision",
            source_name="Bloomberg",
            source_domain="bloomberg.com",
            category="finance",
            published_at="2026-11-05T10:10:00Z",
            summary="Monetary policy committee votes to raise rates.",
            provider="rss",
        )
        art3 = NewsArticle(
            id="art3",
            title="New Quantum Computer Breaks Encryption Milestone",
            original_url="https://techcrunch.com/quantum",
            source_name="TechCrunch",
            source_domain="techcrunch.com",
            category="technology",
            published_at="2026-11-05T11:00:00Z",
            provider="rss",
        )
        clusters = self.clusterer.cluster_articles([art1, art2, art3])
        self.assertEqual(len(clusters), 2)
        # Rates cluster should have both articles
        rates_cluster = next((c for c in clusters if "Interest" in c.title or "Rate" in c.title), None)
        self.assertIsNotNone(rates_cluster)
        self.assertEqual(len(rates_cluster.related_articles), 1)
        self.assertGreaterEqual(rates_cluster.outlets_count, 2)


class TestNewsRankingAndCache(unittest.TestCase):
    def setUp(self):
        self.ranker = NewsRanker()
        self.cache = NewsCache(memory_ttl_sec=60)

    def test_ranking_boosts_breaking_and_outlet_count(self):
        normal_art = NewsArticle(
            id="norm",
            title="Local Botanical Garden Celebrates Centennial",
            original_url="https://local.org/garden",
            source_name="Local Gazette",
            category="culture",
            published_at="2026-11-05T08:00:00Z",
            provider="rss",
            outlets_count=1,
            is_breaking=False,
        )
        breaking_art = NewsArticle(
            id="brk",
            title="International Summit Approves Global Treaty",
            original_url="https://un.org/treaty",
            source_name="UN Press",
            category="world",
            published_at="2026-11-05T11:30:00Z",
            provider="worldpulse",
            outlets_count=5,
            is_breaking=True,
        )
        ranked = self.ranker.rank_articles([normal_art, breaking_art])
        self.assertEqual(ranked[0].id, "brk")

    def test_cache_memory_and_sqlite(self):
        art = NewsArticle(
            id="test1",
            title="Autonomous Rover Discovers Subsurface Ice",
            original_url="https://science.org/rover-ice",
            source_name="Science Press",
            category="science",
            country="WORLD",
            language="en",
            published_at="2026-11-05T14:00:00Z",
            summary="Spectrometers confirm water ice deposits.",
            provider="rss",
            outlets_count=2,
        )
        self.cache.set_memory_cache([art], [])
        self.assertTrue(self.cache.is_memory_fresh())
        self.assertEqual(len(self.cache.get_memory_articles()), 1)

        db_results = self.cache.query_db(query="Rover", category="science")
        self.assertGreaterEqual(len(db_results), 1)
        self.assertEqual(db_results[0].title, art.title)


class TestNewsAPIRoutes(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_categories_endpoint(self):
        r = self.client.get("/api/v1/news/categories")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("categories", data)
        self.assertGreaterEqual(len(data["categories"]), 15)

    def test_countries_endpoint(self):
        r = self.client.get("/api/v1/news/countries")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("countries", data)
        self.assertGreaterEqual(len(data["countries"]), 15)
        codes = [c["code"] for c in data["countries"]]
        self.assertIn("IN", codes)
        self.assertIn("US", codes)
        self.assertIn("GB", codes)
        self.assertIn("WORLD", codes)

    def test_languages_endpoint(self):
        r = self.client.get("/api/v1/news/languages")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("languages", data)
        langs = [l["code"] for l in data["languages"]]
        self.assertIn("en", langs)
        self.assertIn("hi", langs)
        self.assertIn("fr", langs)

    def test_sources_endpoint(self):
        r = self.client.get("/api/v1/news/sources")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("total_sources", data)
        self.assertGreaterEqual(data["total_sources"], 30)
        prov_ids = [p["id"] for p in data["primary_providers"]]
        self.assertIn("worldpulse", prov_ids)
        self.assertIn("actually_relevant", prov_ids)
        self.assertIn("freshrss", prov_ids)

    def test_status_endpoint(self):
        r = self.client.get("/api/v1/news/status")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("status", data)
        self.assertIn(data["status"], ["healthy", "degraded", "down"])

    def test_worldwide_news_pagination_and_format(self):
        r = self.client.get("/api/v1/news/worldwide?limit=4")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("articles", data)
        self.assertIn("clusters", data)
        self.assertIn("last_updated", data)
        self.assertIn("providers_status", data)

    def test_search_news_endpoint(self):
        r = self.client.get("/api/v1/news/search?q=technology&limit=3")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("query", data)
        self.assertIn("articles", data)

    def test_briefing_endpoint(self):
        payload = {"topic": "technology", "country": "WORLD"}
        r = self.client.post("/api/v1/news/briefing", json=payload)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("title", data)
        self.assertIn("summary", data)
        self.assertIn("disclaimer", data)

    def test_ask_ai_endpoint(self):
        # Even with nonexistent story id, returns graceful structured response
        payload = {"story_id": "test_missing_id", "question": "What happened?"}
        r = self.client.post("/api/v1/news/ask-ai", json=payload)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("story_id", data)
        self.assertIn("answer", data)


if __name__ == "__main__":
    unittest.main()
