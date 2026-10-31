"""
Unit & Integration Tests for ANVESHA's Four External Intelligence Integrations:
GitHub, OpenAlex, Jina AI, and Firecrawl.
"""
import unittest
import asyncio
from fastapi.testclient import TestClient

from app.main import app
from engine.integrations import (
    mask_secret,
    SimpleTTLCache,
    github_client,
    openalex_client,
    jina_client,
    firecrawl_client,
    provider_health_manager,
)


class TestFourIntegrations(unittest.TestCase):
    """Test suite covering the 4 API integrations, rate limiting, and security masking."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_secret_masking(self):
        """Ensures secrets are masked and never exposed in logs, telemetry, or responses."""
        gh_pat = "github_pat_11CM_MOCK_TEST_SECRET_KEY_FOR_UNIT_TESTING_Deb1"
        masked_gh = mask_secret(gh_pat)
        self.assertTrue(masked_gh.startswith("github_pat_11CM"))
        self.assertTrue(masked_gh.endswith("Deb1"))
        self.assertNotIn("SECRET_KEY", masked_gh)

        jina_key = "jina_909_MOCK_TEST_SECRET_KEY_FOR_UNIT_TESTING_DmLy"
        masked_jina = mask_secret(jina_key)
        self.assertTrue(masked_jina.startswith("jina_909"))
        self.assertTrue(masked_jina.endswith("DmLy"))
        self.assertNotIn("SECRET_KEY", masked_jina)

        fc_key = "fc-63eb_MOCK_TEST_KEY_FOR_UNIT_TESTING_11ac"
        masked_fc = mask_secret(fc_key)
        self.assertTrue(masked_fc.startswith("fc-63eb"))
        self.assertTrue(masked_fc.endswith("11ac"))
        self.assertNotIn("5b9247ab4498", masked_fc)

        self.assertEqual(mask_secret(""), "")
        self.assertEqual(mask_secret(None), "")
        self.assertEqual(mask_secret("short"), "********")

    def test_02_ttl_caching(self):
        """Verifies in-memory TTL caching to prevent duplicate API hits."""
        cache = SimpleTTLCache(default_ttl_seconds=1)
        cache.set("key1", {"data": "test"})
        self.assertEqual(cache.get("key1"), {"data": "test"})
        self.assertIsNone(cache.get("nonexistent"))

    def test_03_github_client_health(self):
        """Verifies GitHub client connectivity and rate limit telemetry."""
        health = asyncio.run(github_client.check_health())
        self.assertEqual(health["name"], "GitHub API")
        self.assertTrue(health["configured"])
        self.assertIn(health["status"], ["operational", "rate_limited"])
        self.assertGreater(health["latency_ms"], 0.0)
        self.assertIn("Deb1", health["masked_key"])
        self.assertNotIn("gpttqiSxhwd", health["masked_key"])
        self.assertIn("remaining", health["quota_info"])

    def test_04_openalex_client_health_and_search(self):
        """Verifies OpenAlex client connectivity and scholarly paper retrieval."""
        health = asyncio.run(openalex_client.check_health())
        self.assertEqual(health["name"], "OpenAlex Academic")
        self.assertTrue(health["configured"])
        self.assertEqual(health["status"], "operational")
        self.assertGreater(health["latency_ms"], 0.0)

        # Test search query
        works = asyncio.run(openalex_client.search_works("quantum computing", limit=2))
        self.assertIsInstance(works, list)
        if works:
            self.assertIn("title", works[0])
            self.assertEqual(works[0]["source"], "OpenAlex Academic")

    def test_05_jina_client_health(self):
        """Verifies Jina AI client connectivity."""
        health = asyncio.run(jina_client.check_health())
        self.assertEqual(health["name"], "Jina AI")
        self.assertTrue(health["configured"])
        self.assertIn(health["status"], ["operational", "rate_limited"])
        self.assertGreater(health["latency_ms"], 0.0)
        self.assertIn("DmLy", health["masked_key"])

    def test_06_firecrawl_client_health(self):
        """Verifies Firecrawl client connectivity."""
        health = asyncio.run(firecrawl_client.check_health())
        self.assertEqual(health["name"], "Firecrawl")
        self.assertTrue(health["configured"])
        self.assertIn(health["status"], ["operational", "quota_exceeded"])
        self.assertGreater(health["latency_ms"], 0.0)
        self.assertIn("11ac", health["masked_key"])

    def test_07_provider_health_manager(self):
        """Verifies concurrent check of all 6 integrated providers."""
        report = asyncio.run(provider_health_manager.check_all_providers())
        self.assertEqual(report["providers_count"], 6)
        self.assertIn(report["status"], ["healthy", "partially_degraded"])
        provider_names = [p["name"] for p in report["providers"]]
        self.assertIn("GitHub API", provider_names)
        self.assertIn("OpenAlex Academic", provider_names)
        self.assertIn("Jina AI", provider_names)
        self.assertIn("Firecrawl", provider_names)
        self.assertIn("Google Maps", provider_names)
        self.assertIn("Groq", provider_names)

    def test_08_health_integrations_endpoint(self):
        """Verifies HTTP GET /api/v2/health/integrations returns sanitized JSON."""
        res = self.client.get("/api/v2/health/integrations")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["providers_count"], 6)
        for p in data["providers"]:
            self.assertIn("masked_key", p)
            # Ensure full tokens are NEVER present in response
            if p.get("masked_key"):
                self.assertNotIn("gpttqiSxhwd", p["masked_key"])
                self.assertNotIn("477b05465d8", p["masked_key"])
                self.assertNotIn("5b9247ab4498", p["masked_key"])
                self.assertNotIn("0_-Q7Lc5", p["masked_key"])
                self.assertNotIn("talRwINuZi", p["masked_key"])

    def test_09_google_maps_client(self):
        """Verifies Google Maps (Places API New) health check and place resolution."""
        from engine.integrations import google_maps_client
        health = asyncio.run(google_maps_client.check_health())
        self.assertEqual(health["name"], "Google Maps")
        self.assertTrue(health["configured"])
        self.assertEqual(health["status"], "operational")
        self.assertIn("Quuo", health["masked_key"])

        place = asyncio.run(google_maps_client.search_place("Taj Mahal"))
        self.assertIsNotNone(place)
        self.assertEqual(place["provider"], "Google Maps")
        self.assertIn("Taj Mahal", place["location_name"])
        self.assertIsNotNone(place["latitude"])
        self.assertIsNotNone(place["longitude"])

    def test_10_groq_client_inference(self):
        """Verifies Groq fast LPU LLM inference and response validation."""
        from engine.integrations import groq_client
        health = asyncio.run(groq_client.check_health())
        self.assertEqual(health["name"], "Groq")
        self.assertTrue(health["configured"])
        self.assertEqual(health["status"], "operational")
        self.assertIn("FAkn", health["masked_key"])

        response = asyncio.run(groq_client.generate_completion("Respond with exactly: ANVESHA_GROQ_OK"))
        self.assertIsNotNone(response)
        self.assertIn("ANVESHA_GROQ_OK", response)

    def test_11_cost_tracker_and_usage(self):
        """Verifies cost tracker records calls and units across providers."""
        from engine.integrations import cost_tracker
        summary = cost_tracker.get_summary()
        self.assertIn("total_estimated_cost_usd", summary)
        self.assertIn("providers", summary)
        self.assertIn("google_maps", summary["providers"])
        self.assertIn("groq", summary["providers"])

    def test_12_provider_registry_toggle(self):
        """Verifies dynamic enable and disable controls for providers."""
        from engine.integrations import provider_registry
        self.assertTrue(provider_registry.is_enabled("github"))
        provider_registry.set_enabled("github", False)
        self.assertFalse(provider_registry.is_enabled("github"))
        # Reset back to True
        provider_registry.set_enabled("github", True)
        self.assertTrue(provider_registry.is_enabled("github"))


if __name__ == "__main__":
    unittest.main()
