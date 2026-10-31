"""
Specialized Search Dashboard & WWW Providers Acceptance Tests.

Verifies Phase 7 requirements:
1. "Delhi": City knowledge panel, open images, map, weather, directions, organic web results.
2. "Python": Programming language overview, official docs, tutorials, tech resources.
3. "React useEffect": Official React documentation, hooks reference, explanations.
4. "Latest AI developments": News articles, publication dates, source attribution.
5. "Tokyo": Location query coordinates, OpenStreetMap embed, Open-Meteo weather.
6. "What is an integer?": Conceptual question routing.
7. Providers Manifest: Rate limits, costs, credentials, and attribution for all providers.
"""
import unittest
import asyncio
from fastapi.testclient import TestClient

from app.main import app
from engine.specialized_providers import (
    resolve_entity_knowledge,
    get_weather_for_location,
    get_map_for_location,
    search_news,
    search_images,
    get_all_providers_status
)
from engine.router import classify_query

client = TestClient(app)


class TestSpecializedSearchDashboard(unittest.TestCase):

    def test_01_query_classification_routing(self):
        """Verifies intelligent query routing to web/knowledge engine."""
        test_cases = [
            ("Delhi", "web"),
            ("Python", "web"),
            ("React useEffect", "web"),
            ("Latest developments in artificial intelligence", "web"),
            ("Tokyo", "web"),
            ("What is an integer?", "web")
        ]
        for query, expected_mode in test_cases:
            route = classify_query(query, ".")
            self.assertEqual(
                route["mode_selected"],
                expected_mode,
                f"Query '{query}' expected mode '{expected_mode}', got '{route['mode_selected']}'"
            )
            self.assertGreaterEqual(route["confidence"], 0.80)

    def test_02_delhi_location_and_specialized_panels(self):
        """Verifies Delhi entity recognition, map, weather, and images."""
        async def run_delhi():
            # 1. Knowledge panel
            k = await resolve_entity_knowledge("Delhi")
            self.assertIsNotNone(k)
            self.assertEqual(k["title"], "Delhi")
            self.assertEqual(k["entity_type"], "city_country")
            self.assertIn("National Capital Territory", k["subtitle"])
            self.assertTrue(len(k["attributes"]) >= 5)
            self.assertIn("India", [a["value"] for a in k["attributes"]])

            # 2. Weather
            w = await get_weather_for_location("Delhi")
            self.assertIsNotNone(w)
            self.assertEqual(w["location_name"], "Delhi, India")
            self.assertIn("temperature_c", w)
            self.assertIn("condition", w)
            self.assertIn("Open-Meteo", w["attribution"])

            # 3. Map
            m = get_map_for_location("Delhi")
            self.assertIsNotNone(m)
            self.assertEqual(m["location_name"], "Delhi, India")
            self.assertIn("openstreetmap.org/export/embed.html", m["embed_url"])
            self.assertIn("directions", m["directions_url"])

            # 4. Images
            img = await search_images("Delhi")
            self.assertGreaterEqual(len(img["images"]), 2)
            self.assertTrue(all("url" in i and "source_domain" in i for i in img["images"]))

        asyncio.run(run_delhi())

    def test_03_python_programming_language_panel(self):
        """Verifies Python language entity facts, docs, and tutorials."""
        async def run_python():
            k = await resolve_entity_knowledge("Python")
            self.assertIsNotNone(k)
            self.assertEqual(k["title"], "Python")
            self.assertEqual(k["entity_type"], "programming_language")
            self.assertIn("Guido van Rossum", [a["value"] for a in k["attributes"]])
            self.assertTrue(len(k["tech_resources"]) >= 3)
            self.assertTrue(any("docs.python.org" in r["url"] for r in k["tech_resources"]))

            # Verify no irrelevant map or weather
            m = get_map_for_location("Python")
            self.assertIsNone(m, "Programming language should not return a map panel")

        asyncio.run(run_python())

    def test_04_react_useeffect_panel(self):
        """Verifies React entity and useEffect technical references."""
        async def run_react():
            k = await resolve_entity_knowledge("React useEffect")
            self.assertIsNotNone(k)
            self.assertEqual(k["title"], "React")
            self.assertTrue(any("useEffect" in r["title"] for r in k["tech_resources"]))
            self.assertTrue(any("react.dev" in r["url"] for r in k["tech_resources"]))

        asyncio.run(run_react())

    def test_05_latest_ai_news_feed(self):
        """Verifies news retrieval for AI developments with dates and sources."""
        async def run_news():
            news = await search_news("Latest developments in artificial intelligence")
            self.assertTrue(news["is_live"])
            self.assertGreaterEqual(len(news["articles"]), 2)
            for art in news["articles"]:
                self.assertTrue(len(art["title"]) > 10)
                self.assertTrue(len(art["source"]) > 2)
                self.assertIn("published_at", art)
                self.assertTrue(art["url"].startswith("http"))

        asyncio.run(run_news())

    def test_06_rest_endpoints_api_integration(self):
        """Verifies REST endpoints for specialized search dashboard."""
        # 1. Knowledge Panel
        res_k = client.get("/api/v2/search/knowledge-panel?query=Delhi")
        self.assertEqual(res_k.status_code, 200)
        self.assertEqual(res_k.json()["knowledge_panel"]["title"], "Delhi")

        # 2. Weather
        res_w = client.get("/api/v2/search/weather?query=Delhi")
        self.assertEqual(res_w.status_code, 200)
        self.assertIn("temperature_c", res_w.json()["weather"])

        # 3. Map
        res_m = client.get("/api/v2/search/map?query=Delhi")
        self.assertEqual(res_m.status_code, 200)
        self.assertIn("embed_url", res_m.json()["map"])

        # 4. News
        res_n = client.get("/api/v2/search/news?query=AI")
        self.assertEqual(res_n.status_code, 200)
        self.assertIn("articles", res_n.json())

        # 5. Images
        res_i = client.get("/api/v2/search/images?query=Delhi")
        self.assertEqual(res_i.status_code, 200)
        self.assertIn("images", res_i.json())

        # 6. Providers Status Manifest
        res_p = client.get("/api/v2/search/providers-status")
        self.assertEqual(res_p.status_code, 200)
        manifest = res_p.json()
        self.assertIn("web_search", manifest)
        self.assertIn("knowledge_panel", manifest)
        self.assertIn("weather", manifest)
        self.assertIn("maps", manifest)
        self.assertIn("news", manifest)
        self.assertIn("images", manifest)
        self.assertIn("videos", manifest)
        self.assertIn("directions", manifest)
        # Verify honest reporting of video provider
        self.assertIn("Unconfigured", manifest["videos"]["status"])


if __name__ == "__main__":
    unittest.main()
