"""
Unified Web Intelligence Engine for ANVESHA.

Coordinates domain allowlists, crawl execution, full-text indexing,
monitoring metrics, and hybrid search integration.
"""
import time
import json
import uuid
import logging
from typing import Dict, Any, List, Optional

from app.core.db import get_db_connection
from engine.crawler.indexer import crawler_indexer, SearchHit
from engine.crawler.scheduler import crawler_scheduler
from engine.crawler.robots import robots_manager

logger = logging.getLogger(__name__)

INITIAL_SEED_DOMAINS = [
    {"domain": "docs.python.org", "allowed_paths": ["/3/"], "delay": 1.0, "max_depth": 2, "max_pages": 40},
    {"domain": "fastapi.tiangolo.com", "allowed_paths": ["/tutorial/", "/reference/"], "delay": 1.0, "max_depth": 2, "max_pages": 40},
    {"domain": "react.dev", "allowed_paths": ["/learn", "/reference"], "delay": 1.0, "max_depth": 2, "max_pages": 30},
    {"domain": "typescriptlang.org", "allowed_paths": ["/docs/"], "delay": 1.0, "max_depth": 2, "max_pages": 30},
    {"domain": "developer.mozilla.org", "allowed_paths": ["/en-US/docs/Web/"], "delay": 1.5, "max_depth": 2, "max_pages": 30},
    {"domain": "docs.docker.com", "allowed_paths": ["/get-started/", "/manuals/"], "delay": 1.0, "max_depth": 2, "max_pages": 30},
]


