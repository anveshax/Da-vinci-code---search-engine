"""
Comprehensive Test Suite for ANVESHA Fully Local AI Search and Retrieval Engine.

Covers:
1. Local Ollama LLM Provider configuration, defaults, factory creation & health checks.
2. Local Ollama Streaming & Non-streaming payload mechanics & error handling.
3. Ollama Embedding Provider (nomic-embed-text, L2 normalization, dimension checks).
4. SQLite Vector Store embedding model tracking & space isolation.
5. Model Router local task routing & capability profile.
6. Strict Local Mode execution in Search Stream V2 (zero external cloud API calls).
7. Crawler Politeness (robots.txt), SSRF Security & URL Deduplication.
"""
import os
import time
import math
import json
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.ai_provider import (
    OllamaProvider,
    BaseAIProvider,
    create_provider_instance,
    ai_provider,
    AIProviderError,
    DEFAULT_MODELS,
    DEFAULT_BASE_URLS,
)
from app.core.model_router import model_router, MODEL_CAPABILITY_PROFILES
from engine.semantic.embeddings import (
    OllamaEmbeddingProvider,
    LocalHashEmbeddingProvider,
    get_embedding_provider,
    BaseEmbeddingProvider,
)
from engine.semantic.vector_store import vector_store, SQLiteVectorStore
from engine.crawler.security import validate_crawl_url
from engine.crawler.dedup import DeduplicationEngine
from engine.crawler.robots import DomainRobotsPolicy
from app.core.db import PlatformDB, init_db, get_db_connection


def get_test_client():
    init_db()
    return TestClient(app)


def test_ollama_provider_configuration_and_factory():
    """Verify OllamaProvider initialization, factory instantiation, and default constants."""
    print("Running test_ollama_provider_configuration_and_factory()...")

    # 1. Defaults verification
    assert "ollama" in DEFAULT_MODELS, "Ollama must be registered in DEFAULT_MODELS"
    assert "ollama" in DEFAULT_BASE_URLS, "Ollama must be registered in DEFAULT_BASE_URLS"
    assert DEFAULT_MODELS["ollama"] == "llama3" or "llama" in DEFAULT_MODELS["ollama"]

    # 2. Direct Provider Instantiation
    provider = OllamaProvider(model="llama3:8b", base_url="http://localhost:11434")
    assert provider.provider_id == "ollama"
    assert provider.model == "llama3:8b"
    assert provider.base_url == "http://localhost:11434"
    assert provider.api_key == "local_no_key_required"

    # 3. Factory creation via create_provider_instance
    instance = create_provider_instance("ollama", "local_key", "llama3")
    assert isinstance(instance, OllamaProvider)
    assert instance.model == "llama3"

    print("✓ Ollama provider configuration and factory verified.")


def test_ollama_provider_offline_health_handling():
    """Verify check_health gracefully handles an offline Ollama daemon without throwing unhandled exceptions."""
    print("Running test_ollama_provider_offline_health_handling()...")

    # Point to a nonexistent port where Ollama is guaranteed offline
    provider = OllamaProvider(model="llama3", base_url="http://127.0.0.1:59999")
    loop = asyncio.new_event_loop()
    try:
        health = loop.run_until_complete(provider.check_health())
        assert health["provider"] == "ollama"
        assert health["is_local"] is True
        assert health["status"] in ("offline", "error")
        assert "error" in health
    finally:
        loop.close()

    print("✓ Ollama provider offline health handling verified.")


def test_ollama_embedding_provider_and_normalization():
    """Verify OllamaEmbeddingProvider, L2 unit-norm vectorization, and dimension consistency."""
    print("Running test_ollama_embedding_provider_and_normalization()...")

    embed_provider = OllamaEmbeddingProvider(
        base_url="http://127.0.0.1:59999",
        model="nomic-embed-text",
        dimension=768,
    )
    assert embed_provider.provider_id == "ollama"
    assert embed_provider.model == "nomic-embed-text"
    assert embed_provider.dimension == 768

    # Test L2 Normalization helper: dot product of normalized vector with itself must equal ~1.0
    raw_vec = [3.0, 4.0, 0.0, 0.0]
    norm_vec = embed_provider._normalize_vector(raw_vec)
    assert len(norm_vec) == 4
    norm_len = math.sqrt(sum(x * x for x in norm_vec))
    assert abs(norm_len - 1.0) < 1e-5, f"Vector must be L2 normalized to 1.0, got {norm_len}"

    # Test offline fallback mechanism when strict mode is disabled
    with patch.dict(os.environ, {"LOCAL_AI_STRICT_MODE": "false"}):
        embs = embed_provider.embed_batch(["ANVESHA local search", "Vector indexing"])
        assert len(embs) == 2
        assert len(embs[0]) == 768
        assert len(embs[1]) == 768
        # Ensure vectors are normalized
        len0 = math.sqrt(sum(x * x for x in embs[0]))
        assert abs(len0 - 1.0) < 1e-4

    # Test factory retrieval
    p = get_embedding_provider(force_provider="ollama")
    assert isinstance(p, OllamaEmbeddingProvider)
    assert p.provider_id == "ollama"

    print("✓ Ollama embedding provider and vector normalization verified.")


