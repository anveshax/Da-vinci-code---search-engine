# ANVESHA Search Engine Architecture

## 1. Universal Search Architecture Overview

ANVESHA is an AI-native universal search engine designed to discover, retrieve, normalize, and synthesize information from the open world wide web, local code repositories, and curated hybrid indexes.

```
                                USER QUERY
                                    │
                                    ▼
                         ANVESHA SEARCH INTERFACE
                        (React 18 + TS + Tailwind)
                                    │
                                    ▼ POST /api/v2/search/stream
                        QUERY UNDERSTANDING ENGINE
               (Intent, Operators, Typos, Entity Recognition)
                                    │
                                    ▼
                          ADAPTIVE SEARCH ROUTER
                    (Query Complexity & Intent Scoring)
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  SearXNG Engine  │      │ Internal Crawler │      │  Codebase AST    │
│  & Web Cascade   │      │ Hybrid BM25/Dense│      │  Symbol Scanner  │
└─────────┬────────┘      └─────────┬────────┘      └─────────┬────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    │
                                    ▼
                         RESULT NORMALIZATION
                        (Canonical URLs, HTTPS)
                                    │
                                    ▼
                        CONTENT DEDUPLICATION
                     (SimHash & Host/Path Clust)
                                    │
                                    ▼
                      CROSS-SIGNAL RERANKER
             (Exact phrase, Domain Trust, Reciprocal Rank)
                                    │
                                    ▼
                      CITATION VERIFIER & PROVENANCE
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌───────────────────────────┐                       ┌──────────────────┐
│ Real Organic SERP Results │                       │ Gemini Evidence  │
│ - Favicons & Verified Badg│                       │ Synthesis Stream │
│ - Sitelinks & Real Snippet│                       │ (AI Overview)    │
│ - Infinite Pagination     │                       └──────────────────┘
└───────────────────────────┘
```

---

## 2. Core Subsystems

### 2.1 Query Understanding Engine
- **Search Operators Extraction**: 
  - `site:domain.com` for domain constraints.
  - `-term` for excluded keywords.
  - `"exact phrase"` for mandatory matching.
  - `filetype:ext` for document formats.
  - `time:day|week|month|year` for freshness constraints.
- **Intent Classifier**: Categorizes queries into `navigational`, `technical`, `news`, `academic`, `informational`, or `transactional`.
- **Spelling Correction**: Identifies typographical errors and provides `Did you mean?` recommendations without silently corrupting user intent.

### 2.2 Resilient Multi-Provider Retrieval Cascade
1. **SearXNG Metasearch Microservice**: Aggregates 70+ engines concurrently via HTTP JSON API.
2. **Direct Search Fallback**: If SearXNG is offline or throttled:
   - Bing HTML Search (with base64 redirect decoder).
   - Yahoo HTML Search (with target URL extractor).
   - DuckDuckGo Search (DDGS & HTML).
3. **Internal Hybrid Index**: SQLite FTS5 BM25 combined with dense semantic embeddings via Reciprocal Rank Fusion (RRF).

### 2.3 Quality, Safety & Ranking Intelligence
- **Adult & Spam Filtering**: Strict domain hygiene prevents malware and adult sites from infiltrating organic results.
- **Relevance Validation**: Results returned by public scrapers must match at least 30% of significant query terms to prevent spoofed advertising results.
- **Navigational Intent Resolution**: Official websites (e.g. `web.whatsapp.com`, `github.com`, `python.org`) are verified using domain authority and presented at the top with verified checkmarks and direct sitelinks.

### 2.4 Evidence-Grounded AI Synthesis
- Gemini generates concise, grounded answer overviews based strictly on verified source citations.
- If Gemini is unreachable, organic search results remain 100% available and responsive.
