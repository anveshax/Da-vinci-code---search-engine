"""
URL Normalization, Canonicalization, and Link Extraction Utilities for ANVESHA.
"""
import re
from typing import List, Set, Optional, Tuple
from urllib.parse import urlparse, urlunparse, urljoin, parse_qsl, urlencode
import lxml.html

# Tracking query parameters to strip during normalization
TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "gclsrc", "dclid", "yclid", "msclkid",
    "ref", "ref_src", "source", "_ga", "_gl", "mc_eid", "v",
    "sessionId", "session_id", "PHPSESSID", "jsessionid"
}

# Regex to collapse multiple slashes in path
MULTI_SLASH_REGEX = re.compile(r"/+")


def normalize_url(raw_url: str) -> str:
    """
    Normalizes a URL to a canonical format for consistent hashing and deduplication:
    1. Trims whitespace
    2. Strips URL fragments (#anchor)
    3. Lowercases scheme and hostname
    4. Removes default ports (:80 on http, :443 on https)
    5. Strips tracking query parameters (UTM, fbclid, etc.)
    6. Sorts remaining query parameters alphabetically
    7. Cleans and normalizes redundant path slashes
    """
    if not raw_url or not isinstance(raw_url, str):
        return ""

    raw_url = raw_url.strip()
    try:
        parsed = urlparse(raw_url)
    except Exception:
        return raw_url

    scheme = parsed.scheme.lower()
    hostname = (parsed.hostname or "").lower()
    port = parsed.port

    # Remove default ports
    if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
        netloc = hostname
    elif port:
        netloc = f"{hostname}:{port}"
    else:
        netloc = hostname

    # Clean path: collapse multiple slashes
    path = parsed.path
    if path:
        path = MULTI_SLASH_REGEX.sub("/", path)
    else:
        path = "/"

    # Strip tracking parameters and sort remaining query params
    filtered_params = []
    if parsed.query:
        query_pairs = parse_qsl(parsed.query, keep_blank_values=False)
        for k, v in query_pairs:
            k_lower = k.lower()
            if k_lower not in TRACKING_PARAMS and not k_lower.startswith("utm_"):
                filtered_params.append((k, v))
        filtered_params.sort(key=lambda x: x[0])

    normalized_query = urlencode(filtered_params) if filtered_params else ""

    # Fragments are stripped entirely
    fragment = ""

    return urlunparse((scheme, netloc, path, parsed.params, normalized_query, fragment))


def extract_canonical_url(html_content: str, base_url: str) -> Optional[str]:
    """
    Extracts the canonical URL declared in <link rel="canonical" href="...">
    and resolves it against base_url.
    """
    if not html_content:
        return None

    try:
        doc = lxml.html.fromstring(html_content)
        canonical_tags = doc.xpath('//link[translate(@rel, "CANONICAL", "canonical")="canonical"]/@href')
        if canonical_tags:
            raw_canonical = str(canonical_tags[0]).strip()
            if raw_canonical:
                full_canonical = urljoin(base_url, raw_canonical)
                return normalize_url(full_canonical)
    except Exception:
        pass

    return None


def extract_links(
    html_content: str,
    base_url: str,
    allowed_domains: Optional[List[str]] = None,
    allowed_path_prefixes: Optional[List[str]] = None
) -> List[str]:
    """
    Extracts all valid HTML hyperlinks (<a href="...">) from page content,
    resolves relative paths to absolute URLs, normalizes them, and filters
    against domain and path restrictions.
    """
    if not html_content:
        return []

    discovered: Set[str] = set()
    normalized_allowed = [d.lower().strip() for d in (allowed_domains or []) if d.strip()]

    try:
        doc = lxml.html.fromstring(html_content)
        raw_hrefs = doc.xpath("//a/@href")
        
        for href in raw_hrefs:
            if not href or not isinstance(href, str):
                continue
            href = href.strip()

            # Ignore non-navigational schemes
            href_lower = href.lower()
            if any(href_lower.startswith(prefix) for prefix in ("javascript:", "mailto:", "tel:", "data:", "ftp:", "#")):
                continue

            # Resolve relative link to absolute URL
            absolute_url = urljoin(base_url, href)
            norm_url = normalize_url(absolute_url)
            if not norm_url:
                continue

            parsed = urlparse(norm_url)
            if parsed.scheme not in ("http", "https"):
                continue

            # Domain boundary check
            if normalized_allowed:
                host = (parsed.hostname or "").lower()
                domain_matches = any(host == d or host.endswith("." + d) for d in normalized_allowed)
                if not domain_matches:
                    continue

            # Path prefix filter check (if configured)
            if allowed_path_prefixes:
                path = parsed.path or "/"
                if not any(path.startswith(prefix) for prefix in allowed_path_prefixes):
                    continue

            discovered.add(norm_url)

    except Exception:
        pass

    return list(discovered)
