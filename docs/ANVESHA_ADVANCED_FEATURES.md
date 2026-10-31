# ANVESHA Advanced Search Features Guide

## 1. Google-Class Search Result Layout

ANVESHA implements a familiar, Google-inspired visual hierarchy in dark mode (`#202124` background, `#8ab4f8` links, `#e8eaed` text):

1. **Did You Mean Suggestion**: Appears when typographical errors are detected (e.g. searching `whatsap` suggests *whatsapp*).
2. **AI Overview Box**: Evidence-grounded synthesis streaming in real-time with clickable numbered citations.
3. **Verified Navigational Result Card**:
   - Favicon (`64px`)
   - Verified checkmark badge: `Official Website`
   - Destination URL and clean domain breadcrumb
   - Page title and informative snippet
   - Prominent **"Visit website"** action button opening in new tab (`target="_blank" rel="noopener noreferrer"`)
   - Sitelinks grid for top subpages
4. **Organic Web Results List**: Real, non-fabricated web pages with site name, favicons, publication dates, and external link actions.
5. **Pagination ("More search results")**: Dynamically loads next page of results seamlessly without full-page reloads.
6. **People Also Ask**: Interactive accordion questions based on related search intents.
7. **Code Matches Summary**: AST symbols and source code matches (when in auto or code mode).
8. **Related Searches**: Pill buttons for related topic exploration.

---

## 2. Advanced Search Operators

ANVESHA natively parses and respects Google-style search operators:

| Operator | Syntax Example | Meaning |
| :--- | :--- | :--- |
| **Domain Restriction** | `site:github.com python` | Limits search to the specified domain. |
| **Exact Phrase** | `"quantum entanglement"` | Matches the exact phrase in quotation marks. |
| **Term Exclusion** | `python tutorial -beginner` | Excludes results containing the negative term. |
| **File Type** | `filetype:pdf machine learning` | Scopes results to PDF documents. |
| **Time Freshness** | `time:week artificial intelligence` | Restricts search to recent articles. |

---

## 3. Search Vertical Categories

The interface and backend provide dedicated vertical filtering:

- **All / Web**: Comprehensive web search combining hybrid and external metasearch.
- **News**: Real-time news articles with publisher attribution and publication dates.
- **Images**: Verified open-licensed images from Wikimedia Commons with lightbox viewing.
- **Videos**: Direct YouTube API search integrations.
- **Maps**: Interactive OpenStreetMap bounding box and directions embedding.
- **Code**: Local workspace symbol and AST indexing with line-number jumps.
- **Tools**: Dependency graph, impact analysis, test gap scanner, and security audit.

---

## 4. Multi-Agent Deep Research Pipeline

For complex inquiries, **Deep Research Mode** executes a 5-step bounded DAG:
1. **Query Decomposition**: Breaks high-level research questions into focused sub-queries.
2. **Multi-Source Retrieval**: Queries hybrid vector indexes, document stores, and external search engines concurrently.
3. **Cross-Source Contradiction Detection**: Identifies conflicting claims across distinct domains.
4. **Deep Page Inspection**: Safely extracts deep content from primary sources using SSRF-protected scrapers.
5. **Synthesis & Citation Verification**: Assembles evidence-grounded research reports with verified provenance.
