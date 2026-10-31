# SearXNG Architecture Analysis & ANVESHA Integration Blueprint

## 1. Executive Summary

SearXNG is an AGPL-3.0-licensed privacy-respecting, metasearch engine written in Python. It aggregates results from over 70 search services (engines) across multiple categories without tracking users. 

This document analyzes the internal mechanics of SearXNG, its engine registration and execution models, request lifecycle, result normalization, scoring, deduplication, and defines the architectural boundary for integrating it into **ANVESHA** as an isolated, resilient microservice.

---

## 2. SearXNG Internal Architecture & Request Lifecycle

```
User Query (via ANVESHA SearXNGClient)
      │
      ▼
SearXNG Web Gateway (uWSGI / Flask / Aiohttp)
      │
      ▼
Query Parser & Search Query Builder
   ├── Language & Region Detection
   ├── Category Filter (:general, :images, :news, :it, etc.)
   ├── Search Operators (site:, -term, "phrase", time_range)
   └── SafeSearch Validation
      │
      ▼
Engine Dispatcher & Parallel Search Pool
   ├── Engine Selector (enabled engines matching category & lang)
   ├── ThreadPoolExecutor / Async Workers
   ├── Outbound HTTP Clients (httpx / requests with user-agent rotation)
   └── Rate-Limit & Circuit-Breaker Guards
      │
      ▼
Raw Engine Responses (HTML / JSON / XML)
      │
      ▼
Parser & Normalizer Pipeline
   ├── XPath / CSS Selector / JSON Pointer Extraction
   ├── Canonical URL Sanitization & Tracking Parameter Stripping
   ├── Media URL Normalization (Thumbnails, Proxies)
   └── Standard Output Representation (title, url, content, engine, score)
      │
      ▼
Aggregator & Deduplicator
   ├── Normalized URL Hashing (scheme + host + normalized path)
   ├── Near-Duplicate Content Clustering
   ├── Cross-Engine Evidence Merging & Engine Weight Scoring
   └── Ranking Sort (engine weight * rank position)
      │
      ▼
JSON Formatter (format=json)
      │
      ▼
ANVESHA Ingestion & Hybrid Reranking Engine
```

---

## 3. Core Subsystems in SearXNG

### 3.1 Search API & Response Serialization
SearXNG exposes an HTTP interface at `/search` accepting `GET` and `POST` queries:
- Query parameters:
  - `q`: Search query string
  - `format`: Response format (`html`, `json`, `csv`, `rss`)
  - `categories`: Filter category (e.g. `general`, `images`, `news`, `science`, `it`)
  - `engines`: Comma-separated list of engines to target specifically
  - `pageno`: Page number (1-indexed)
  - `time_range`: `day`, `week`, `month`, `year`
  - `safesearch`: `0` (off), `1` (moderate), `2` (strict)
  - `language`: Target language code (e.g. `en`, `all`)
- JSON Response structure:
  ```json
  {
    "query": "quantum computing",
    "number_of_results": 42,
    "results": [
      {
        "url": "https://example.com/quantum",
        "title": "Introduction to Quantum Computing",
        "content": "Quantum computing is a rapidly-emerging technology...",
        "engine": "google",
        "engines": ["google", "duckduckgo", "qwant"],
        "positions": [1, 2, 4],
        "score": 4.5,
        "category": "general",
        "publishedDate": "2026-03-15T00:00:00Z"
      }
    ],
    "answers": [],
    "corrections": [],
    "infoboxes": [],
    "suggestions": ["quantum computing algorithms", "quantum hardware"],
    "unresponsive_engines": []
  }
  ```

### 3.2 Query Parsing & Operator Syntax
SearXNG supports native prefix operators:
- `!category` or `:category`: Selects search vertical (e.g. `!news`, `!images`, `!it`, `!science`).
- `!engine`: Forces a specific search provider (e.g. `!bing`, `!github`, `!wikipedia`).
- `:language`: Specifies language filter (e.g. `:en`, `:de`).
- `"exact phrase"`: Quotes passed through to target engines.
- `-exclude`: Negative terms excluded from retrieval.
- `site:example.com`: Domain-restricted scoping.

