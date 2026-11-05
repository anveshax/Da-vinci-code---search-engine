"""
Publisher RSS and Atom Feed Provider for ANVESHA.
Fetches, parses, and validates feeds with conditional HTTP caching (ETag / Last-Modified).
"""
import time
import asyncio
import httpx
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from lxml import etree
import xml.etree.ElementTree as ET

from .models import NewsArticle, ProviderHealth
from .news_normalizer import (
    canonicalize_url,
    generate_article_id,
    clean_text_snippet,
    parse_datetime_to_iso,
    map_category_slug,
)
from engine.http_client import get_shared_client

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 ANVESHA/1.0 NewsAggregator",
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
}


class RSSFeedProvider:
    def __init__(self, timeout: float = 7.0):
        self.timeout = timeout
        self.etags: Dict[str, str] = {}
        self.last_modified: Dict[str, str] = {}
        self.health_records: Dict[str, ProviderHealth] = {}

    def get_health(self, source_id: str) -> Optional[ProviderHealth]:
        return self.health_records.get(source_id)

    async def fetch_feed(self, feed_meta: Dict[str, Any]) -> List[NewsArticle]:
        """Fetches and parses a single RSS or Atom feed with conditional headers."""
        feed_id = feed_meta["id"]
        url = feed_meta["url"]
        source_name = feed_meta["name"]
        default_cat = feed_meta.get("category", "world")
        country = feed_meta.get("country", "WORLD")
        language = feed_meta.get("language", "en")

        if feed_id not in self.health_records:
            self.health_records[feed_id] = ProviderHealth(
                source_id=feed_id,
                source_name=source_name,
                provider="rss",
                status="healthy",
            )
        health = self.health_records[feed_id]
        health.last_attempt_at = parse_datetime_to_iso(time.time())

        req_headers = dict(HEADERS)
        if url in self.etags:
            req_headers["If-None-Match"] = self.etags[url]
        if url in self.last_modified:
            req_headers["If-Modified-Since"] = self.last_modified[url]

        start_time = time.time()
        try:
            client = get_shared_client()
            res = await client.get(url, headers=req_headers, timeout=self.timeout)
            health.response_time_ms = round((time.time() - start_time) * 1000, 2)

            # 304 Not Modified: cache hit
            if res.status_code == 304:
                health.status = "healthy"
                health.last_success_at = parse_datetime_to_iso(time.time())
                health.consecutive_failures = 0
                return []

            if res.status_code == 200:
                # Update conditional cache tokens
                if "etag" in res.headers:
                    self.etags[url] = res.headers["etag"]
                if "last-modified" in res.headers:
                    self.last_modified[url] = res.headers["last-modified"]

                articles = self._parse_xml_content(
                    res.content,
                    feed_meta=feed_meta,
                    default_cat=default_cat,
                    country=country,
                    language=language,
                )

                health.status = "healthy"
                health.last_success_at = parse_datetime_to_iso(time.time())
                health.consecutive_failures = 0
                health.error_message = None
                return articles
            else:
                health.consecutive_failures += 1
                health.status = "degraded" if health.consecutive_failures < 3 else "down"
                health.error_message = f"HTTP {res.status_code}"
                return []
        except Exception as e:
            health.consecutive_failures += 1
            health.status = "degraded" if health.consecutive_failures < 3 else "down"
            health.error_message = str(e)
            return []

    async def fetch_multiple_feeds(self, feeds: List[Dict[str, Any]], concurrency: int = 8) -> List[NewsArticle]:
        """Fetches multiple feeds in parallel with bounded concurrency."""
        semaphore = asyncio.Semaphore(concurrency)

        async def _bounded_fetch(f):
            async with semaphore:
                return await self.fetch_feed(f)

        results = await asyncio.gather(*[_bounded_fetch(f) for f in feeds], return_exceptions=True)
        all_articles: List[NewsArticle] = []
        for r in results:
            if isinstance(r, list):
                all_articles.extend(r)
        return all_articles

    def _parse_xml_content(
        self,
        xml_bytes: bytes,
        feed_meta: Dict[str, Any],
        default_cat: str,
        country: str,
        language: str,
    ) -> List[NewsArticle]:
        """Parses RSS or Atom XML content into NewsArticle objects."""
        articles: List[NewsArticle] = []
        feed_name = feed_meta["name"]
        
        # Try lxml first, fallback to standard xml.etree
        root = None
        try:
            parser = etree.XMLParser(recover=True, no_network=True)
            root = etree.fromstring(xml_bytes, parser=parser)
        except Exception:
            try:
                root = ET.fromstring(xml_bytes)
            except Exception:
                return []

        if root is None:
            return []

        # 1. RSS 2.0 (<channel><item>...)
        items = root.xpath("//item") if hasattr(root, "xpath") else root.findall(".//item")
        if items:
            for item in items[:35]:
                try:
                    title_elem = item.find("title")
                    link_elem = item.find("link")
                    desc_elem = item.find("description")
                    pubdate_elem = item.find("pubDate")
                    
                    title = title_elem.text.strip() if (title_elem is not None and title_elem.text) else ""
                    link = link_elem.text.strip() if (link_elem is not None and link_elem.text) else ""
                    if not link and link_elem is not None and "href" in link_elem.attrib:
                        link = link_elem.attrib["href"].strip()
                    
                    if not title or not link:
                        continue

                    canon_url = canonicalize_url(link)
                    art_id = generate_article_id(canon_url, title)
                    summary = clean_text_snippet(desc_elem.text if (desc_elem is not None and desc_elem.text) else "")
                    pub_iso = parse_datetime_to_iso(pubdate_elem.text if (pubdate_elem is not None and pubdate_elem.text) else None)

                    # Extract image thumbnail if available
                    image_url = None
                    enclosure = item.find("enclosure")
                    if enclosure is not None and "url" in enclosure.attrib:
                        image_url = enclosure.attrib["url"]
                    if not image_url and hasattr(item, "xpath"):
                        media_thumb = item.xpath(".//*[local-name()='thumbnail' or local-name()='content']/@url")
                        if media_thumb:
                            image_url = media_thumb[0]
                    if not image_url:
                        desc_elem = item.find("description")
                        desc_html = desc_elem.text if (desc_elem is not None and desc_elem.text) else ""
                        if "<img" in desc_html:
                            m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc_html, re.IGNORECASE)
                            if m:
                                image_url = m.group(1)

                    # Category
                    cat = default_cat
                    cat_elem = item.find("category")
                    if cat_elem is not None and cat_elem.text:
                        cat = map_category_slug(cat_elem.text)

                    articles.append(NewsArticle(
                        id=art_id,
                        title=title,
                        original_url=canon_url,
                        source_name=feed_name,
                        source_domain=urlparse(canon_url).netloc,
                        category=cat,
                        country=country,
                        language=language,
                        published_at=pub_iso,
                        summary=summary,
                        image_url=image_url,
                        provider="rss",
                        outlets_count=1,
                        reliability_score=0.90,
                        is_breaking=("breaking" in title.lower() or cat == "breaking"),
                        raw_metadata={"feed_id": feed_meta["id"]}
                    ))
                except Exception:
                    continue
            return articles

        # 2. Atom 1.0 (<feed><entry>...)
        entries = root.xpath("//*[local-name()='entry']") if hasattr(root, "xpath") else root.findall(".//{http://www.w3.org/2005/Atom}entry")
        if entries:
            for entry in entries[:35]:
                try:
                    title_elem = entry.find("{http://www.w3.org/2005/Atom}title")
                    if title_elem is None:
                        title_elem = entry.find("title")

                    link_elem = entry.find("{http://www.w3.org/2005/Atom}link")
                    if link_elem is None:
                        link_elem = entry.find("link")

                    summary_elem = entry.find("{http://www.w3.org/2005/Atom}summary")
                    if summary_elem is None:
                        summary_elem = entry.find("summary")
                    if summary_elem is None:
                        summary_elem = entry.find("content")

                    published_elem = entry.find("{http://www.w3.org/2005/Atom}published")
                    if published_elem is None:
                        published_elem = entry.find("{http://www.w3.org/2005/Atom}updated")
                    if published_elem is None:
                        published_elem = entry.find("published")
                    if published_elem is None:
                        published_elem = entry.find("updated")

                    title = title_elem.text.strip() if (title_elem is not None and title_elem.text) else ""
                    link = ""
                    if link_elem is not None:
                        link = link_elem.attrib.get("href", "") or (link_elem.text or "")

                    if not title or not link:
                        continue

                    canon_url = canonicalize_url(link)
                    art_id = generate_article_id(canon_url, title)
                    summary = clean_text_snippet(summary_elem.text if (summary_elem is not None and summary_elem.text) else "")
                    pub_iso = parse_datetime_to_iso(published_elem.text if (published_elem is not None and published_elem.text) else None)

                    # Extract image thumbnail for Atom entries
                    image_url = None
                    if hasattr(entry, "xpath"):
                        thumbs = entry.xpath(".//*[local-name()='thumbnail' or local-name()='content']/@url")
                        if thumbs:
                            image_url = thumbs[0]
                        if not image_url:
                            encl = entry.xpath(".//link[@rel='enclosure' and starts-with(@type, 'image')]/@href")
                            if encl:
                                image_url = encl[0]
                    if not image_url and summary_elem is not None and summary_elem.text and "<img" in summary_elem.text:
                        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary_elem.text, re.IGNORECASE)
                        if m:
                            image_url = m.group(1)

                    articles.append(NewsArticle(
                        id=art_id,
                        title=title,
                        original_url=canon_url,
                        source_name=feed_name,
                        source_domain=urlparse(canon_url).netloc,
                        category=default_cat,
                        country=country,
                        language=language,
                        published_at=pub_iso,
                        summary=summary,
                        image_url=image_url,
                        provider="rss",
                        outlets_count=1,
                        reliability_score=0.90,
                        is_breaking=("breaking" in title.lower() or default_cat == "breaking"),
                        raw_metadata={"feed_id": feed_meta["id"]}
                    ))
                except Exception:
                    continue

        return articles
