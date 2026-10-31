# ANVESHA — API Usage, Cost Control & Quotas Report

**Date**: November 1, 2026  
**Auditor**: ANVESHA Cost Control & Usage Audit Subsystem  
**System**: ANVESHA AI Search & Multi-Agent Intelligence Engine  

---

## 1. Provider Cost & Quota Matrix

| Provider | Free Tier Allocation | Overage / Standard Pricing | Billing Exposure Risk | ANVESHA Guardrail Implemented |
|---|---|---|:---:|---|
| **GitHub API** | 5,000 requests / hour | $0.00 (Hard rate limit, no credit card required) | **Zero** | Reads `x-ratelimit-remaining`; throttles when $\le 5$ calls remain. 5-minute TTL caching. |
| **OpenAlex** | 100,000 requests / day (Polite Pool) | $0.00 (100% Free Open Science Graph) | **Zero** | Respects 10 req/s polite pool pacing. 15-minute TTL caching. |
| **Jina AI** | 10,000,000 tokens included free | ~$0.02 / 1M tokens | **Low** | Tracks tokens consumed; 30-minute URL content caching. Falls back to Firecrawl or native parser. |
| **Firecrawl** | 500 scrape credits free | ~$0.003 / scrape | **Medium** | Session limit: hard-coded safety stop at 490 credits to prevent automatic credit exhaustion. 30-min caching. |
| **Google Maps Platform** | $200 monthly free Google Cloud credit | $0.032 / request ($32 / 1,000 requests) | **High** | Session call limit: caps at 500 requests per session ($16 max value). Automatic fallback to OpenStreetMap (100% free). |
| **Groq LPU** | Generous Free Rate Limits (1,000 req/min) | ~$0.05 / 1M prompt tokens, ~$0.08 / 1M completion tokens | **Low** | Free tier rate headers tracked (`x-ratelimit-remaining-*`); prompt & completion token cost tracked. |

---

## 2. In-Memory Caching & Deduplication Savings

ANVESHA implements a unified in-memory [`SimpleTTLCache`](file:///home/amit/codebasec%20intelligemce%20engine/backend/engine/integrations.py#L48-L78) for all external integrations:

- **GitHub Repositories**: 300s (5 minutes) TTL.
- **OpenAlex Academic Papers**: 900s (15 minutes) TTL.
- **Jina AI Reader**: 1,800s (30 minutes) TTL.
- **Firecrawl Scraper**: 1,800s (30 minutes) TTL.
- **Google Maps Places**: 3,600s (1 hour) TTL.
- **Groq LLM Outputs**: 300s (5 minutes) TTL.

**Impact**: Repeated user queries or frequent re-crawling of popular links are resolved entirely in memory with $0.00$ cost and $< 1\text{ ms}$ latency.

---

## 3. Google Maps Platform: Security & Quota Controls

Because Google Cloud operates on a consumption-based billing model, ANVESHA enforces strict architectural protections:

1. **Selective Invocation**:
   Google Maps is **only** invoked for location, map, landmark, or navigation queries. It is never queried for general web search, technical coding, or academic queries.
2. **Session Spending Ceiling**:
   [`GoogleMapsClient`](file:///home/amit/codebasec%20intelligemce%20engine/backend/engine/integrations.py#L425) enforces a ceiling of 500 requests per session. If reached, the engine automatically falls back to OpenStreetMap / OSRM.
3. **Recommended Google Cloud Console Hardening**:
   - **API Restrictions**: In the [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials), restrict `AIzaSy...Quuo` to specifically:
     - *Places API (New)*
     - *Maps Embed API*
   - **Billing Budgets & Alerts**: Set up a **$0.00 budget alert** with an automated notification at 50%, 90%, and 100% of the $200 free credit tier.
   - **Daily Quotas**: In *APIs & Services $\rightarrow$ Quotas*, set a daily request cap of 200 requests/day to prevent runaway loops.

---

## 4. Live Session Usage Measurement

As measured by ANVESHA's [`CostTracker`](file:///home/amit/codebasec%20intelligemce%20engine/backend/engine/integrations.py#L82-L135) during verification:

- **Total API Calls**: 14 outbound requests across all 6 services.
- **GitHub**: 3 calls (0 credits, $0.00).
- **OpenAlex**: 2 calls (0 credits, $0.00).
- **Jina AI**: 2 calls (150 tokens, $0.00 within 10M free pool).
- **Firecrawl**: 2 calls (2 credits, $0.00 within 500 free credit pool).
- **Google Maps**: 2 calls (2 requests, $0.064 estimated value covered by $200 free credit).
- **Groq**: 3 calls (65 tokens, $0.00 on free tier).
- **Net Out-of-Pocket Expense**: **$0.00 USD**.

---

## 5. Dynamic Kill-Switch Controls

If any provider needs to be disabled immediately to halt API calls:

```bash
# Disable Google Maps dynamically via REST API:
curl -X POST "http://localhost:8000/api/v2/health/integrations/google_maps/toggle?enabled=false"

# Query current usage and cost tally:
curl -s "http://localhost:8000/api/v2/health/integrations/usage" | python3 -m json.tool
```

When disabled, ANVESHA immediately falls back to OpenStreetMap or local heuristics without returning errors to the user.
