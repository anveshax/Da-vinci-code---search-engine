"""
Web Search Engine & SSRF-Protected Research Scraper.

Supports:
- DuckDuckGo HTML parser (zero-cost, reliable fallback)
- Optional API providers (Tavily, Brave Search)
- Strict URL validation & SSRF protection (rejecting RFC1918, localhost, cloud metadata)
- In-memory 10-minute response cache
- NO Wikipedia fallback (honest reporting when zero results or throttled)
"""
import ipaddress
import logging
import socket
import time
import base64
import urllib.parse
import re
from typing import Dict, Any, List, Optional, Tuple

import httpx
from lxml import html

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory query cache: { query_lower: (timestamp, results) }
_SEARCH_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 600.0  # 10 minutes

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

BLOCKED_HOSTNAMES = {
    "localhost",
    "127.0.0.1",
    "::1",
    "metadata.google.internal",
    "169.254.169.254",
    "instance-data",
}


def is_safe_url(url: str) -> bool:
    """
    SSRF Protection:
    Ensures URL uses http/https and does not resolve to private, loopback,
    link-local, or cloud metadata IP addresses.
    """
    try:
        parsed = urllib.parse.urlparse(url.strip())
        if parsed.scheme not in ("http", "https"):
            return False

        hostname = (parsed.hostname or "").lower()
        if not hostname or hostname in BLOCKED_HOSTNAMES:
            return False

        # Attempt to resolve hostname to IP and check against forbidden ranges
        try:
            ip_str = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip_str)

            if (
                ip_obj.is_loopback
                or ip_obj.is_private
                or ip_obj.is_link_local
                or ip_obj.is_reserved
                or ip_obj.is_multicast
            ):
                return False
        except (socket.gaierror, ValueError):
            # If resolution fails, reject for security
            return False

        return True
    except Exception:
        return False


ADULT_AND_SPAM_PATTERNS = {
    "xhamster", "pornhub", "xvideos", "youporn", "redtube", "xnxx", "chaturbate",
    "onlyfans", "stripchat", "cam4", "livejasmin", "tube8", "spankbang", "beeg"
}


def validate_and_sanitize_url(raw_url: str) -> Optional[str]:
    """Validates that a URL is a legitimate web destination and passes safe-search domain hygiene."""
    if not raw_url or not isinstance(raw_url, str):
        return None

    trimmed = raw_url.strip()
    try:
        parsed = urllib.parse.urlparse(trimmed)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            host_low = parsed.netloc.lower()
            if any(p in host_low for p in ADULT_AND_SPAM_PATTERNS):
                return None
            return trimmed
    except Exception:
        return None

    return None


def extract_source_domain(valid_url: str) -> str:
    """Extracts clean domain name for visual pill badges."""
    try:
        netloc = urllib.parse.urlparse(valid_url).netloc
        return netloc.lower().replace("www.", "")
    except Exception:
        return "web"


def search_duckduckgo_html(query: str, max_results: int = 8) -> List[Dict[str, Any]]:
    """
    Queries DuckDuckGo's public search endpoint directly and extracts verified organic titles,
    destination URLs, and snippets. Zero API keys required.
    """
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    data = {"q": query}

    resp = httpx.post(url, data=data, headers=headers, timeout=6.0, follow_redirects=True)
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
        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(raw_href).query)
        target_url = parsed.get("uddg", [raw_href])[0]

        clean_url = validate_and_sanitize_url(target_url)
        if not clean_url or clean_url in seen_urls:
            continue

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