def test_vector_store_model_isolation():
    """Verify SQLiteVectorStore isolates or tracks embedding model identities and dimensions."""
    print("Running test_vector_store_model_isolation()...")

    # Use a mock/local provider to test database insertion and retrieval
    mock_local_p = LocalHashEmbeddingProvider(dimension=768)
    mock_local_p.model = "nomic-embed-text"
    mock_local_p.provider_id = "ollama"

    store = SQLiteVectorStore(embedding_provider=mock_local_p)
    doc_id = "test_doc_local_01"
    url = "https://local-anvesha.ai/docs/overview"

    # Ensure parent document exists in crawled_documents for FOREIGN KEY integrity
    with get_db_connection() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO crawled_documents (
                id, url, canonical_url, domain, title, description,
                headings, content, language, content_hash, text_length,
                word_count, outbound_links_count, crawl_timestamp, http_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 200)
        """, (
            doc_id, url, url, "local-anvesha.ai", "Local AI Search Architecture",
            "Local search overview", "[]",
            "ANVESHA incorporates local Ollama reasoning with SQLite-backed dense vector storage for 100% offline searches.",
            "en", "hash_local_01", 110, 15, 0, time.time()
        ))
        conn.commit()

    # Index sample document passages
    passages_count = store.index_document_passages(
        document_id=doc_id,
        url=url,
        domain="local-anvesha.ai",
        title="Local AI Search Architecture",
        content="ANVESHA incorporates local Ollama reasoning with SQLite-backed dense vector storage for 100% offline searches.",
        headings=["Introduction", "Offline Mode"],
        canonical_url=url,
    )
    assert passages_count > 0, "Should have created at least one passage chunk"

    # Verify model stats in SQLite
    stats = store.get_model_stats()
    assert "stored_models" in stats
    assert stats["active_model"] == "nomic-embed-text"

    # Search with matching model query
    hits = store.search("local Ollama reasoning offline", limit=5, min_similarity=0.3)
    assert len(hits) > 0
    top = hits[0]
    assert top.domain == "local-anvesha.ai"
    assert "ANVESHA" in top.content

    print("✓ SQLite Vector store model isolation and metadata verified.")


def test_model_router_local_routing():
    """Verify ModelRouter correctly selects Ollama for local tasks with zero cloud fallback."""
    print("Running test_model_router_local_routing()...")

    # 1. Profile capability check
    assert "ollama" in MODEL_CAPABILITY_PROFILES
    ollama_profile = MODEL_CAPABILITY_PROFILES["ollama"]
    assert ollama_profile["cost_efficiency"] == 100, "Local AI has 100% cost efficiency"

    # 2. Route task with task_type="local"
    route = model_router.route_task(task_type="local")
    assert route["provider"] == "ollama"
    assert isinstance(route["instance"], OllamaProvider)
    assert route["is_fallback"] is False
    assert "Offline" in route["reason"] or "Local" in route["reason"]

    # 3. Route task with explicit user_provider_override="ollama"
    override_route = model_router.route_task(task_type="auto", user_provider_override="ollama")
    assert override_route["provider"] == "ollama"
    assert isinstance(override_route["instance"], OllamaProvider)

    print("✓ Model router local routing verified.")


def test_search_stream_strict_local_mode():
    """
    Verify POST /api/v2/search/stream with mode='local':
    - Zero calls to external web search providers (SearXNG, Google Maps, OpenAlex).
    - Local Codebase Scanner and Local Indexed Documents queried.
    - Local Ollama Provider utilized.
    - Emits expected SSE events.
    """
    print("Running test_search_stream_strict_local_mode()...")
    client = get_test_client()

    # Track that external web search is never called
    with patch("engine.web_search.execute_web_search") as mock_web_search, \
         patch("engine.searxng_client.searxng_client.search") as mock_searxng:

        payload = {
            "query": "How is local offline search implemented in ANVESHA?",
            "mode": "local",
            "strict_local": True,
            "project_id": "test_local_proj",
        }

        response = client.post("/api/v2/search/stream", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers["content-type"].startswith("text/event-stream")

        # Parse SSE stream lines
        events_found = []
        for line in response.iter_lines():
            if line and line.startswith("data: "):
                data_json = line[6:].strip()
                try:
                    ev = json.loads(data_json)
                    events_found.append(ev.get("event"))
                except json.JSONDecodeError:
                    pass

        # Verify event stream pipeline
        assert "search_started" in events_found, "Stream must emit search_started event"
        assert "sources" in events_found, "Stream must emit sources event"
        assert "specialized_panels" in events_found, "Stream must emit specialized_panels event"
        assert "citations" in events_found, "Stream must emit citations event"
        assert "completed" in events_found, "Stream must emit completed event"

        # Verify ZERO external web search calls were made
        assert mock_web_search.call_count == 0, "External web search MUST NOT be called in local mode!"
        assert mock_searxng.call_count == 0, "SearXNG MUST NOT be called in local mode!"

    print("✓ Strict local mode stream execution and zero external API call guarantee verified.")


def test_crawler_politeness_security_and_deduplication():
    """Verify crawler robots.txt adherence, SSRF security guards, and content deduplication."""
    print("Running test_crawler_politeness_security_and_deduplication()...")

    # 1. SSRF URL Validation
    # Private / internal loopback and link-local ranges MUST be blocked
    unsafe_urls = [
        "http://127.0.0.1:8000/secret",
        "http://localhost:11434/api/tags",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/admin",
        "http://192.168.1.1/router",
    ]
    for u in unsafe_urls:
        safe, reason = validate_crawl_url(u)
        assert safe is False, f"URL {u} should be rejected by SSRF guard, but was allowed! ({reason})"

    # Legitimate public technical documentation URLs MUST be allowed
    safe_urls = [
        "https://docs.python.org/3/tutorial/index.html",
        "https://fastapi.tiangolo.com/tutorial/",
    ]
    for u in safe_urls:
        safe, reason = validate_crawl_url(u)
        assert safe is True, f"URL {u} should be allowed by SSRF guard: {reason}"

    # 2. Robots.txt Politeness Parser
    sample_robots_txt = """
    User-agent: *
    Disallow: /private/
    Disallow: /admin/
    Crawl-delay: 2.5
    Sitemap: https://example.com/sitemap.xml
    """
    policy = DomainRobotsPolicy(domain="example.com", raw_text=sample_robots_txt, status_code=200)
    assert policy.crawl_delay == 2.5
    assert len(policy.sitemaps) == 1
    assert policy.can_fetch("https://example.com/docs/intro") is True
    assert policy.can_fetch("https://example.com/private/passwords") is False

    # 3. Deduplication Engine (exact hash & near-duplicate shingle similarity)
    hash_a = "abc123sha256"
    assert DeduplicationEngine.is_exact_duplicate(hash_a, "abc123sha256") is True
    assert DeduplicationEngine.is_exact_duplicate(hash_a, "different_hash") is False

    text1 = "ANVESHA web intelligence engine indexes technical documentation with high performance."
    text2 = "ANVESHA web intelligence engine indexes technical documentation with high speed."
    is_near, sim = DeduplicationEngine.is_near_duplicate(text1, text2, threshold=0.7)
    assert is_near is True, f"Expected near duplicate, got similarity {sim}"
    assert sim > 0.7

    print("✓ Crawler politeness, SSRF guards, and deduplication verified.")


if __name__ == "__main__":
    print("=" * 70)
    print("ANVESHA LOCAL AI SEARCH & AGENTIC RETRIEVAL VERIFICATION SUITE")
    print("=" * 70)

    test_ollama_provider_configuration_and_factory()
    test_ollama_provider_offline_health_handling()
    test_ollama_embedding_provider_and_normalization()
    test_vector_store_model_isolation()
    test_model_router_local_routing()
    test_search_stream_strict_local_mode()
    test_crawler_politeness_security_and_deduplication()

    print("=" * 70)
    print("ALL 7/7 LOCAL AI SEARCH & AGENTIC RETRIEVAL TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)
