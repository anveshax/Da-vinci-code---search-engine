"""
Sitemap Discovery & Processing Subsystem for ANVESHA.

Supports:
1. XML Sitemaps (<urlset> with <loc>, <lastmod>, <priority>, <changefreq>).
2. Sitemap Indexes (<sitemapindex> with nested <sitemap> entries).
3. Gzipped sitemaps (.xml.gz).
4. Automatic sitemap discovery via robots.txt and standard locations (/sitemap.xml).
5. Safe HTTP fetching with SSRF protection and size limits.
6. Enqueuing discovered URLs into ANVESHA's persistent frontier queue.
"""
import gzip
import io
import time
import logging
import urllib.parse
from typing import List, Dict, Any, Optional, Set
import xml.etree.ElementTree as ET

import httpx

from app.core.db import get_db_connection
from engine.crawler.url_utils import normalize_url
from engine.crawler.security import validate_crawl_url
from engine.crawler.robots import robots_manager

logger = logging.getLogger(__name__)

USER_AGENT = "ANVESHA-Crawler/2.0 (+https://anvesha.internal/bot; research-engine)"


def is_valid_http_url(url: str) -> bool:
    """Validates that a URL is well-formed with http or https scheme."""
    if not url or not isinstance(url, str):
        return False
    try:
        p = urllib.parse.urlparse(url.strip())
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:
        return False


def is_safe_sitemap_url(url: str) -> bool:
    """Wrapper checking SSRF and scheme safety for sitemap targets."""
    safe, _ = validate_crawl_url(url)
    return safe


class SitemapURL:
    """Represents a discovered URL from an XML sitemap."""

    def __init__(
        self,
        loc: str,
        lastmod: Optional[str] = None,
        changefreq: Optional[str] = None,
        priority: Optional[float] = None,
    ):
        self.loc = loc
        self.lastmod = lastmod
        self.changefreq = changefreq
        self.priority = priority or 0.5

    def to_dict(self) -> Dict[str, Any]:
        return {
            "loc": self.loc,
            "lastmod": self.lastmod,
            "changefreq": self.changefreq,
            "priority": self.priority,
        }


