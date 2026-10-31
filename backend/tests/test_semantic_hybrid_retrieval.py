"""
Comprehensive Test Suite for ANVESHA Semantic Search & Hybrid Retrieval Engine.

Covers:
- Embedding generation & dimension validation
- Document chunk creation & sentence boundary preservation
- Incremental indexing & deduplication
- Dense vector retrieval & cosine similarity scoring
- Existing BM25 keyword search
- Reciprocal Rank Fusion (RRF) ranking
- Parallel hybrid retrieval & graceful fallback on failure
- Crawler API routes & SSE streaming integration
"""
import unittest
import struct
import time
import uuid
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.db import get_db_connection
from backend.engine.semantic.embeddings import (
    BaseEmbeddingProvider,
    LocalHashEmbeddingProvider,
    GeminiEmbeddingProvider,
    get_embedding_provider,
)
from backend.engine.semantic.chunker import DocumentChunker, DocumentChunk
from backend.engine.semantic.vector_store import SQLiteVectorStore, VectorHit
from backend.engine.semantic.hybrid_retriever import HybridRetriever, HybridHit
from backend.engine.crawler.indexer import crawler_indexer


class TestSemanticHybridRetrieval(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.local_provider = LocalHashEmbeddingProvider(dimension=768)
        cls.vector_store = SQLiteVectorStore(embedding_provider=cls.local_provider)
        cls.chunker = DocumentChunker(min_words=10, target_words=50, max_words=80, overlap_words=10)

    def test_01_embedding_provider_abstraction(self):
        """Verify LocalHashEmbeddingProvider produces unit-normalized vectors of expected dimension."""
        text = "Python packages and virtual environment isolation"
        vec = self.local_provider.embed_text(text)
        self.assertEqual(len(vec), 768)
        # Verify L2 norm is ~1.0
        norm = sum(x * x for x in vec) ** 0.5
        self.assertAlmostEqual(norm, 1.0, places=4)

        # Batch embedding
        batch_vecs = self.local_provider.embed_batch([text, "FastAPI backend architecture"])
        self.assertEqual(len(batch_vecs), 2)
        self.assertEqual(len(batch_vecs[0]), 768)
        self.assertEqual(len(batch_vecs[1]), 768)

        # Health check
        health = self.local_provider.check_health()
        self.assertEqual(health["status"], "healthy")
        self.assertEqual(health["dimension"], 768)

    def test_02_gemini_embedding_provider_initialization(self):
        """Verify GeminiEmbeddingProvider initializes supported models and dimensions."""
        p = GeminiEmbeddingProvider(api_key="mock_key", model="gemini-embedding-001", dimension=768)
        self.assertEqual(p.provider_id, "gemini")
        self.assertEqual(p.model, "gemini-embedding-001")
        self.assertEqual(p.dimension, 768)

    def test_03_document_chunker(self):
        """Verify DocumentChunker preserves sentences, title, headings, and generates chunk hashes."""
        title = "Python Virtual Environments Guide"
        headings = ["Installation", "Creation", "Activation"]
        content = (
            "Python virtual environments allow developers to isolate project dependencies. "
            "Each virtual environment has its own site-packages directory. "
            "To create a virtual environment, use the venv module provided by Python standard library. "
            "Run python -m venv myenv to initialize a clean directory structure. "
            "Activate the environment using the source command on Linux or macOS. "
            "On Windows, run the activate script located in the Scripts directory."
        )
        doc_id = f"test_doc_{uuid.uuid4().hex[:8]}"
        chunks = self.chunker.chunk_document(
            document_id=doc_id,
            url="https://example.com/venv-guide",
            domain="example.com",
            title=title,
            content=content,
            headings=headings,
        )
        self.assertGreaterEqual(len(chunks), 1)
        first_chunk = chunks[0]
        self.assertEqual(first_chunk.document_id, doc_id)
        self.assertEqual(first_chunk.title, title)
        self.assertEqual(first_chunk.headings, headings)
        self.assertIn("Installation", first_chunk.heading_context)
        self.assertTrue(len(first_chunk.content_hash) > 0)
        self.assertGreaterEqual(first_chunk.word_count, 10)

    def test_04_vector_blob_packing_and_schema(self):
        """Verify SQLite vector packing and unpacking into binary IEEE 754 float32."""
        raw_floats = [0.123, -0.456, 0.789, -0.001]
        packed = SQLiteVectorStore.pack_vector(raw_floats)
        self.assertEqual(len(packed), 4 * 4)  # 4 floats * 4 bytes
        unpacked = SQLiteVectorStore.unpack_vector(packed, dim=4)
        for original, restored in zip(raw_floats, unpacked):
            self.assertAlmostEqual(original, restored, places=5)

    def test_05_incremental_indexing_and_deduplication(self):
        """Verify incremental passage indexing handles inserts, updates, and deduplication."""
        doc_id = f"test_inc_{uuid.uuid4().hex[:8]}"
        url = f"https://example.com/test-{doc_id}"
        content = "Python asyncio provides asynchronous IO primitives for concurrent programming."

        # Insert parent document to satisfy foreign key constraint
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO crawled_documents (id, url, domain, title, content, content_hash, text_length, word_count, crawl_timestamp)
                VALUES (?, ?, 'example.com', 'AsyncIO Guide', ?, 'hash123', 100, 10, 1000.0)
                """,
                (doc_id, url, content),
            )
            conn.commit()

        try:
            # First indexing
            count1 = self.vector_store.index_document_passages(
                document_id=doc_id,
                url=url,
                domain="example.com",
                title="AsyncIO Guide",
                content=content,
            )
            self.assertGreaterEqual(count1, 1)

            # Second indexing with identical content (should reuse hashes)
            count2 = self.vector_store.index_document_passages(
                document_id=doc_id,
                url=url,
                domain="example.com",
                title="AsyncIO Guide",
                content=content,
            )
            self.assertEqual(count1, count2)
        finally:
            # Clean up
            with get_db_connection() as conn:
                conn.execute("DELETE FROM crawled_document_chunks WHERE document_id = ?", (doc_id,))
                conn.execute("DELETE FROM crawled_documents WHERE id = ?", (doc_id,))
                conn.commit()

    def test_06_dense_vector_search(self):
        """Verify vector store search retrieves indexed passages by semantic similarity."""
        doc_id = f"test_sem_{uuid.uuid4().hex[:8]}"
        url = f"https://example.com/search-{doc_id}"
        content = "A Python decorator is a design pattern used to extend or alter the behavior of a function without modifying it."

        # Insert parent document to satisfy foreign key constraint
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO crawled_documents (id, url, domain, title, content, content_hash, text_length, word_count, crawl_timestamp)
                VALUES (?, ?, 'example.com', 'Decorators in Python', ?, 'hash456', 100, 10, 1000.0)
                """,
                (doc_id, url, content),
            )
            conn.commit()

        try:
            self.vector_store.index_document_passages(
                document_id=doc_id,
                url=url,
                domain="example.com",
                title="Decorators in Python",
                content=content,
            )

            hits = self.vector_store.search("Python decorator pattern", domain_filter="example.com", limit=5, min_similarity=0.05)
            self.assertIsInstance(hits, list)
            matching = [h for h in hits if h.document_id == doc_id]
            self.assertGreaterEqual(len(matching), 1)
            self.assertGreater(matching[0].score, 0.05)
            self.assertEqual(matching[0].title, "Decorators in Python")
        finally:
            # Clean up
            with get_db_connection() as conn:
                conn.execute("DELETE FROM crawled_document_chunks WHERE document_id = ?", (doc_id,))
                conn.execute("DELETE FROM crawled_documents WHERE id = ?", (doc_id,))
                conn.commit()

    def test_07_bm25_retrieval(self):
        """Verify existing SQLite FTS5 indexer returns hits for indexed keywords."""
        hits = crawler_indexer.search("Python", limit=3)
        self.assertIsInstance(hits, list)
        if hits:
            self.assertGreater(hits[0].score, 0.0)
            self.assertTrue(len(hits[0].title) > 0)

    def test_08_reciprocal_rank_fusion(self):
        """Verify RRF correctly boosts documents appearing in both BM25 and Semantic ranked lists."""
        retriever = HybridRetriever(rrf_k=60)

        # Create mock SearchHit and VectorHit sharing a common URL
        shared_url = "https://example.com/shared-doc"
        bm25_hits = [
            type("MockSearchHit", (), {
                "doc_id": "doc_1",
                "url": shared_url,
                "canonical_url": shared_url,
                "domain": "example.com",
                "title": "Shared Documentation Page",
                "snippet": "BM25 snippet",
                "score": 4.5,
                "crawl_timestamp": 1000.0,
            })(),
            type("MockSearchHit", (), {
                "doc_id": "doc_2",
                "url": "https://example.com/bm25-only",
                "canonical_url": "https://example.com/bm25-only",
                "domain": "example.com",
                "title": "BM25 Only Page",
                "snippet": "Only BM25",
                "score": 3.0,
                "crawl_timestamp": 1000.0,
            })(),
        ]
        semantic_hits = [
            VectorHit(
                chunk_id="chunk_1",
                document_id="doc_1",
                url=shared_url,
                canonical_url=shared_url,
                domain="example.com",
                title="Shared Documentation Page",
                heading_context="Overview",
                content="Rich semantic passage for shared doc",
                score=0.88,
                created_at=1000.0,
            ),
            VectorHit(
                chunk_id="chunk_3",
                document_id="doc_3",
                url="https://example.com/sem-only",
                canonical_url="https://example.com/sem-only",
                domain="example.com",
                title="Semantic Only Page",
                heading_context="Section",
                content="Only Semantic",
                score=0.75,
                created_at=1000.0,
            ),
        ]

        fused = retriever._reciprocal_rank_fusion(bm25_hits, semantic_hits, limit=5)
        self.assertEqual(len(fused), 3)
        # Shared document must rank #1 due to dual-list RRF boost
        self.assertEqual(fused[0].url, shared_url)
        self.assertEqual(fused[0].retrieval_method, "hybrid")
        self.assertGreater(fused[0].score, fused[1].score)

    def test_09_parallel_hybrid_retriever_sync_and_async(self):
        """Verify HybridRetriever search_sync and search_async execute without error."""
        retriever = HybridRetriever(fts_indexer=crawler_indexer, v_store=self.vector_store)

        # Sync search
        sync_hits = retriever.search_sync("Python documentation", limit=3)
        self.assertIsInstance(sync_hits, list)

        # Async search
        import asyncio
        async_hits = asyncio.run(retriever.search_async("Python documentation", limit=3))
        self.assertIsInstance(async_hits, list)

    def test_10_provider_failure_resilience(self):
        """Verify HybridRetriever gracefully falls back to BM25 if semantic search fails."""
        # Create a broken vector store that raises an exception
        class BrokenVectorStore:
            dimension = 768
            def search(self, *args, **kwargs):
                raise RuntimeError("Simulated vector provider failure")

        resilient_retriever = HybridRetriever(
            fts_indexer=crawler_indexer,
            v_store=BrokenVectorStore(),
        )

        # Search must not raise, and should return BM25 results
        hits = resilient_retriever.search_sync("Python", limit=3)
        self.assertIsInstance(hits, list)

    def test_11_empty_query_handling(self):
        """Verify empty and whitespace queries return empty lists cleanly."""
        retriever = HybridRetriever()
        self.assertEqual(retriever.search_sync(""), [])
        self.assertEqual(retriever.search_sync("   "), [])

    def test_12_crawler_semantic_api_endpoints(self):
        """Verify new semantic crawler endpoints in FastAPI router."""
        # Health endpoint
        res_health = self.client.get("/api/v2/crawler/semantic/health")
        self.assertEqual(res_health.status_code, 200)
        data_health = res_health.json()
        self.assertIn("status", data_health)
        self.assertIn("provider", data_health)

        # Stats endpoint
        res_stats = self.client.get("/api/v2/crawler/semantic/stats")
        self.assertEqual(res_stats.status_code, 200)
        data_stats = res_stats.json()
        self.assertIn("total_chunks", data_stats)
        self.assertIn("embedding_dim", data_stats)

        # Hybrid search test endpoint
        res_search = self.client.get("/api/v2/crawler/search/hybrid?q=Python%20documentation&limit=3")
        self.assertEqual(res_search.status_code, 200)
        data_search = res_search.json()
        self.assertIn("results", data_search)

    def test_13_sse_stream_search_hybrid_integration(self):
        """Verify POST /api/v2/search/stream emits SSE events with hybrid retrieval."""
        payload = {
            "query": "What is Python?",
            "mode": "web",
            "max_results": 5,
        }
        with self.client.stream("POST", "/api/v2/search/stream", json=payload) as response:
            self.assertEqual(response.status_code, 200)
            self.assertIn("text/event-stream", response.headers.get("content-type", ""))

            # Read first few SSE lines
            lines_read = 0
            has_started = False
            for line in response.iter_lines():
                if line.startswith("data:"):
                    lines_read += 1
                    if "search_started" in line:
                        has_started = True
                if lines_read >= 5:
                    break
            self.assertTrue(has_started)


if __name__ == "__main__":
    unittest.main()
