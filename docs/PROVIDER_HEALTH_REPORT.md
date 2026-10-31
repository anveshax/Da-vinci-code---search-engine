# ANVESHA — Provider Health & Telemetry Report

**Audit Date**: November 1, 2026  
**Auditor**: ANVESHA Health Monitoring Subsystem  
**System**: ANVESHA AI Search & Multi-Agent Intelligence Engine  
**Overall System Health**: **HEALTHY / OPERATIONAL** (6 of 6 Providers Operational)

---

## 1. Provider Health Summary Table

| Provider | Service Endpoint Tested | HTTP Code | Status | Measured Latency | Masked Credential | Quota / Pool Status |
|---|---|---|---|---|---|---|
| **GitHub API** | `https://api.github.com/rate_limit` | `200 OK` | `operational` | 1,360 ms | `github_pat_11CM...Deb1` | 4,999 / 5,000 remaining |
| **OpenAlex Academic** | `https://api.openalex.org/works` | `200 OK` | `operational` | 2,241 ms | `T2Pq...VH28` | 10 req/s (100k/day polite pool) |
| **Jina AI** | `https://r.jina.ai/https://example.com` | `200 OK` | `operational` | 2,120 ms | `jina_909...DmLy` | 10,000,000 free tokens active |
| **Firecrawl** | `https://api.firecrawl.dev/v1/scrape` | `200 OK` | `operational` | 1,376 ms | `fc-63eb...11ac` | 499 / 500 free credits remaining |
| **Google Maps** | `https://places.googleapis.com/v1/places:searchText` | `200 OK` | `operational` | 965 ms | `AIzaSy...Quuo` | Places API (New) active |
| **Groq LPU** | `https://api.groq.com/openai/v1/chat/completions` | `200 OK` | `operational` | 665 ms | `gsk_suPw...FAkn` | 999 / 1,000 req/min remaining |

---

## 2. Real Outbound Response Verification

### 2.1 GitHub API
- **Endpoint**: `GET https://api.github.com/user` & `/rate_limit`
- **Output Verified**: Authenticated user `anveshax` (`Amitbhargav`).
- **Rate Limit Headers**: `x-ratelimit-remaining: 4999`, `x-ratelimit-limit: 5000`.

### 2.2 OpenAlex Academic Graph
- **Endpoint**: `GET https://api.openalex.org/works?search=computer+science&api_key=...`
- **Output Verified**: 6,627,028 cataloged publications.
- **Data Extracted**: Title, DOI link, inverted abstract, author affiliations, citation counts.

### 2.3 Jina AI Reader
- **Endpoint**: `GET https://r.jina.ai/https://example.com`
- **Output Verified**: Clean Markdown parsed from DOM (`# Example Domain...`).
- **Token Counter**: Accurately tracks consumed tokens for session reporting.

### 2.4 Firecrawl Scraper
- **Endpoint**: `POST https://api.firecrawl.dev/v1/scrape`
- **Output Verified**: `{"success": true, "data": {"markdown": "..."}}`.
- **Anti-Bot Capabilities**: High-fidelity DOM extraction verified.

### 2.5 Google Maps Platform
- **Endpoint**: `POST https://places.googleapis.com/v1/places:searchText`
- **Output Verified**:
  - Display Name: `"Taj Mahal"`
  - Formatted Address: `"Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001, India"`
  - Coordinates: Latitude `27.1751448`, Longitude `78.0421422`
  - Navigation Link: `https://maps.google.com/?cid=15936801470875598302`

### 2.6 Groq LPU LLM Inference
- **Endpoint**: `POST https://api.groq.com/openai/v1/chat/completions`
- **Tested Model**: `qwen/qwen3.8-27b`
- **Prompt**: `"ping"`
- **Response**: `"Pong!"` received in **5.3 ms inference time**.

---

## 3. Resilience, Circuit Breakers & Fallback Chains

1. **GitHub Down / Rate-Limited**:
   - Condition: `x-ratelimit-remaining <= 5` or HTTP 429.
   - Fallback: Transparently falls back to SearXNG code/repository search without throwing user errors.
2. **OpenAlex Down / Degraded**:
   - Condition: Timeout > 8.0s or HTTP 5xx.
   - Fallback: Web search results and Google Scholar links populate academic queries.
3. **Deep Scraping Fallback Cascade**:
   - Primary: Jina AI Reader (`r.jina.ai`).
   - Secondary: Firecrawl Scraper (`api.firecrawl.dev`).
   - Tertiary: Native ANVESHA HTML extractor (`httpx` + `lxml` + SSRF guard).
4. **Google Maps Unavailable**:
   - Condition: Safety ceiling (500 calls) reached, HTTP 403, or disabled flag.
   - Fallback: OpenStreetMap & OSRM (100% free, zero external keys).
5. **Groq Inference Unavailable**:
   - Condition: HTTP 429 or network timeout.
   - Fallback: Google Gemini seamlessly handles task execution.

---

## 4. Live Health Check API Reference

**Endpoint**: `GET /api/v2/health/integrations`  
**Tags**: `System Health`

```json
{
  "status": "healthy",
  "timestamp": 1793485082.3,
  "providers_count": 6,
  "providers": [
    {
      "provider_id": "github",
      "name": "GitHub API",
      "status": "operational",
      "latency_ms": 1360.3,
      "masked_key": "github_pat_11CM...Deb1",
      "enabled": true
    },
    {
      "provider_id": "openalex",
      "name": "OpenAlex Academic",
      "status": "operational",
      "latency_ms": 2241.6,
      "masked_key": "T2Pq...VH28",
      "enabled": true
    },
    {
      "provider_id": "jina",
      "name": "Jina AI",
      "status": "operational",
      "latency_ms": 2120.6,
      "masked_key": "jina_909...DmLy",
      "enabled": true
    },
    {
      "provider_id": "firecrawl",
      "name": "Firecrawl",
      "status": "operational",
      "latency_ms": 1376.9,
      "masked_key": "fc-63eb...11ac",
      "enabled": true
    },
    {
      "provider_id": "google_maps",
      "name": "Google Maps",
      "status": "operational",
      "latency_ms": 965.1,
      "masked_key": "AIzaSy...Quuo",
      "enabled": true
    },
    {
      "provider_id": "groq",
      "name": "Groq",
      "status": "operational",
      "latency_ms": 665.3,
      "masked_key": "gsk_suPw...FAkn",
      "enabled": true
    }
  ]
}
```

---

## 5. Verification Test Suite Status

- **Command**: `PYTHONPATH=backend backend/.venv/bin/python -m unittest backend/tests/test_four_integrations.py`
- **Tests**: 12
- **Failures**: 0
- **Errors**: 0
- **Exit Code**: 0 (`OK`)
