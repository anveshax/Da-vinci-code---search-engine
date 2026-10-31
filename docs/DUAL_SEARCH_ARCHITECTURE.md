# ANVESHA — Dual Search Architecture: Unified External Discovery & Independent Index

**Document Version**: 2.0  
**Date**: November 1, 2026  
**System**: ANVESHA AI Search & Multi-Agent Intelligence Engine  

---

## 1. Architectural Philosophy

Modern information retrieval faces a fundamental trade-off:
- **External Web Search (SearXNG / Search Proxies)**: Offers broad, real-time coverage across the global World Wide Web, but lacks localized control, custom indexing depth, offline capability, and low-latency guaranteed access.
- **Internal Web Crawler & Index (SQLite FTS5 + Semantic Vectors)**: Delivers instant sub-millisecond retrieval, deterministic ranking, domain-specific indexing, and private codebase/documentation intelligence, but cannot immediately cover the billions of live global web pages without years of distributed scraping.

**ANVESHA resolves this with a Unified Dual Search Architecture**. Instead of choosing between external search and internal crawling, ANVESHA runs both simultaneously in parallel, intelligently merging their signals with strict provenance attribution and zero single points of failure.

---

## 2. High-Level Data Flow

```
                                  [ User Query ]
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
               [ Query Understanding ]          [ Query Intelligence ]
             (Intent, Operators, Typos)      (site:, filetype:, time:)
                         │                               │
             ┌───────────┴───────────────────────────────┴───────────┐
             │                                                       │
             ▼                                                       ▼
  [ Internal Hybrid Retrieval ]                           [ External WWW Retrieval ]
  ├─ SQLite FTS5 BM25 Engine                              ├─ SearXNG Meta-Search Engine
  │  (crawled_documents_fts)                              │  (Parallel Categories: IT/News)
  └─ Dense Vector Store                                   └─ Multi-Provider Fallback Cascade
     (cosine similarity chunks)                              (Bing -> Yahoo -> DuckDuckGo)
             │                                                       │
             └───────────────────────────┬───────────────────────────┘
                                         ▼
                             [ Reciprocal Rank Fusion ]
                             [    & Reranking Engine  ]
                                         │
                             ├─ Duplicate Elimination
                             ├─ Domain Diversity Guarantee
                             ├─ Navigational Card Detection
                             └─ Provenance Tagging
                                         │
                                         ▼
                         [ Stream Response / SERP UI ]
                         ├─ Official Brand Card
                         ├─ AI Overview (SSE Streaming)
                         ├─ People Also Ask
                         ├─ Organic Results with Provenance
                         └─ Related Search Pills
```

---

## 3. Core Subsystems

### 3.1 Parallel Retrieval & Latency Budgeting
When a user submits a query, `backend/app/api/search_v2.py` triggers two asynchronous tasks via `asyncio.gather`:
1. **Internal Search Task**: Calls `hybrid_retriever.search_async()`, combining BM25 keyword matching with dense vector similarity via Reciprocal Rank Fusion (RRF, $k=60$).
2. **External Search Task**: Calls `searxng_client.search()`, routing to SearXNG or the resilient Bing/Yahoo/DDG scraper fallback cascade.

A total latency budget of 3,500ms is enforced. If external search takes longer due to upstream network lag, internal results are immediately ready to serve, ensuring the UI remains responsive.

### 3.2 Result Merging & Provenance Attribution
Every result returned to the user is tagged with its origin:
- `retrieval_source`: `"internal_index"` | `"searxng"` | `"bing"` | `"yahoo"` | `"duckduckgo"`
- `is_internal_index`: `true` | `false`
- `retrieval_method`: `"hybrid"` | `"bm25"` | `"semantic"` | `"web"`

The frontend SERP renders these tags clearly, allowing users to see when an answer was served from ANVESHA's local knowledge base versus discovered live on the web.

### 3.3 Failure Isolation & Circuit Breakers
- **SearXNG Down**: Automatically falls back to Bing, then Yahoo, then DuckDuckGo.
- **External Web Down (e.g. offline machine)**: Internal index immediately fulfills technical and documentation queries.
- **Internal Database Locked**: External web results proceed unhindered.
- **Gemini API Down**: Organic search results, official website cards, and pagination continue to render seamlessly.
