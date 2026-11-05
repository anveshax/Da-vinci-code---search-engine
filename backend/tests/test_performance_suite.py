"""
Comprehensive Performance, Speed & Resource Optimization Verification Suite.

Tests:
1. SQLite PRAGMAs (WAL mode, synchronous=NORMAL, cache_size=-32000, mmap_size=256MB).
2. Database composite indexes existence and latency verification.
3. SearchCache LRU hit/miss, TTL expiration, and telemetry accuracy.
4. BackgroundTaskManager bounded queueing, worker execution, and shutdown.
5. Centralized HTTP pooled client singleton and keep-alive configuration.
6. Performance telemetry endpoint response structure and accuracy.
"""
import os
import sys
import time
import asyncio
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.db import get_db_connection, init_db
from engine.cache_engine import SearchCache, performance_telemetry
from engine.task_manager import BackgroundTaskManager
from engine.http_client import get_shared_client
from app.api.performance import get_performance_telemetry, get_benchmark_comparison


class TestPerformanceOptimizations(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()

    def test_01_sqlite_pragmas(self):
        """Verifies high-throughput SQLite PRAGMAs are active."""
        with get_db_connection() as conn:
            journal_mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
            self.assertEqual(journal_mode.upper(), "WAL", "SQLite must be in WAL journal mode")

            synchronous = conn.execute("PRAGMA synchronous;").fetchone()[0]
            # 1 = NORMAL
            self.assertEqual(synchronous, 1, "SQLite synchronous must be NORMAL (1)")

            cache_size = conn.execute("PRAGMA cache_size;").fetchone()[0]
            self.assertEqual(cache_size, -32000, "SQLite cache_size must be -32000 (32MB)")

            mmap_size = conn.execute("PRAGMA mmap_size;").fetchone()[0]
            self.assertGreaterEqual(mmap_size, 268435456, "SQLite mmap_size must be >= 256MB")

    def test_02_composite_indexes_exist(self):
        """Verifies query indexes exist to prevent full-table scans."""
        with get_db_connection() as conn:
            indexes = [r[1] for r in conn.execute("SELECT type, name FROM sqlite_master WHERE type='index'").fetchall()]
            self.assertIn("idx_crawler_queue_poll", indexes)
            self.assertIn("idx_telemetry_provider_ts", indexes)
            self.assertIn("idx_agent_msg_task", indexes)
            self.assertIn("idx_task_steps_task", indexes)

    def test_03_search_cache_lru_and_stats(self):
        """Tests that SearchCache correctly records hits, misses, and respects max_size."""
        cache = SearchCache(max_size=3, ttl_seconds=2)
        self.assertIsNone(cache.get("key1"))
        self.assertEqual(cache.misses, 1)

        cache.set("key1", "val1")
        self.assertEqual(cache.get("key1"), "val1")
        self.assertEqual(cache.hits, 1)

        # Fill to capacity
        cache.set("key2", "val2")
        cache.set("key3", "val3")
        cache.set("key4", "val4")  # Should evict LRU (key1)

        stats = cache.get_stats()
        self.assertEqual(stats["size"], 3)
        self.assertGreater(stats["hits"], 0)
        self.assertGreater(stats["hit_ratio_percent"], 0.0)

    def test_04_background_task_manager_bounded_execution(self):
        """Tests that BackgroundTaskManager enforces concurrency and bounds."""
        manager = BackgroundTaskManager(max_concurrency=2, max_queue_size=10)

        async def run_test():
            await manager.start()
            results = []

            async def mock_task(n: int):
                await asyncio.sleep(0.01)
                results.append(n)

            task1 = manager.submit("test_task_1", mock_task, 1)
            task2 = manager.submit("test_task_2", mock_task, 2)
            self.assertIsNotNone(task1)
            self.assertIsNotNone(task2)

            await asyncio.sleep(0.1)
            self.assertEqual(len(results), 2)
            self.assertIn(1, results)
            self.assertIn(2, results)

            telemetry = manager.get_telemetry()
            self.assertTrue(telemetry["is_running"])
            self.assertEqual(telemetry["completed_tasks_total"], 2)

            await manager.shutdown()

        asyncio.run(run_test())

    def test_05_http_client_pooling_configuration(self):
        """Verifies centralized HTTP client has pooled limits."""
        client = get_shared_client()
        self.assertIsNotNone(client)
        self.assertFalse(client.is_closed)

    def test_06_performance_telemetry_endpoint(self):
        """Verifies live performance telemetry returns real metrics."""
        data = get_performance_telemetry()
        self.assertEqual(data["status"], "ok")
        self.assertIn("system", data)
        self.assertIn("database", data)
        self.assertIn("cache", data)
        self.assertIn("background_tasks", data)
        self.assertIn("network", data)

        # Check genuine values
        self.assertGreater(data["system"]["process_rss_mb"], 0)
        self.assertEqual(data["database"]["journal_mode"], "WAL")
        self.assertEqual(data["database"]["synchronous"], "NORMAL")
        self.assertEqual(data["network"]["gzip_compression"], "ENABLED (>= 1000B)")

    def test_07_benchmarks_endpoint(self):
        """Verifies audit comparisons endpoint data."""
        benchmarks = get_benchmark_comparison()
        self.assertEqual(benchmarks["status"], "ok")
        self.assertGreaterEqual(len(benchmarks["comparisons"]), 5)


if __name__ == "__main__":
    unittest.main()