class WebIntelligenceEngine:
    """Central manager orchestrating all web crawler and indexing services."""

    def __init__(self):
        self.indexer = crawler_indexer
        self.scheduler = crawler_scheduler
        self._seed_default_domains()

    def _seed_default_domains(self):
        """Ensures default approved technical documentation domains are seeded."""
        now = time.time()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            for seed in INITIAL_SEED_DOMAINS:
                d = seed["domain"]
                cursor.execute("SELECT id FROM crawler_seed_domains WHERE domain = ?", (d,))
                if not cursor.fetchone():
                    dom_id = f"dom_{uuid.uuid4().hex[:10]}"
                    cursor.execute("""
                        INSERT INTO crawler_seed_domains (
                            id, domain, enabled, allowed_paths, crawl_delay_sec,
                            max_depth, max_pages, robots_txt_status, created_at, updated_at
                        ) VALUES (?, ?, 1, ?, ?, ?, ?, 'ready', ?, ?)
                    """, (
                        dom_id, d, json.dumps(seed["allowed_paths"]),
                        seed["delay"], seed["max_depth"], seed["max_pages"], now, now
                    ))
            conn.commit()

    def get_overview_stats(self) -> Dict[str, Any]:
        """Calculates global crawler and index metrics."""
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Discovered & Queue counts
            cursor.execute("SELECT COUNT(*) as cnt FROM crawler_queue")
            total_discovered = cursor.fetchone()["cnt"]

            cursor.execute("SELECT COUNT(*) as cnt FROM crawler_queue WHERE status = 'queued'")
            pending_urls = cursor.fetchone()["cnt"]

            cursor.execute("SELECT COUNT(*) as cnt FROM crawler_queue WHERE status = 'completed'")
            crawled_pages = cursor.fetchone()["cnt"]

            cursor.execute("SELECT COUNT(*) as cnt FROM crawler_queue WHERE status = 'failed'")
            failed_urls = cursor.fetchone()["cnt"]

            # Indexed documents count
            cursor.execute("SELECT COUNT(*) as cnt FROM crawled_documents")
            indexed_documents = cursor.fetchone()["cnt"]

            # Active Jobs
            cursor.execute("SELECT COUNT(*) as cnt FROM crawler_jobs WHERE status = 'running'")
            active_jobs = cursor.fetchone()["cnt"]

            # Last crawled time
            cursor.execute("SELECT MAX(completed_at) as last_crawl FROM crawler_queue WHERE status = 'completed'")
            last_crawl_ts = cursor.fetchone()["last_crawl"]

            # Seed domains count
            cursor.execute("SELECT COUNT(*) as cnt FROM crawler_seed_domains WHERE enabled = 1")
            active_domains = cursor.fetchone()["cnt"]

        requests_per_min = self.scheduler.get_requests_per_minute()

        return {
            "total_discovered": total_discovered,
            "crawled_pages": crawled_pages,
            "indexed_documents": indexed_documents,
            "failed_urls": failed_urls,
            "pending_urls": pending_urls,
            "active_jobs": active_jobs,
            "active_domains": active_domains,
            "requests_per_minute": requests_per_min,
            "last_crawl_timestamp": last_crawl_ts,
            "crawler_status": "active" if active_jobs > 0 else "idle",
        }

    def list_domains(self) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM crawler_seed_domains ORDER BY created_at DESC")
            domains = []
            for row in cursor.fetchall():
                d = dict(row)
                try:
                    d["allowed_paths"] = json.loads(d.get("allowed_paths") or "[]")
                except Exception:
                    d["allowed_paths"] = []
                domains.append(d)
            return domains

    def add_domain(
        self,
        domain: str,
        allowed_paths: Optional[List[str]] = None,
        crawl_delay_sec: float = 1.0,
        max_depth: int = 2,
        max_pages: int = 50,
    ) -> Dict[str, Any]:
        """
        Validates, registers, or updates an approved seed domain.
        Supports atomic upsert so existing seed domains can have their paths,
        crawl delays, and depth limits updated seamlessly.
        """
        raw_d = domain.lower().strip()
        # Normalize: strip scheme if user pasted full URL (e.g. https://docs.python.org/3/)
        if "://" in raw_d:
            from urllib.parse import urlparse
            parsed = urlparse(raw_d)
            clean_d = (parsed.hostname or raw_d).lower().strip()
        else:
            clean_d = raw_d.split("/")[0].split(":")[0].strip()

        if not clean_d:
            raise ValueError("Invalid domain name provided.")

        # Security validation on domain (SSRF & DNS rebinding)
        from engine.crawler.security import resolve_and_validate_hostname
        resolve_and_validate_hostname(clean_d)

        now = time.time()
        paths_json = json.dumps(allowed_paths or ["/"])

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM crawler_seed_domains WHERE domain = ?", (clean_d,))
            existing = cursor.fetchone()

            if existing:
                dom_id = existing["id"]
                cursor.execute("""
                    UPDATE crawler_seed_domains
                    SET enabled = 1,
                        allowed_paths = ?,
                        crawl_delay_sec = ?,
                        max_depth = ?,
                        max_pages = ?,
                        updated_at = ?
                    WHERE id = ?
                """, (paths_json, crawl_delay_sec, max_depth, max_pages, now, dom_id))
                conn.commit()
                logger.info(f"Updated existing seed domain in allowlist: {clean_d} ({dom_id})")
                return {
                    "id": dom_id,
                    "domain": clean_d,
                    "enabled": True,
                    "allowed_paths": allowed_paths or ["/"],
                    "crawl_delay_sec": crawl_delay_sec,
                    "max_depth": max_depth,
                    "max_pages": max_pages,
                    "updated": True,
                    "message": f"Domain '{clean_d}' configuration successfully updated.",
                }
            else:
                dom_id = f"dom_{uuid.uuid4().hex[:10]}"
                cursor.execute("""
                    INSERT INTO crawler_seed_domains (
                        id, domain, enabled, allowed_paths, crawl_delay_sec,
                        max_depth, max_pages, robots_txt_status, created_at, updated_at
                    ) VALUES (?, ?, 1, ?, ?, ?, ?, 'ready', ?, ?)
                """, (dom_id, clean_d, paths_json, crawl_delay_sec, max_depth, max_pages, now, now))
                conn.commit()
                logger.info(f"Registered new seed domain in allowlist: {clean_d} ({dom_id})")
                return {
                    "id": dom_id,
                    "domain": clean_d,
                    "enabled": True,
                    "allowed_paths": allowed_paths or ["/"],
                    "crawl_delay_sec": crawl_delay_sec,
                    "max_depth": max_depth,
                    "max_pages": max_pages,
                    "updated": False,
                    "message": f"Domain '{clean_d}' registered to crawl allowlist.",
                }

    def toggle_domain(self, domain_id: str) -> bool:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT enabled FROM crawler_seed_domains WHERE id = ?", (domain_id,))
            row = cursor.fetchone()
            if not row:
                return False
            new_val = 0 if row["enabled"] else 1
            cursor.execute("UPDATE crawler_seed_domains SET enabled = ?, updated_at = ? WHERE id = ?", (new_val, time.time(), domain_id))
            conn.commit()
            return bool(new_val)

    def delete_domain(self, domain_id: str) -> bool:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM crawler_seed_domains WHERE id = ?", (domain_id,))
            conn.commit()
            return True

    def list_jobs(self, limit: int = 20) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM crawler_jobs ORDER BY created_at DESC LIMIT ?", (limit,))
            jobs = []
            for row in cursor.fetchall():
                j = dict(row)
                try:
                    j["target_domains"] = json.loads(j.get("target_domains") or "[]")
                except Exception:
                    j["target_domains"] = []
                try:
                    j["config"] = json.loads(j.get("config_json") or "{}")
                except Exception:
                    j["config"] = {}

                # Calculate progress percentage
                tot_disc = j.get("total_discovered", 0)
                tot_crawled = j.get("total_crawled", 0)
                max_p = j["config"].get("max_pages", 50)
                denom = min(tot_disc, max_p) if tot_disc > 0 else max_p
                j["progress_percent"] = min(100.0, round((tot_crawled / denom) * 100, 1)) if denom > 0 else 0.0
                jobs.append(j)
            return jobs

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM crawler_jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            if not row:
                return None
            j = dict(row)
            try:
                j["target_domains"] = json.loads(j.get("target_domains") or "[]")
            except Exception:
                j["target_domains"] = []
            try:
                j["config"] = json.loads(j.get("config_json") or "{}")
            except Exception:
                j["config"] = {}

            # Fetch recent queue items
            cursor.execute("""
                SELECT url, status, http_status, error_message, depth, completed_at
                FROM crawler_queue
                WHERE job_id = ?
                ORDER BY completed_at DESC, created_at DESC
                LIMIT 50
            """, (job_id,))
            j["queue_sample"] = [dict(r) for r in cursor.fetchall()]
            return j

    async def create_and_start_job(self, title: str, domains: List[str], max_pages: int = 30, max_depth: int = 2) -> str:
        job_id = self.scheduler.create_job(title=title, target_domains=domains, max_pages=max_pages, max_depth=max_depth)
        await self.scheduler.start_job(job_id)
        return job_id

    def list_documents(self, query: Optional[str] = None, domain: Optional[str] = None, limit: int = 20, offset: int = 0) -> Dict[str, Any]:
        """Lists or searches indexed documents."""
        if query and query.strip():
            hits = self.indexer.search(query=query.strip(), domain_filter=domain, limit=limit, offset=offset)
            return {
                "total": len(hits),
                "query": query,
                "documents": [h.to_dict() for h in hits],
            }

        with get_db_connection() as conn:
            cursor = conn.cursor()
            sql = "SELECT id, url, canonical_url, domain, title, description, language, author, word_count, crawl_timestamp FROM crawled_documents"
            params = []
            if domain:
                sql += " WHERE domain = ?"
                params.append(domain.lower().strip())

            sql += " ORDER BY crawl_timestamp DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            cursor.execute(sql, params)

            docs = [dict(r) for r in cursor.fetchall()]

            cursor.execute("SELECT COUNT(*) as cnt FROM crawled_documents" + (" WHERE domain = ?" if domain else ""), ([domain] if domain else []))
            total_count = cursor.fetchone()["cnt"]

            return {
                "total": total_count,
                "query": "",
                "documents": docs,
            }

    def get_monitoring_metrics(self) -> Dict[str, Any]:
        """Calculates monitoring distributions and health stats."""
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # HTTP status code distribution
            cursor.execute("""
                SELECT http_status, COUNT(*) as count
                FROM crawler_queue
                WHERE http_status IS NOT NULL
                GROUP BY http_status
            """)
            status_dist = {str(row["http_status"]): row["count"] for row in cursor.fetchall()}

            # Domain crawl distribution
            cursor.execute("""
                SELECT domain, COUNT(*) as count
                FROM crawled_documents
                GROUP BY domain
                ORDER BY count DESC
                LIMIT 10
            """)
            domain_dist = [{"domain": row["domain"], "count": row["count"]} for row in cursor.fetchall()]

            # Average word count
            cursor.execute("SELECT AVG(word_count) as avg_words, AVG(text_length) as avg_len FROM crawled_documents")
            avg_row = cursor.fetchone()
            avg_words = round(avg_row["avg_words"] or 0)
            avg_len = round(avg_row["avg_len"] or 0)

        return {
            "requests_per_minute": self.scheduler.get_requests_per_minute(),
            "status_distribution": status_dist,
            "top_crawled_domains": domain_dist,
            "average_word_count": avg_words,
            "average_content_length": avg_len,
        }


# Global engine instance
web_intelligence_engine = WebIntelligenceEngine()
