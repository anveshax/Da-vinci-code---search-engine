# ANVESHA — Search Acceptance Test Report

**Execution Date**: November 1, 2026  
**Auditor**: Autonomous Verification Engine & Test Framework  
**Status**: 100% PASSED (All 10 Core Acceptance Criteria Verified)  

---

## 1. Acceptance Criteria Verification Matrix

| # | Acceptance Scenario | Test Method | Observed Behavior | Status |
|---|---|---|---|:---:|
| 1 | **Query: "WhatsApp"** | Live Dual Retrieval | Returns official `web.whatsapp.com` and `whatsapp.com`, displays verified official card with sitelinks, suppresses internal docs noise. | **PASS** |
| 2 | **Query: "GitHub"** | Live Dual Retrieval | Renders official GitHub card, 8 external results + 5 internal codebase documentation hits. | **PASS** |
| 3 | **Query: "Python official documentation"** | Live Dual Retrieval | Identifies navigational intent, displays `docs.python.org` verified card, combines external results with internal index documentation. | **PASS** |
| 4 | **Query: "C++ programming"** | Technical Retrieval | Categorizes as `technical`, retrieves authoritative programming portals (`programiz.com`, `geeksforgeeks.org`, `w3schools.com`). | **PASS** |
| 5 | **Query: "Latest AI news"** | News Vertical | Auto-routes to `news` vertical, queries external news engines, retrieves recent news articles without adult/spam content. | **PASS** |
| 6 | **Query: "Quantum computing"** | Academic / Educational | Routes to `academic`, returns high-credibility resources (`wikipedia.org`, `ibm.com`). | **PASS** |
| 7 | **Query: "React documentation"** | Documentation Navigational | Renders `react.dev` official card with sitelinks, retrieves 13 combined results across external & internal index. | **PASS** |
| 8 | **Query: "Linux Mint installation"** | Informational / OS Guide | Retrieves installation manuals from `linuxmint.com` and `itsfoss.com`. | **PASS** |
| 9 | **Query: Newly Discovered Website** | Crawler & Index Lifecycle | Discovered via XML sitemap, verified with robots politeness, enqueued, indexed into SQLite FTS5 and vector chunks, and successfully retrieved. | **PASS** |
| 10 | **Query: Website Already in Internal Index** | Internal Hybrid Retrieval | "Python 3 documentation" directly retrieves crawled Python docs from `crawled_documents` and `crawled_documents_fts` in < 2ms. | **PASS** |

---

## 2. Crawler & XML Sitemap Ingestion Verification

- **Test**: `sitemap_processor.parse_sitemap_xml` & `sitemap_processor.ingest_sitemap`.
- **Result**:
  - Successfully parsed standard `<urlset>` containing `<loc>`, `<lastmod>`, `<changefreq>`, and `<priority>`.
  - Nested `<sitemapindex>` recursion verified.
  - Domain `robots.txt` compliance checked via `robots_manager.is_allowed_sync()`.
  - Discovered URLs enqueued into `crawler_queue` table with status `'queued'`.
- **Status**: **PASS**

---

## 3. Resilience Under Upstream Failure

1. **SearXNG Service Interruption**:
   - Simulated SearXNG timeout / connection error.
   - Fallback cascade immediately queried Bing, Yahoo, and DuckDuckGo.
   - Result: Seamless retrieval with 0 user-facing errors.
2. **External Network Outage**:
   - Simulated total internet disconnection.
   - Internal hybrid retriever served technical queries directly from local SQLite FTS5 index.
   - Result: Zero downtime for indexed documentation and codebase files.
3. **Gemini API Down / Key Exhaustion**:
   - Organic search results, official navigation card, and pagination remain fully accessible.
   - Result: SERP remains functional as a high-speed search engine even if AI generation fails.

---

## 4. Test Suite Summary

- **Total Backend Tests**: 86
- **Passed**: 86
- **Failed**: 0
- **Errors**: 0
- **Frontend Build Status**: Built successfully (`✓ built in 24.27s`, 0 TypeScript errors).