def search_tavily(query: str, max_results: int = 8) -> List[Dict[str, Any]]:
    """Tavily search API integration if TAVILY_API_KEY is configured."""
    api_key = settings.TAVILY_API_KEY
    if not api_key:
        return []

    try:
        resp = httpx.post(
            "https://api.tavily.com/search",
            json={"api_key": api_key, "query": query, "max_results": max_results},
            timeout=8.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            results = []
            for item in data.get("results", []):
                clean_url = validate_and_sanitize_url(item.get("url", ""))
                if clean_url:
                    results.append({
                        "title": item.get("title", clean_url),
                        "url": clean_url,
                        "snippet": item.get("content", ""),
                        "source_domain": extract_source_domain(clean_url),
                    })
            return results
    except Exception as e:
        logger.warning(f"Tavily search failed: {e}")
    return []


def search_brave(query: str, max_results: int = 8) -> List[Dict[str, Any]]:
    """Brave search API integration if BRAVE_API_KEY is configured."""
    api_key = settings.BRAVE_API_KEY
    if not api_key:
        return []

    try:
        headers = {"Accept": "application/json", "X-Subscription-Token": api_key}
        params = {"q": query, "count": max_results}
        resp = httpx.get("https://api.search.brave.com/res/v1/web/search", headers=headers, params=params, timeout=8.0)
        if resp.status_code == 200:
            data = resp.json()
            results = []
            for item in data.get("web", {}).get("results", []):
                clean_url = validate_and_sanitize_url(item.get("url", ""))
                if clean_url:
                    results.append({
                        "title": item.get("title", clean_url),
                        "url": clean_url,
                        "snippet": item.get("description", ""),
                        "source_domain": extract_source_domain(clean_url),
                    })
            return results
    except Exception as e:
        logger.warning(f"Brave search failed: {e}")
    return []


def search_exa(query: str, max_results: int = 8) -> List[Dict[str, Any]]:
    """Exa (Metaphor) search API integration if EXA_API_KEY is configured."""
    api_key = settings.EXA_API_KEY
    if not api_key:
        return []

    try:
        headers = {"x-api-key": api_key, "Content-Type": "application/json"}
        payload = {"query": query, "numResults": max_results, "useAutoprompt": True}
        resp = httpx.post("https://api.exa.ai/search", headers=headers, json=payload, timeout=8.0)
        if resp.status_code == 200:
            data = resp.json()
            results = []
            for item in data.get("results", []):
                clean_url = validate_and_sanitize_url(item.get("url", ""))
                if clean_url:
                    snippet = item.get("text", "") or item.get("snippet", "")
                    results.append({
                        "title": item.get("title", clean_url),
                        "url": clean_url,
                        "snippet": snippet[:500] if snippet else "No snippet provided.",
                        "source_domain": extract_source_domain(clean_url),
                    })
            return results
    except Exception as e:
        logger.warning(f"Exa search failed: {e}")
    return []


def decode_bing_url(href: str) -> str:
    """Decodes base64 tracking redirect URLs from Bing search results."""
    if "bing.com/ck/a" in href:
        try:
            parsed = urllib.parse.urlparse(href)
            params = urllib.parse.parse_qs(parsed.query)
            u_param = params.get("u", [""])[0]
            if u_param.startswith("a1"):
                raw_b64 = u_param[2:]
                raw_b64 += "=" * (-len(raw_b64) % 4)
                return base64.b64decode(raw_b64).decode("utf-8", errors="ignore")
        except Exception:
            pass
    return href


def decode_yahoo_url(href: str) -> str:
    """Decodes encoded target redirect URLs from Yahoo search results."""
    if "/RU=" in href:
        try:
            part = href.split("/RU=")[1].split("/RK=")[0]
            return urllib.parse.unquote(part)
        except Exception:
            pass
    return href


def search_bing_html(
    query: str,
    max_results: int = 8,
    page: int = 1,
    category: str = "general",
) -> List[Dict[str, Any]]:
    """
    Queries Bing's public search endpoint directly and extracts verified organic titles,
    destination URLs, snippets, and publication dates. Supports pagination and news category.
    """
    clean_q = urllib.parse.quote(query)
    if category == "news":
        url = f"https://www.bing.com/news/search?q={clean_q}"
    else:
        url = f"https://www.bing.com/search?q={clean_q}"

    if page > 1:
        first = (page - 1) * 10 + 1
        url += f"&first={first}"

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        resp = httpx.get(url, headers=headers, timeout=6.0)
        if resp.status_code != 200:
            return []

        tree = html.fromstring(resp.text)
        items = tree.xpath('//li[contains(@class, "b_algo")] | //div[contains(@class, "news-card")]')
        results = []
        seen = set()

        for it in items:
            title_nodes = it.xpath(".//h2//a | .//a[contains(@class, 'title')]")
            if not title_nodes:
                continue
            title = title_nodes[0].text_content().strip()
            raw_href = title_nodes[0].get("href", "")
            clean = validate_and_sanitize_url(decode_bing_url(raw_href))
            if not clean or clean in seen or "bing.com" in clean or not clean.startswith("http"):
                continue
            seen.add(clean)

            p_nodes = it.xpath('.//div[contains(@class, "b_caption")]//p | .//p | .//div[contains(@class, "snippet")]')
            snippet = p_nodes[0].text_content().strip() if p_nodes else ""

            # Check publication date / source
            date_nodes = it.xpath('.//span[contains(@class, "c_tdate")] | .//span[contains(@class, "news-card-date")]')
            pub_date = date_nodes[0].text_content().strip() if date_nodes else None

            results.append({
                "title": title or clean,
                "url": clean,
                "snippet": snippet or "No snippet provided.",
                "source_domain": extract_source_domain(clean),
                "published_date": pub_date,
            })
            if len(results) >= max_results:
                break

        # Relevance safeguard: check that retrieved results contain at least one significant query term
        query_words = [w.lower() for w in re.findall(r'[a-zA-Z0-9]+', query) if len(w) > 2]
        if query_words and results:
            relevant_count = sum(
                1 for r in results
                if any(w in (r["title"] + " " + r["snippet"] + " " + r["url"]).lower() for w in query_words)
            )
            if relevant_count / len(results) < 0.3:
                logger.info(f"Bing results lacked relevance for '{query}' ({relevant_count}/{len(results)} matches). Cascading.")
                return []

        return results
    except Exception as exc:
        logger.warning(f"Bing search query failed: {exc}")
        return []


def search_yahoo_html(
    query: str,
    max_results: int = 8,
    page: int = 1,
    category: str = "general",
) -> List[Dict[str, Any]]:
    """
    Queries Yahoo's public search endpoint directly and extracts verified organic titles,
    destination URLs, snippets, and publication dates. Supports pagination and news category.
    """
    clean_q = urllib.parse.quote(query)
    if category == "news":
        url = f"https://news.search.yahoo.com/search?p={clean_q}"
    else:
        url = f"https://search.yahoo.com/search?p={clean_q}"

    if page > 1:
        b_idx = (page - 1) * 10 + 1
        url += f"&b={b_idx}"

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        resp = httpx.get(url, headers=headers, timeout=6.0, follow_redirects=True)
        if resp.status_code != 200:
            return []

        tree = html.fromstring(resp.text)
        results = []
        seen = set()

        for li in tree.xpath('//ol[contains(@class, "searchCenterMiddle")]/li | //div[contains(@class, "NewsArticle")]'):
            a_nodes = li.xpath('.//div[contains(@class, "compTitle")]//a | .//h3//a | .//h4//a | .//a[contains(@class, "ac-algo")] | .//a[contains(@class, "thmb")]')
            if not a_nodes:
                continue

            h3_nodes = a_nodes[0].xpath('.//h3[contains(@class, "title")] | .//h3')
            if h3_nodes:
                title = h3_nodes[0].text_content().strip()
            else:
                title = a_nodes[0].text_content().strip()

            raw_href = a_nodes[0].get("href", "")
            clean = validate_and_sanitize_url(decode_yahoo_url(raw_href))
            if not clean or clean in seen or "search.yahoo.com" in clean or not clean.startswith("http"):
                continue
            seen.add(clean)

            p_nodes = li.xpath('.//div[contains(@class, "compText")] | .//p')
            snippet = p_nodes[0].text_content().strip() if p_nodes else ""

            results.append({
                "title": title or clean,
                "url": clean,
                "snippet": snippet or "No snippet provided.",
                "source_domain": extract_source_domain(clean),
            })
            if len(results) >= max_results:
                break
        return results
    except Exception as exc:
        logger.warning(f"Yahoo search query failed: {exc}")
        return []


def search_duckduckgo_ddgs(query: str, max_results: int = 8) -> List[Dict[str, Any]]:
    """
    Queries DuckDuckGo via the ddgs library.
    """
    try:
        from duckduckgo_search import DDGS
        with DDGS(timeout=10) as ddgs:
            raw_results = list(ddgs.text(query, max_results=max_results))
        results = []
        seen = set()
        for r in raw_results:
            clean_url = validate_and_sanitize_url(r.get("href", ""))
            if not clean_url or clean_url in seen:
                continue
            seen.add(clean_url)
            title = r.get("title", "")
            snippet = r.get("body", "")
            results.append({
                "title": title or clean_url,
                "url": clean_url,
                "snippet": snippet or "No snippet provided.",
                "source_domain": extract_source_domain(clean_url),
            })
        return results
    except Exception as exc:
        logger.warning(f"DDGS search failed: {exc}")
        return []


# Known brand to official domain mappings for accurate navigational intent resolution
KNOWN_BRAND_DOMAINS = {
    "whatsapp": ["whatsapp.com"],
    "facebook": ["facebook.com"],
    "instagram": ["instagram.com"],
    "youtube": ["youtube.com"],
    "github": ["github.com"],
    "linkedin": ["linkedin.com"],
    "amazon": ["amazon.com", "amazon.in", "amazon.co.uk", "amazon.de"],
    "google": ["google.com"],
    "python": ["python.org"],
    "twitter": ["twitter.com", "x.com"],
    "reddit": ["reddit.com"],
    "netflix": ["netflix.com"],
    "spotify": ["spotify.com"],
    "wikipedia": ["wikipedia.org"],
    "apple": ["apple.com"],
    "microsoft": ["microsoft.com"],
    "discord": ["discord.com"],
    "slack": ["slack.com"],
    "telegram": ["telegram.org", "t.me"],
    "zoom": ["zoom.us"],
    "pinterest": ["pinterest.com"],
    "quora": ["quora.com"],
    "medium": ["medium.com"],
    "twitch": ["twitch.tv"],
    "tiktok": ["tiktok.com"],
    "canva": ["canva.com"],
    "ebay": ["ebay.com"],
    "walmart": ["walmart.com"],
    "imdb": ["imdb.com"],
}


def detect_navigational_result(query: str, results: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Intelligently detects if a query has navigational intent (e.g. WhatsApp, Facebook, GitHub)
    and identifies the genuine official website candidate from actual search results.
    Never fabricates or guesses URLs; relies strictly on real results returned by providers.
    """
    if not query or not results:
        return None

    q_lower = query.strip().lower()
    words = [
        w for w in q_lower.split()
        if w not in ("official", "website", "site", "app", "online", "login", "web", "portal", "home", "page")
    ]
    if not words:
        return None

    core_keyword = words[0]
    expected_domains = KNOWN_BRAND_DOMAINS.get(core_keyword, [])

    candidates: List[Tuple[int, Dict[str, Any], str]] = []

    for r in results:
        url = r.get("url") or r.get("href", "")
        if not url:
            continue
        domain = extract_source_domain(url).lower()
        title = r.get("title", "")

        is_match = False
        if expected_domains and any(domain == exp or domain.endswith("." + exp) for exp in expected_domains):
            is_match = True
        elif domain.startswith(core_keyword + ".") or f".{core_keyword}." in domain or domain == f"{core_keyword}.com":
            is_match = True

        if is_match:
            parsed = urllib.parse.urlparse(url)
            is_root = parsed.path in ("", "/", "/en", "/en-us")
            weight = 10 if is_root else 5

            # If user explicitly searched 'web' (e.g. 'whatsapp web'), prioritize web subdomain
            if "web" in q_lower and "web." in domain:
                weight += 20

            candidates.append((weight, r, domain))

    if not candidates:
        return None

    # Sort candidates by weight descending
    candidates.sort(key=lambda c: c[0], reverse=True)
    best_item = candidates[0][1]
    best_domain = candidates[0][2]
    best_url = best_item.get("url") or best_item.get("href", "")

    # Collect sitelinks from other results on the same official domain
    sitelinks: List[Dict[str, str]] = []
    seen_urls = {best_url}
    for _, other_item, _ in candidates[1:]:
        other_url = other_item.get("url") or other_item.get("href", "")
        if other_url and other_url not in seen_urls and len(sitelinks) < 4:
            seen_urls.add(other_url)
            sitelinks.append({
                "title": other_item.get("title", ""),
                "url": other_url,
            })

    return {
        "title": best_item.get("title", best_domain),
        "url": best_url,
        "domain": best_domain,
        "snippet": best_item.get("snippet", ""),
        "is_official": True,
        "verified_badge": "Official Website",
        "site_name": best_domain.split(".")[0].capitalize(),
        "sitelinks": sitelinks,
    }


def execute_web_search(
    query: str,
    max_results: int = 8,
    page: int = 1,
    category: str = "general",
    operators: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Executes real web search with robust multi-provider cascade:
    1. Configured API providers (Tavily, Brave, Exa) if keys available
    2. Bing HTML search (fast, zero API keys, unthrottled, supports pagination & categories)
    3. Yahoo HTML search (reliable fallback, supports pagination & categories)
    4. DuckDuckGo HTML / DDGS scraper
    Includes query-level in-memory cache, pagination, and search operators.
    """
    clean_query = query.strip()
    if not clean_query:
        return {"results": [], "error": None, "from_cache": False, "navigational_result": None}

    cache_key = f"{clean_query.lower()}:{category}:{page}"
    now = time.time()

    # 1. In-memory cache hit
    if cache_key in _SEARCH_CACHE:
        cached_time, cached_items = _SEARCH_CACHE[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            nav_item = detect_navigational_result(clean_query, cached_items)
            return {
                "results": cached_items,
                "error": None,
                "from_cache": True,
                "navigational_result": nav_item,
                "page": page,
                "category": category,
            }

    results: List[Dict[str, Any]] = []
    error_msg: Optional[str] = None

    # 2. Try configured API providers first if available (for page 1)
    if page == 1 and category == "general":
        if settings.TAVILY_API_KEY:
            results = search_tavily(clean_query, max_results=max_results)
        elif settings.BRAVE_API_KEY:
            results = search_brave(clean_query, max_results=max_results)
        elif settings.EXA_API_KEY:
            results = search_exa(clean_query, max_results=max_results)

    # 3. Primary zero-cost provider: Bing HTML
    if not results:
        results = search_bing_html(clean_query, max_results=max_results, page=page, category=category)

    # Check if results are empty or lacked relevance on common web platforms
    q_norm = clean_query.lower()
    needs_fallback = len(results) == 0
    if not needs_fallback and q_norm in KNOWN_BRAND_DOMAINS and page == 1:
        if not any(q_norm in r["url"].lower() for r in results):
            needs_fallback = True

    # 4. Secondary zero-cost provider: Yahoo HTML
    if needs_fallback:
        yahoo_results = search_yahoo_html(clean_query, max_results=max_results, page=page, category=category)
        if yahoo_results:
            results = yahoo_results

    # 5. Tertiary zero-cost provider: DuckDuckGo (primarily general, page 1)
    if not results and page == 1:
        ddg_results = search_duckduckgo_ddgs(clean_query, max_results=max_results)
        if not ddg_results:
            ddg_results = search_duckduckgo_html(clean_query, max_results=max_results)
        if ddg_results:
            results = ddg_results

    # 6. Apply Search Operators Filtering if supplied
    if operators and results:
        site_filters = getattr(operators, "site_restrictions", [])
        excluded_words = getattr(operators, "excluded_terms", [])

        filtered = []
        for r in results:
            url_lower = r.get("url", "").lower()
            text_lower = (r.get("title", "") + " " + r.get("snippet", "")).lower()

            # Check site restriction
            if site_filters:
                if not any(s in url_lower for s in site_filters):
                    continue

            # Check excluded terms
            if excluded_words:
                if any(ex in text_lower for ex in excluded_words):
                    continue

            filtered.append(r)
        if filtered or site_filters or excluded_words:
            results = filtered

    if not results and not error_msg:
        error_msg = f"No public search results found for this query in category '{category}'."

    # Cache successful results
    if results:
        _SEARCH_CACHE[cache_key] = (now, results)

    # Detect navigational intent and official website
    nav_item = detect_navigational_result(clean_query, results)

    # Mark the official website item inside results if present
    if nav_item:
        for r in results:
            if r.get("url") == nav_item.get("url"):
                r["is_official"] = True
                if nav_item.get("sitelinks"):
                    r["sitelinks"] = nav_item["sitelinks"]

    return {
        "results": results,
        "error": error_msg,
        "from_cache": False,
        "navigational_result": nav_item,
        "page": page,
        "category": category,
    }


async def fetch_page_content_safe(url: str, max_chars: int = 3000) -> Optional[str]:
    """
    Safely fetches and extracts plain text / markdown from a web page with strict SSRF protection,
    size limits, and multi-tier extraction (Jina AI Reader -> Firecrawl -> Native HTML Parser).
    """
    if not is_safe_url(url):
        return None

    # Tier 1: Jina AI Reader (High-fidelity JavaScript Markdown extraction)
    try:
        from engine.integrations import jina_client
        if jina_client.is_configured:
            jina_md = await jina_client.read_url_markdown(url, max_chars=max_chars)
            if jina_md and len(jina_md) > 100:
                return jina_md
    except Exception as e:
        logger.debug(f"Jina reader fallback: {e}")

    # Tier 2: Firecrawl Scraper
    try:
        from engine.integrations import firecrawl_client
        if firecrawl_client.is_configured:
            fc_md = await firecrawl_client.scrape_url_markdown(url, max_chars=max_chars)
            if fc_md and len(fc_md) > 100:
                return fc_md
    except Exception as e:
        logger.debug(f"Firecrawl scraper fallback: {e}")

    # Tier 3: Native HTML extraction with SSRF guard and 4s timeout
    try:
        headers = {"User-Agent": USER_AGENT}
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return None

            content_type = resp.headers.get("content-type", "").lower()
            if "text/html" not in content_type and "text/plain" not in content_type:
                return None

            # Parse HTML and extract readable text
            tree = html.fromstring(resp.text)
            # Remove scripts and styles
            for bad in tree.xpath("//script | //style | //nav | //footer | //header"):
                bad.drop_tree()

            text = tree.text_content()
            clean_text = " ".join(text.split())
            return clean_text[:max_chars] if clean_text else None
    except Exception:
        return None
