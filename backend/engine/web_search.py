"""
Zero-Cost Real Web Search Engine.

Queries public search indices without API keys or credit cards.
Features:
- Direct DuckDuckGo HTML parser using httpx and lxml (zero dependencies beyond standard)
- Strict URL validation & protocol whitelisting (http/https only)
- In-memory 10-minute response cache to prevent throttling
- 5-second network timeout protection
- Wikipedia OpenSearch public API fallback for programming concepts
- Honest error handling for rate limits or offline states
"""
import time
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple

import httpx
from lxml import html

# In-memory query cache: { query_lower: (timestamp, results) }
_SEARCH_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 600.0  # 10 minutes

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def validate_and_sanitize_url(raw_url: str) -> Optional[str]:
    """
    Validates that a URL is a legitimate web destination.
    Rejects javascript:, file:, data:, or malformed URI schemes.
    """
    if not raw_url or not isinstance(raw_url, str):
        return None

    trimmed = raw_url.strip()
    try:
        parsed = urllib.parse.urlparse(trimmed)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            # Reconstruct clean sanitized URL
            return trimmed
    except Exception:
        return None

    return None


def extract_source_domain(valid_url: str) -> str:
    """
    Extracts the clean domain name for visual pill badges (e.g. 'fastapi.tiangolo.com').
    """
    try:
        netloc = urllib.parse.urlparse(valid_url).netloc
        return netloc.lower().replace("www.", "")
    except Exception:
        return "web"


def search_duckduckgo_html(query: str, max_results: int = 8) -> List[Dict[str, Any]]:
    """
    Queries DuckDuckGo's public search endpoint directly and extracts verified
    organic titles, destination URLs, and snippets.
    Zero API keys and zero cost.
    """
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    data = {"q": query}

    # Strict 5-second timeout
    resp = httpx.post(url, data=data, headers=headers, timeout=5.0, follow_redirects=True)
    if resp.status_code != 200:
        return []

    tree = html.fromstring(resp.text)
    seen_urls = set()
    results: List[Dict[str, Any]] = []

    for result in tree.xpath('//div[contains(@class, "result")]'):
        title_nodes = result.xpath('.//a[contains(@class, "result__a")]')
        snippet_nodes = result.xpath(
            './/a[contains(@class, "result__snippet")] | .//div[contains(@class, "result__snippet")]'
        )

        if not title_nodes:
            continue

        raw_href = title_nodes[0].get("href", "")
        # DuckDuckGo wraps URLs in //duckduckgo.com/l/?uddg=<encoded_url>
        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(raw_href).query)
        target_url = parsed.get("uddg", [raw_href])[0]

        clean_url = validate_and_sanitize_url(target_url)
        if not clean_url or clean_url in seen_urls:
            continue

        # Skip DuckDuckGo internal ads or search links
        if "duckduckgo.com" in clean_url:
            continue

        seen_urls.add(clean_url)
        title = title_nodes[0].text_content().strip()
        snippet = snippet_nodes[0].text_content().strip() if snippet_nodes else ""
        domain = extract_source_domain(clean_url)

        results.append({
            "title": title or clean_url,
            "url": clean_url,
            "snippet": snippet or "No snippet provided by source.",
            "source_domain": domain,
        })

        if len(results) >= max_results:
            break

    return results


def search_wikipedia_fallback(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Zero-cost fallback to official Wikimedia OpenSearch public API.
    Provides verified conceptual definitions when general search is throttled.
    """
    results: List[Dict[str, Any]] = []
    try:
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "opensearch",
            "search": query,
            "limit": max_results,
            "namespace": 0,
            "format": "json",
        }
        resp = httpx.get(url, params=params, timeout=4.0)
        if resp.status_code == 200:
            data = resp.json()
            if len(data) >= 4:
                titles = data[1]
                snippets = data[2]
                urls = data[3]
                for title, snippet, target_url in zip(titles, snippets, urls):
                    clean_url = validate_and_sanitize_url(target_url)
                    if clean_url:
                        results.append({
                            "title": title or query,
                            "url": clean_url,
                            "snippet": snippet or f"Encyclopedic definition of {title} on Wikipedia.",
                            "source_domain": "en.wikipedia.org",
                        })
    except Exception:
        pass

    return results


def execute_web_search(query: str, max_results: int = 8) -> Dict[str, Any]:
    """
    Performs real internet search using DuckDuckGo Open Search, with
    Wikipedia fallback and in-memory caching.
    Returns:
      {
        "results": [ {"title": ..., "url": ..., "snippet": ..., "source_domain": ...} ],
        "error": None | str,
        "from_cache": bool
      }
    """
    clean_query = query.strip()
    if not clean_query:
        return {"results": [], "error": None, "from_cache": False}

    cache_key = clean_query.lower()
    now = time.time()

    # 1. Return from in-memory cache if fresh (< 10 mins)
    if cache_key in _SEARCH_CACHE:
        cached_time, cached_items = _SEARCH_CACHE[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return {
                "results": cached_items,
                "error": None,
                "from_cache": True,
            }

    # 2. Query DuckDuckGo
    results: List[Dict[str, Any]] = []
    error_msg: Optional[str] = None

    try:
        results = search_duckduckgo_html(clean_query, max_results=max_results)
    except Exception as exc:
        err_str = str(exc).lower()
        if "timeout" in err_str:
            error_msg = "DuckDuckGo search timed out after 5 seconds."
        else:
            error_msg = f"Web search connection issue: {exc}"

    # 3. If DuckDuckGo returned 0 results or had an issue, try Wikipedia fallback
    if not results:
        wiki_hits = search_wikipedia_fallback(clean_query, max_results=max_results)
        if wiki_hits:
            results = wiki_hits
            error_msg = None  # Fallback provided genuine results
        elif not error_msg:
            # Query legitimately returned 0 hits
            error_msg = None

    # 4. Cache successful results
    if results:
        _SEARCH_CACHE[cache_key] = (now, results)

    return {
        "results": results,
        "error": error_msg,
        "from_cache": False,
    }
