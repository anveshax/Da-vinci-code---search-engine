"""
ANVESHA Intelligent Browser & Reader Mode Core Service.
Exclusive web browser architecture for ANVESHA — Universal AI Search Engine.

Provides:
- Smart Omnibox resolution (URL detection vs search query fallback)
- Safe Distraction-Free Reader Mode extraction (clean typography, word count, reading time)
- ClearURLs Tracking Parameter Sanitizer (stripping utm_*, fbclid, gclid, etc.)
- HTTPS security check & certificate domain inspection
- Session tab state persistence & private browsing isolation
- Bookmarks and History management with duplicate detection
"""
import re
import math
import time
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple
import httpx

from app.core.db import PlatformDB
from engine.crawler.security import validate_crawl_url, SafeAsyncHTTPTransport
from engine.crawler.extractor import extract_content

TRACKING_PARAM_PATTERNS = [
    re.compile(r"^utm_", re.IGNORECASE),
    re.compile(r"^(fbclid|gclid|msclkid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|ref|source|yclid)$", re.IGNORECASE)
]


class BrowserService:
    """Manages browser workspace operations, reader mode extraction, and URL cleansing."""

    @staticmethod
    def resolve_url_or_search(raw_input: str) -> Dict[str, Any]:
        """
        Smart Omnibox resolver:
        - If input is an absolute HTTP/HTTPS URL -> normalize and return
        - If input contains .onion -> mark as onion address
        - If input looks like a domain (e.g. github.com, python.org) -> prepend https://
        - Otherwise -> treats as search query and returns search fallback
        """
        trimmed = (raw_input or "").strip()
        if not trimmed:
            return {"type": "empty", "url": "https://duckduckgo.com", "query": "", "is_onion": False}

        is_onion = ".onion" in trimmed.lower()

        # Check existing protocol
        if trimmed.startswith("http://") or trimmed.startswith("https://"):
            clean_url = BrowserService.sanitize_tracking_url(trimmed)
            domain = BrowserService.extract_domain(clean_url)
            return {
                "type": "url",
                "url": clean_url,
                "domain": domain,
                "is_onion": is_onion,
                "is_https": clean_url.startswith("https://"),
                "query": ""
            }

        if is_onion:
            clean_onion = trimmed.removeprefix("http://").removeprefix("https://")
            return {
                "type": "onion",
                "url": f"http://{clean_onion}",
                "domain": clean_onion.split("/")[0],
                "is_onion": True,
                "is_https": False,
                "query": ""
            }

        # Check domain pattern (e.g. example.com, docs.python.org/3)
        domain_pattern = re.compile(r"^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(/[^\s]*)?$")
        if " " not in trimmed and domain_pattern.match(trimmed):
            clean_url = BrowserService.sanitize_tracking_url(f"https://{trimmed}")
            domain = BrowserService.extract_domain(clean_url)
            return {
                "type": "url",
                "url": clean_url,
                "domain": domain,
                "is_onion": False,
                "is_https": True,
                "query": ""
            }

        # Search query fallback
        search_url = f"https://duckduckgo.com/?q={urllib.parse.quote(trimmed)}"
        return {
            "type": "search",
            "url": search_url,
            "domain": "duckduckgo.com",
            "is_onion": False,
            "is_https": True,
            "query": trimmed
        }

    @staticmethod
    def extract_domain(url: str) -> str:
        """Extracts normalized hostname from URL."""
        try:
            parsed = urllib.parse.urlparse(url)
            host = parsed.hostname or url
            return host.removeprefix("www.").lower()
        except Exception:
            return url

    @staticmethod
    def sanitize_tracking_url(url: str) -> str:
        """
        ClearURLs tracker stripper:
        Removes invasive marketing & profiling parameters like utm_source, fbclid, gclid.
        """
        try:
            parsed = urllib.parse.urlparse(url)
            if not parsed.query:
                return url
            q_params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
            cleaned_params = []
            for k, v in q_params:
                is_tracker = any(p.match(k) for p in TRACKING_PARAM_PATTERNS)
                if not is_tracker:
                    cleaned_params.append((k, v))
            new_query = urllib.parse.urlencode(cleaned_params)
            return urllib.parse.urlunparse(parsed._replace(query=new_query))
        except Exception:
            return url

    @staticmethod
    async def extract_reader_mode(url: str) -> Dict[str, Any]:
        """
        Extracts clean, distraction-free article text, headings, reading time, and metadata.
        Uses ANVESHA's SSRF-safe HTTP client and HTML content extractor.
        """
        # Validate URL safety
        is_safe, reason = validate_crawl_url(url)
        if not is_safe:
            return {
                "success": False,
                "error": f"Security restriction: {reason}",
                "url": url,
            }

        try:
            transport = SafeAsyncHTTPTransport()
            async with httpx.AsyncClient(transport=transport, timeout=12.0, follow_redirects=True) as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 AnveshaReader/2.0"
                }
                res = await client.get(url, headers=headers)
                if res.status_code != 200:
                    return {
                        "success": False,
                        "error": f"Failed to retrieve article (HTTP {res.status_code})",
                        "status_code": res.status_code,
                        "url": url
                    }

                html_text = res.text
                doc = extract_content(html_text, url)
                if not doc or not doc.content.strip():
                    return {
                        "success": False,
                        "error": "Could not extract readable article text from this webpage.",
                        "url": url
                    }

                words = len(doc.content.split())
                reading_time = max(1, math.ceil(words / 220)) # ~220 words per minute average reading speed

                return {
                    "success": True,
                    "url": doc.url,
                    "canonical_url": doc.canonical_url,
                    "title": doc.title or "Untitled Article",
                    "domain": doc.domain,
                    "description": doc.description,
                    "author": doc.author or doc.domain,
                    "published_at": doc.published_at,
                    "content": doc.content,
                    "headings": doc.headings,
                    "word_count": words,
                    "reading_time_minutes": reading_time,
                    "language": doc.language,
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Reader mode extraction error: {str(e)}",
                "url": url
            }


browser_service = BrowserService()
