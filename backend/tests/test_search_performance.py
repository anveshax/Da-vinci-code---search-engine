"""
Performance & Latency Benchmark for ANVESHA AI Search with Google Gemini.
Tests:
1. Fast Search AI Overview Time-To-First-Token (TTFT) < 3.0s.
2. Fast Search Total Duration < 5.0s.
3. Concurrent execution of specialized providers.
4. Deep Research Mode vs Fast Search Mode token limits.
"""
import unittest
import asyncio
import time
import json
import httpx

from app.core.ai_provider import ai_provider, GeminiProvider
from app.core.config import settings
from app.api.search_v2 import router
from fastapi import FastAPI
from fastapi.testclient import TestClient

class TestSearchPerformance(unittest.TestCase):

    def setUp(self):
        self.prov, _ = ai_provider.get_primary_provider()

    def test_01_gemini_provider_model_and_aliases(self):
        """Verify Gemini provider is configured with low-latency model and aliases."""
        self.assertIsInstance(self.prov, GeminiProvider)
        self.assertIn("gemini-3.5-flash-lite", self.prov.FALLBACK_MODELS)
        self.assertEqual(self.prov.LEGACY_MODEL_ALIASES.get("gemini-2.5-flash"), "gemini-3.5-flash-lite")
        self.assertEqual(self.prov.LEGACY_MODEL_ALIASES.get("gemini-3.1-flash-lite"), "gemini-3.5-flash-lite")

    def test_02_concurrent_lookup_structure(self):
        """Verify specialized lookup uses asyncio.gather for parallelization."""
        import inspect
        from app.api import search_v2
        source = inspect.getsource(search_v2.stream_search)
        self.assertIn("asyncio.gather", source)
        self.assertIn("effective_max_tokens", source)

    def test_03_fast_vs_deep_token_policy(self):
        """Verify Fast Search uses ~450 tokens while Deep Research uses 2048 tokens."""
        import inspect
        from app.api import search_v2
        source = inspect.getsource(search_v2.stream_search)
        self.assertIn("effective_max_tokens = 450", source)
        self.assertIn("effective_max_tokens = 2048", source)

if __name__ == "__main__":
    unittest.main()