### 3.3 Engine Execution & Failure Handling
- **Parallel Dispatch**: Searches are dispatched concurrently across configured engines using thread pools or coroutines.
- **Timeout Management**: Each engine is bounded by a strict timeout (typically 2.0 to 4.0 seconds).
- **Graceful Degradation**: If an upstream engine times out, triggers a CAPTCHA, or is blocked, it is added to `unresponsive_engines` while the remaining successful engine responses are merged and delivered without throwing a 500 error.

### 3.4 Result Normalization & Deduplication
- **URL Normalization**: Strips tracking tokens (e.g. `utm_source`, `utm_medium`, `fbclid`, `gclid`), trailing slashes, and anchors `#...`.
- **Merging Identical Destinations**: If multiple engines return the same canonical URL:
  - The URL is deduplicated.
  - The `engines` list records all contributing providers (e.g. `["bing", "duckduckgo", "brave"]`).
  - The combined score is calculated:
    $$\text{Score} = \sum_{e \in \text{engines}} \frac{\text{weight}(e)}{\text{position}(e)}$$
  - The longest or most informative snippet is retained.

---

## 4. AGPL-3.0 Licensing Boundaries & ANVESHA Architecture

### 4.1 Boundary Isolation
SearXNG is licensed under **GNU Affero General Public License v3.0 (AGPL-3.0)**. 
To ensure strict license compliance and architectural modularity:
1. **Never copy SearXNG source code directly into ANVESHA's Python backend.**
2. **Treat SearXNG as an isolated network microservice** running in a separate container or process.
3. All communication occurs over standard HTTP JSON APIs (`http://localhost:8080/search?q=...&format=json`).
4. ANVESHA remains under its own proprietary / MIT license boundary, communicating strictly over standard wire protocols.

### 4.2 Resilient Multi-Tier Fallback Strategy
If SearXNG is unavailable, starting up, or network-isolated:
1. **Tier 1 (SearXNG Microservice)**: Queries local or remote SearXNG JSON instance.
2. **Tier 2 (Direct Search Cascade)**: If SearXNG times out or is offline, ANVESHA automatically falls back to its built-in Python cascade:
   - Bing HTML Search (with direct base64 redirect decoding)
   - Yahoo Search (with real URL extraction)
   - DuckDuckGo Search (HTML / Lite)
   - Tavily / Brave Search APIs (when API keys are supplied in `.env`)
3. **Tier 3 (ANVESHA Crawler & Hybrid Index)**: Crawled documents from SQLite FTS5 + Semantic embeddings.
4. **Zero Downtime Guarantee**: The user always receives real organic results regardless of SearXNG container status.

---

## 5. Integration Architecture with ANVESHA

```
                    ┌─────────────────────────┐
                    │    ANVESHA Frontend     │
                    │  (React 18 + TS + Vite) │
                    └───────────┬─────────────┘
                                │ SSE: /api/v2/search/stream
                                ▼
                    ┌─────────────────────────┐
                    │  FastAPI Search Router  │
                    │    (search_v2.py)       │
                    └───────────┬─────────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
┌──────────────────┐                        ┌──────────────────┐
│  SearXNG Client  │                        │ Hybrid Retriever │
│ (searxng_client) │                        │ (BM25 + Semantic)│
└─────────┬────────┘                        └─────────┬────────┘
          │ HTTP JSON                                 │
          ▼                                           ▼
┌──────────────────┐                        ┌──────────────────┐
│ SearXNG Service  │                        │ ANVESHA Index DB │
│ (Port 8080)      │                        │  (SQLite FTS5)   │
└─────────┬────────┘                        └─────────┬────────┘
          │ (If offline: Tier 2 Cascade)              │
          └─────────────────────┬─────────────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │  Document Reranker &    │
                    │   Citation Verifier     │
                    └───────────┬─────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │   Gemini AI Overview    │
                    │ (Evidence Grounded SSE) │
                    └─────────────────────────┘
```

---

## 6. SearXNG Configuration Checklist for Production

- [x] Enable JSON output format (`formats: [html, json]`).
- [x] Configure safe search mode (`safesearch: 0` for development, `1` for production).
- [x] Configure bind address to `0.0.0.0:8080`.
- [x] Set secure randomized secret key.
- [x] Disable rate limiter for local loopback `127.0.0.1` / Docker bridge network.
- [x] Implement SearXNG health check probing endpoint in ANVESHA (`GET /api/v2/search/health`).
