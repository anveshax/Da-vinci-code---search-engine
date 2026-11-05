# ANVESHA — Fully Local AI Search & Agentic Retrieval Engine Report

## 1. Executive Summary

This architecture upgrade transforms **ANVESHA** into a dual-mode intelligence platform:
1. **Mode A — Cloud Intelligence**: High-context reasoning via Google Gemini, Groq ultra-low-latency LPU, and multi-provider search (SearXNG, GitHub, OpenAlex, Jina, Firecrawl, Google Maps).
2. **Mode B — Local Offline Intelligence**: 100% private, zero-external-API search and agentic retrieval running locally on developer machines using **Ollama**, **SQLite FTS5 (BM25)**, **SQLite-backed Dense Vector Storage**, and local citation verification.

When **Local Mode** is active, ANVESHA enforces a **Strict Local Isolation Guarantee**: absolutely zero calls are made to external cloud AI APIs or external search endpoints, preventing private codebase queries from leaking onto the public internet.

---

## 2. Architecture & System Flow

```
                                      +---------------------------------------------+
                                      |            ANVESHA Front-End (Vite/React)    |
                                      +---------------------------------------------+
                                                             |
                                            POST /api/v2/search/stream (SSE)
                                                             |
                                      +---------------------------------------------+
                                      |            Unified Model Router 2.0         |
                                      +---------------------------------------------+
                                           /                                   \
             [Mode A: Cloud Intelligence] /                                     \ [Mode B: Local Offline Intelligence]
                                         /                                       \
               +---------------------------------+                       +---------------------------------+
               | - Gemini 3.5 Flash / Groq LPU   |                       | - Local Ollama (Llama 3 / Mistral)
               | - SearXNG Live Web Search       |                       | - Local nomic-embed-text (768d) |
               | - GitHub / OpenAlex / Maps API  |                       | - Local Codebase Scanner (AST)  |
               | - Cloud Fallbacks Enabled       |                       | - SQLite FTS5 (BM25 Keywords)   |
               +---------------------------------+                       | - SQLite Dense Vector Store     |
                                                                         | - Reciprocal Rank Fusion (RRF)  |
                                                                         | - 0 External Cloud Network Calls|
                                                                         +---------------------------------+
                                                                                         |
                                                                         +---------------------------------+
                                                                         |  Local Citation Grounding Check |
                                                                         +---------------------------------+
```

---

## 3. Core Local Components Implemented

### 3.1 Local Reasoning Provider (`OllamaProvider`)
- **File**: `backend/app/core/ai_provider.py`
- Implements `BaseAIProvider` with direct asynchronous communication to local Ollama runtime (`http://localhost:11434/api/chat`).
- Token-by-token Server-Sent Events (SSE) streaming with custom configurable timeout and keep-alive (`5m`).
- Health check via `GET /api/tags`: verifies daemon connectivity and checks if the requested model has been pulled.
- Strict isolation guard: when using Ollama, errors are reported with actionable resolution guides (`ollama serve`, `ollama pull llama3`), and never silently leak to cloud providers.

### 3.2 Local Embedding Provider (`OllamaEmbeddingProvider`)
- **File**: `backend/engine/semantic/embeddings.py`
- Offline dense text embeddings using `nomic-embed-text` (default 768 dimensions), `mxbai-embed-large`, or `all-minilm`.
- Supports batch embedding via `/api/embed` with automatic fallback to `/api/embeddings` for older Ollama daemon versions.
- **L2 Unit-Norm Normalization**: Every embedding vector is normalized to unit length ($\|v\|_2 = 1.0$), allowing rapid in-memory cosine similarity scanning using dot products:
  $$\text{CosineSim}(q, d) = \sum_{i=1}^D q_i \cdot d_i$$
- When strict mode is off and Ollama is unreachable, automatically uses deterministic local feature hashing (`LocalHashEmbeddingProvider`). When strict mode is on, raises a clear setup error.

### 3.3 SQLite Vector Storage & Model Isolation
- **File**: `backend/engine/semantic/vector_store.py`
- Stores dense embedding vectors as IEEE 754 32-bit binary float blobs (`BLOB`) in SQLite (`crawled_document_chunks`).
- **Embedding Space Isolation**: Prevents comparing vectors across different embedding spaces (e.g. Gemini 768-dim vs Nomic 768-dim) by filtering on `embedding_model` and `embedding_dim`.
- Provides `get_model_stats()` telemetry reporting active dimensions, chunk distribution, and model versions.