class SitemapProcessor:
    """
    Parses and ingests XML sitemaps and sitemap indexes into ANVESHA's crawl queue.
    """

    def __init__(self, timeout: float = 8.0, max_sitemap_bytes: int = 10 * 1024 * 1024):
        self.timeout = timeout
        self.max_sitemap_bytes = max_sitemap_bytes

    def fetch_sitemap_content(self, url: str) -> Optional[bytes]:
        """Safely fetches sitemap bytes with SSRF protection."""
        if not is_safe_sitemap_url(url):
            logger.warning(f"Sitemap URL failed SSRF validation: {url}")
            return None

        try:
            headers = {"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"}
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code != 200:
                    logger.warning(f"Sitemap fetch HTTP {resp.status_code} for {url}")
                    return None

                content = resp.content
                if len(content) > self.max_sitemap_bytes:
                    logger.warning(f"Sitemap exceeded maximum size limit: {url}")
                    return None

                # Handle gzip payload if .gz or gzip header
                if url.endswith(".gz") or content[:2] == b"\x1f\x8b":
                    try:
                        content = gzip.decompress(content)
                    except Exception as e:
                        logger.warning(f"Failed to decompress gzipped sitemap: {e}")
                        return None

                return content
        except Exception as exc:
            logger.warning(f"Sitemap fetch network error: {exc}")
            return None

    def parse_sitemap_xml(self, xml_bytes: bytes, base_url: str) -> Dict[str, Any]:
        """
        Parses XML bytes, detecting whether it is a <urlset> or a <sitemapindex>.
        Returns:
            {"type": "urlset"|"sitemapindex", "urls": List[SitemapURL], "nested_sitemaps": List[str]}
        """
        urls: List[SitemapURL] = []
        nested_sitemaps: List[str] = []

        try:
            root = ET.fromstring(xml_bytes)
        except Exception as exc:
            logger.warning(f"Malformed sitemap XML from {base_url}: {exc}")
            return {"type": "unknown", "urls": [], "nested_sitemaps": []}

        tag = root.tag.lower()
        if "}" in tag:
            tag = tag.split("}")[1]

        # Case 1: Sitemap Index (<sitemapindex>)
        if tag == "sitemapindex":
            for elem in root:
                loc_elem = elem.find("{*}loc")
                if loc_elem is not None and loc_elem.text:
                    nested_url = loc_elem.text.strip()
                    if is_valid_http_url(nested_url):
                        nested_sitemaps.append(nested_url)
            return {
                "type": "sitemapindex",
                "urls": [],
                "nested_sitemaps": nested_sitemaps,
            }

        # Case 2: URL Set (<urlset>)
        elif tag == "urlset":
            for elem in root:
                loc_elem = elem.find("{*}loc")
                if loc_elem is not None and loc_elem.text:
                    loc = loc_elem.text.strip()
                    if not is_valid_http_url(loc):
                        continue

                    lastmod_elem = elem.find("{*}lastmod")
                    lastmod = lastmod_elem.text.strip() if lastmod_elem is not None and lastmod_elem.text else None

                    freq_elem = elem.find("{*}changefreq")
                    freq = freq_elem.text.strip() if freq_elem is not None and freq_elem.text else None

                    prio_elem = elem.find("{*}priority")
                    priority = 0.5
                    if prio_elem is not None and prio_elem.text:
                        try:
                            priority = float(prio_elem.text.strip())
                        except ValueError:
                            priority = 0.5

                    urls.append(SitemapURL(loc=loc, lastmod=lastmod, changefreq=freq, priority=priority))

            return {
                "type": "urlset",
                "urls": urls,
                "nested_sitemaps": [],
            }

        return {"type": "unknown", "urls": [], "nested_sitemaps": []}

    def discover_sitemaps_for_domain(self, domain: str) -> List[str]:
        """
        Discovers sitemaps for a given domain from robots.txt or standard paths.
        """
        clean_dom = domain.lower().strip().replace("http://", "").replace("https://", "").split("/")[0]
        sitemaps: List[str] = []

        # 1. Check robots.txt sitemaps
        rules = robots_manager.get_rules(clean_dom)
        if rules and rules.sitemaps:
            for s in rules.sitemaps:
                if is_valid_http_url(s) and s not in sitemaps:
                    sitemaps.append(s)

        # 2. Check standard location if none discovered
        if not sitemaps:
            sitemaps.append(f"https://{clean_dom}/sitemap.xml")

        return sitemaps

    def ingest_sitemap(
        self,
        sitemap_url: str,
        job_id: str,
        max_urls_to_enqueue: int = 500,
        depth: int = 0,
        max_depth: int = 2,
    ) -> Dict[str, Any]:
        """
        Fetches, parses, and enqueues URLs from a sitemap (including recursive index expansion).
        """
        if depth > max_depth:
            return {"status": "skipped", "reason": "Max sitemap recursion depth reached", "enqueued": 0}

        content = self.fetch_sitemap_content(sitemap_url)
        if not content:
            return {"status": "error", "reason": "Could not fetch sitemap content", "enqueued": 0}

        parsed = self.parse_sitemap_xml(content, sitemap_url)
        enqueued_count = 0

        # Handle nested sitemaps
        if parsed["type"] == "sitemapindex":
            total_enqueued = 0
            for nested in parsed["nested_sitemaps"][:5]:  # limit nested sitemaps per index
                res = self.ingest_sitemap(
                    nested,
                    job_id=job_id,
                    max_urls_to_enqueue=max_urls_to_enqueue - total_enqueued,
                    depth=depth + 1,
                    max_depth=max_depth,
                )
                total_enqueued += res.get("enqueued", 0)
                if total_enqueued >= max_urls_to_enqueue:
                    break
            return {
                "status": "success",
                "type": "sitemapindex",
                "nested_count": len(parsed["nested_sitemaps"]),
                "enqueued": total_enqueued,
            }

        elif parsed["type"] == "urlset":
            now = time.time()
            with get_db_connection() as conn:
                cursor = conn.cursor()
                for item in parsed["urls"]:
                    if enqueued_count >= max_urls_to_enqueue:
                        break

                    clean_url = normalize_url(item.loc)
                    if not clean_url:
                        continue

                    parsed_u = urllib.parse.urlparse(clean_url)
                    domain = parsed_u.netloc.lower()

                    # Check robots permission
                    if not robots_manager.is_allowed_sync(clean_url):
                        continue

                    # Insert if not already in queue
                    cursor.execute("SELECT id FROM crawler_queue WHERE url = ?", (clean_url,))
                    if not cursor.fetchone():
                        cursor.execute("""
                            INSERT INTO crawler_queue (
                                url, domain, job_id, depth, status, retry_count,
                                discovered_at, completed_at, error_message, http_status
                            ) VALUES (?, ?, ?, 1, 'queued', 0, ?, NULL, NULL, NULL)
                        """, (clean_url, domain, job_id, now))
                        enqueued_count += 1

                conn.commit()

            return {
                "status": "success",
                "type": "urlset",
                "discovered_count": len(parsed["urls"]),
                "enqueued": enqueued_count,
            }

        return {"status": "unsupported", "type": parsed["type"], "enqueued": 0}


# Global singleton
sitemap_processor = SitemapProcessor()
