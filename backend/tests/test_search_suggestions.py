"""
Test suite for ANVESHA Search Autocomplete and Suggestions.
Verifies backend endpoint response structure, graceful error handling,
and normalization resilience.
"""
import unittest
from fastapi.testclient import TestClient
from backend.app.main import app


class TestSearchSuggestions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_single_character_suggestion(self):
        """Verify typing a single character ('p') returns HTTP 200 with suggestions list."""
        response = self.client.get("/api/v2/search/suggest?q=p")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("query", data)
        self.assertEqual(data["query"], "p")
        self.assertIn("suggestions", data)
        self.assertIsInstance(data["suggestions"], list)

    def test_02_multi_character_suggestion(self):
        """Verify typing multiple characters ('py') returns relevant symbol/file suggestions."""
        response = self.client.get("/api/v2/search/suggest?q=py")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["query"], "py")
        self.assertIsInstance(data["suggestions"], list)

    def test_03_empty_query_validation(self):
        """Verify empty query is rejected with HTTP 422 validation error."""
        response = self.client.get("/api/v2/search/suggest?q=")
        self.assertEqual(response.status_code, 422)

    def test_04_special_characters_query(self):
        """Verify query with punctuation or code symbols does not raise 500 error."""
        response = self.client.get("/api/v2/search/suggest?q=def%20search")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data.get("suggestions"), list)

    def test_05_nonexistent_token_suggestion(self):
        """Verify querying a token with no matches returns empty suggestions list cleanly."""
        response = self.client.get("/api/v2/search/suggest?q=zzxx_nonexistent_symbol_9999")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["suggestions"], [])


if __name__ == "__main__":
    unittest.main()