### 3.4 Hybrid Retrieval with Reciprocal Rank Fusion (RRF)
- **File**: `backend/engine/semantic/hybrid_retriever.py`
- Executes concurrent searches:
  1. **SQLite FTS5 BM25** keyword search over indexed crawled technical documentation.
  2. **Semantic Dense Vector Search** over chunked passages.
- Merges ranked lists using parameter-free Reciprocal Rank Fusion:
  $$RRF\_Score(d) = \sum_{m \in \{\text{bm25}, \text{vector}\}} \frac{w_m}{k + rank_m(d)}$$

### 3.5 Local Agentic Retrieval & Strict Local Mode
- **File**: `backend/app/api/search_v2.py`
- Supports `mode="local"` and `strict_local=True` in `POST /api/v2/search/stream`.
- Retrieval grounds exclusively on:
  - Local repository AST symbols and file lines (`scanner.search`).
  - Local uploaded project documents (`PlatformDB.search_document_chunks`).
  - Locally crawled documentation in SQLite (`hybrid_retriever.search_async`).
- Bypasses external search engines, weather panels, and geocoding providers.
- Local citation grounding verification via `citation_verifier.verify_answer_grounding`.

---

## 4. Hardware Profiles & Model Recommendations

| System RAM | Recommended LLM | Quantization | Recommended Embedding Model | Context Window |
|---|---|---|---|---|
| **4 GB - 8 GB** | `qwen2.5-coder:1.5b` or `phi3:mini` | Q4_K_M | `all-minilm` (384d) | 4,096 tokens |
| **8 GB - 16 GB** | `llama3:8b` or `mistral:7b` | Q4_K_M | `nomic-embed-text` (768d) | 8,192 tokens |
| **16 GB - 32 GB** | `llama3.1:8b` or `qwen2.5-coder:7b` | Q8_0 or FP16 | `nomic-embed-text` (768d) | 16,384 tokens |
| **32 GB+ / Discrete GPU** | `llama3.3:70b` (Q4) or `codellama:34b` | Q4_K_M / Q8 | `mxbai-embed-large` (1024d) | 32,768 tokens |

---

## 5. Setup and Run Instructions

### 5.1 Starting Ollama
1. Install Ollama:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. Start the Ollama background daemon:
   ```bash
   ollama serve
   ```
3. Pull the recommended local models:
   ```bash
   # Reasoning model
   ollama pull llama3

   # Embedding model
   ollama pull nomic-embed-text
   ```

### 5.2 Environment Configuration
In `backend/.env`:
```env
LOCAL_AI_ENABLED=true
LOCAL_AI_STRICT_MODE=false
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=llama3
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_TIMEOUT=180
EMBEDDING_PROVIDER=ollama
EMBEDDING_DIM=768
```

### 5.3 Running the Verification Suite
```bash
PYTHONPATH=backend:. backend/.venv/bin/python backend/tests/test_local_ollama_engine.py
```
**Results**:
```
======================================================================
ANVESHA LOCAL AI SEARCH & AGENTIC RETRIEVAL VERIFICATION SUITE
======================================================================
Running test_ollama_provider_configuration_and_factory()...
✓ Ollama provider configuration and factory verified.
Running test_ollama_provider_offline_health_handling()...
✓ Ollama provider offline health handling verified.
Running test_ollama_embedding_provider_and_normalization()...
✓ Ollama embedding provider and vector normalization verified.
Running test_vector_store_model_isolation()...
✓ SQLite Vector store model isolation and metadata verified.
Running test_model_router_local_routing()...
✓ Model router local routing verified.
Running test_search_stream_strict_local_mode()...
✓ Strict local mode stream execution and zero external API call guarantee verified.
Running test_crawler_politeness_security_and_deduplication()...
✓ Crawler politeness, SSRF guards, and deduplication verified.
======================================================================
ALL 7/7 LOCAL AI SEARCH & AGENTIC RETRIEVAL TESTS PASSED SUCCESSFULLY!
======================================================================
```
