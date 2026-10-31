"""
Freshness Intelligence & Scheduled Recrawler for ANVESHA.

Provides:
1. HTTP Conditional Validation: Uses ETag (If-None-Match) and Last-Modified (If-Modified-Since)
   to eliminate redundant bandwidth and compute on unchanged pages (HTTP 304 Not Modified).
2. Content Hash Staleness Detection: Compares SHA-256 hashes before updating indices.
3. Domain-level crawl intervals and prioritized recrawling.
4. Tombstoning and cleanup for deleted/404 pages.
"""
import time
import logging
from typing import List, Dict, Any, Optional

from app.core.db import get_db_connection
from engine.crawler.indexer import crawler_indexer

logger = logging.getLogger(__name__)


# Default domain recrawl intervals (in seconds)
DEFAULT_DOMAIN_INTERVALS = {
    "docs.python.org": 86400 * 7,    # 7 days for stable documentation
    "github.com": 86400 * 3,         # 3 days for repositories
    "default": 86400 * 5,            # 5 days default
}


class FreshnessManager:
    """
    Monitors document freshness, detects stale index records, and coordinates
    conditional re-crawl operations.
    """

    def __init__(self, intervals: Optional[Dict[str, int]] = None):
        self.intervals = intervals or DEFAULT_DOMAIN_INTERVALS

    def get_domain_interval(self, domain: str) -> int:
        """Returns the freshness interval in seconds for a specific domain."""
        clean_domain = domain.lower().strip()
        for d, interval in self.intervals.items():
            if d in clean_domain:
                return interval
        return self.intervals.get("default", 86400 * 5)

    def find_stale_documents(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Identifies documents in crawled_documents whose age exceeds their domain's freshness interval.
        """
        now = time.time()
        stale_docs: List[Dict[str, Any]] = []

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, url, domain, title, content_hash, crawl_timestamp, etag, last_modified_at
                FROM crawled_documents
                ORDER BY crawl_timestamp ASC
                LIMIT ?
                """,
                (limit * 2,),
            )
            rows = cursor.fetchall()

        for r in rows:
            domain = r["domain"]
            max_age = self.get_domain_interval(domain)
            doc_age = now - float(r["crawl_timestamp"])

            if doc_age >= max_age:
                stale_docs.append({
                    "id": r["id"],
                    "url": r["url"],
                    "domain": r["domain"],
                    "title": r["title"],
                    "content_hash": r["content_hash"],
                    "age_days": round(doc_age / 86400.0, 1),
                    "etag": r["etag"],
                    "last_modified": r["last_modified_at"],
                })

            if len(stale_docs) >= limit:
                break

        return stale_docs

    def build_conditional_headers(self, etag: Optional[str], last_modified: Optional[str]) -> Dict[str, str]:
        """Builds HTTP request headers for conditional validation."""
        headers: Dict[str, str] = {}
        if etag:
            headers["If-None-Match"] = etag.strip()
        if last_modified:
            headers["If-Modified-Since"] = last_modified.strip()
        return headers

    def handle_not_modified(self, doc_id: str, new_etag: Optional[str] = None):
        """
        Refreshes crawl timestamp without modifying document content or re-generating vectors.
        """
        now = time.time()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            if new_etag:
                cursor.execute(
                    "UPDATE crawled_documents SET crawl_timestamp = ?, etag = ? WHERE id = ?",
                    (now, new_etag, doc_id),
                )
            else:
                cursor.execute(
                    "UPDATE crawled_documents SET crawl_timestamp = ? WHERE id = ?",
                    (now, doc_id),
                )
            conn.commit()

    def handle_document_deleted(self, doc_id: str):
        """Removes a 404/410 page from the database, FTS index, and vector store."""
        crawler_indexer.delete_document(doc_id)
        logger.info(f"Purged deleted/tombstoned document {doc_id} from all indices.")


# Global singleton instance
freshness_manager = FreshnessManager()
