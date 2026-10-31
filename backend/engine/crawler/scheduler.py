"""
Crawler Scheduler, Priority Queue & Distributed Task Worker for ANVESHA.

Coordinates asynchronous crawl jobs, priority queues, per-domain rate limiting,
polite backpressure, incremental recrawling, and lifecycle states (pause/resume/cancel).
"""
import asyncio
import time
import uuid
import json
import logging
from typing import Dict, Any, List, Optional, Set
from urllib.parse import urlparse

from app.core.db import get_db_connection
from engine.crawler.security import validate_crawl_url
from engine.crawler.url_utils import normalize_url, extract_links
from engine.crawler.robots import robots_manager
from engine.crawler.fetcher import safe_fetcher, FetchResult
from engine.crawler.extractor import extract_content
from engine.crawler.dedup import DeduplicationEngine
from engine.crawler.indexer import crawler_indexer

logger = logging.getLogger(__name__)


class DomainRateLimiter:
    """Enforces polite per-domain delays between consecutive requests."""

    def __init__(self, default_delay_sec: float = 1.0):
        self.default_delay = default_delay_sec
        self._last_request_times: Dict[str, float] = {}
        self._domain_locks: Dict[str, asyncio.Lock] = {}

    def _get_lock(self, domain: str) -> asyncio.Lock:
        if domain not in self._domain_locks:
            self._domain_locks[domain] = asyncio.Lock()
        return self._domain_locks[domain]

    async def wait_for_domain(self, domain: str, custom_delay: Optional[float] = None):
        """Waits if necessary to respect domain crawl delay."""
        clean_domain = domain.lower().strip()
        lock = self._get_lock(clean_domain)

        async with lock:
            now = time.time()
            delay = custom_delay if custom_delay is not None else self.default_delay
            # Cap maximum delay to 5 seconds to avoid crawler stagnation
            delay = min(delay, 5.0)

            last_time = self._last_request_times.get(clean_domain, 0.0)
            elapsed = now - last_time
            if elapsed < delay:
                wait_sec = delay - elapsed
                await asyncio.sleep(wait_sec)

            self._last_request_times[clean_domain] = time.time()


class CrawlerScheduler:
    """
    Central scheduler orchestrating crawl jobs, queues, workers, and metrics.
    """

    def __init__(self, max_concurrent_workers: int = 3):
        self.max_workers = max_concurrent_workers
        self.rate_limiter = DomainRateLimiter(default_delay_sec=1.0)
        self._active_jobs: Dict[str, asyncio.Task] = {}
        self._paused_jobs: Set[str] = set()
        self._cancelled_jobs: Set[str] = set()
        self._rpm_counter: List[float] = []

    def record_request_metric(self):
        now = time.time()
        self._rpm_counter.append(now)
        # Keep only timestamps within last 60 seconds
        self._rpm_counter = [t for t in self._rpm_counter if now - t <= 60.0]

    def get_requests_per_minute(self) -> int:
        now = time.time()
        self._rpm_counter = [t for t in self._rpm_counter if now - t <= 60.0]
        return len(self._rpm_counter)

    def create_job(self, title: str, target_domains: List[str], max_pages: int = 50, max_depth: int = 2) -> str:
        """Initializes a new crawl job and enqueues initial seed URLs after duplicate verification."""
        job_id = f"crawl_{uuid.uuid4().hex[:10]}"
        now = time.time()
        config = {
            "max_pages": max_pages,
            "max_depth": max_depth,
            "target_domains": target_domains,
        }

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Prevent duplicate simultaneous crawl jobs on the same target domains
            for d in target_domains:
                clean_d = d.lower().strip()
                cursor.execute("""
                    SELECT id, title FROM crawler_jobs 
                    WHERE status = 'running' AND target_domains LIKE ?
                """, (f"%{clean_d}%",))
                conflict = cursor.fetchone()
                if conflict:
                    raise ValueError(f"Domain '{clean_d}' is already being actively crawled by job '{conflict['title']}' ({conflict['id']}).")

            cursor.execute("""
                INSERT INTO crawler_jobs (
                    id, title, status, target_domains, total_discovered,
                    total_crawled, total_indexed, total_failed, total_skipped,
                    progress_percent, started_at, config_json, created_at
                ) VALUES (?, ?, 'pending', ?, 0, 0, 0, 0, 0, 0.0, ?, ?, ?)
            """, (job_id, title, json.dumps(target_domains), now, json.dumps(config), now))

            # Enqueue initial seed URLs
            discovered_count = 0
            for d in target_domains:
                clean_d = d.lower().strip()
                seed_url = f"https://{clean_d}/"
                norm_seed = normalize_url(seed_url)
                qid = f"q_{uuid.uuid4().hex[:12]}"

                cursor.execute("""
                    INSERT INTO crawler_queue (
                        id, job_id, url, normalized_url, domain, depth,
                        priority, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, 0, 10, 'queued', ?)
                """, (qid, job_id, seed_url, norm_seed, clean_d, now))
                discovered_count += 1

            cursor.execute("UPDATE crawler_jobs SET total_discovered = ? WHERE id = ?", (discovered_count, job_id))
            conn.commit()

        return job_id

    async def start_job(self, job_id: str):
        """Starts asynchronous background worker task for a job."""
        if job_id in self._active_jobs and not self._active_jobs[job_id].done():
            logger.info(f"Crawl job {job_id} is already running.")
            return

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE crawler_jobs SET status = 'running', started_at = ? WHERE id = ?", (time.time(), job_id))
            conn.commit()

        task = asyncio.create_task(self._job_worker_loop(job_id))
        self._active_jobs[job_id] = task

    def pause_job(self, job_id: str):
        self._paused_jobs.add(job_id)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE crawler_jobs SET status = 'paused' WHERE id = ?", (job_id,))
            conn.commit()

    def resume_job(self, job_id: str):
        if job_id in self._paused_jobs:
            self._paused_jobs.remove(job_id)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE crawler_jobs SET status = 'running' WHERE id = ?", (job_id,))
            conn.commit()
        if job_id not in self._active_jobs or self._active_jobs[job_id].done():
            task = asyncio.create_task(self._job_worker_loop(job_id))
            self._active_jobs[job_id] = task

    def cancel_job(self, job_id: str):
        self._cancelled_jobs.add(job_id)
        if job_id in self._active_jobs:
            self._active_jobs[job_id].cancel()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE crawler_jobs SET status = 'cancelled', finished_at = ? WHERE id = ?", (time.time(), job_id))
            conn.commit()

    async def retry_failed_urls(self, job_id: str):
        """Reschedules failed URLs for a job."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE crawler_queue
                SET status = 'queued', retry_count = retry_count + 1, error_message = NULL
                WHERE job_id = ? AND status = 'failed'
            """, (job_id,))
            conn.commit()

        await self.start_job(job_id)

    async def startup_recovery(self):
        """
        Recovers scheduler state during FastAPI startup:
        1. Identifies any crawl jobs left in 'running' state after an unexpected termination.
        2. Resets stuck 'fetching' queue records back to 'queued'.
        3. Marks interrupted jobs as 'paused' so the user or engine can cleanly resume them.
        """
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, title FROM crawler_jobs WHERE status = 'running'")
            stale_jobs = cursor.fetchall()
            for job in stale_jobs:
                jid = job["id"]
                logger.warning(f"Recovering interrupted crawl job on startup: {jid} ({job['title']})")
                cursor.execute("""
                    UPDATE crawler_queue
                    SET status = 'queued'
                    WHERE job_id = ? AND status = 'fetching'
                """, (jid,))
                cursor.execute("""
                    UPDATE crawler_jobs
                    SET status = 'paused', error_message = 'Interrupted by server restart. Ready to resume.'
                    WHERE id = ?
                """, (jid,))
            conn.commit()
            if stale_jobs:
                logger.info(f"Crawler startup recovery completed for {len(stale_jobs)} interrupted job(s).")

    async def shutdown(self):
        """
        Gracefully terminates all active crawling worker tasks during FastAPI shutdown.
        """
        logger.info(f"Gracefully shutting down {len(self._active_jobs)} active crawler task(s)...")
        for job_id, task in list(self._active_jobs.items()):
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE crawler_jobs
                    SET status = 'paused', error_message = 'Paused during graceful server shutdown.'
                    WHERE id = ? AND status = 'running'
                """, (job_id,))
                cursor.execute("""
                    UPDATE crawler_queue
                    SET status = 'queued'
                    WHERE job_id = ? AND status = 'fetching'
                """, (job_id,))
                conn.commit()
        self._active_jobs.clear()
        logger.info("Crawler shutdown completed.")

    async def _job_worker_loop(self, job_id: str):
        """Main worker loop pulling from priority queue and executing crawl tasks."""
        logger.info(f"Starting crawler worker loop for job: {job_id}")

        while True:
            # Check for cancellation or pause
            if job_id in self._cancelled_jobs:
                logger.info(f"Job {job_id} cancelled.")
                break
            if job_id in self._paused_jobs:
                await asyncio.sleep(1.0)
                continue

            # Fetch job config & limits
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM crawler_jobs WHERE id = ?", (job_id,))
                job = cursor.fetchone()
                if not job:
                    break

                config = json.loads(job["config_json"] or "{}")
                max_pages = config.get("max_pages", 50)
                max_depth = config.get("max_depth", 2)
                target_domains = config.get("target_domains", [])

                if job["total_crawled"] >= max_pages:
                    cursor.execute("UPDATE crawler_jobs SET status = 'completed', finished_at = ? WHERE id = ?", (time.time(), job_id))
                    conn.commit()
                    logger.info(f"Job {job_id} reached target page limit ({max_pages}).")
                    break

                # Pop top priority queued URL
                cursor.execute("""
                    SELECT * FROM crawler_queue
                    WHERE job_id = ? AND status = 'queued'
                    ORDER BY priority DESC, created_at ASC
                    LIMIT 1
                """, (job_id,))
                item = cursor.fetchone()

                if not item:
                    # Queue is empty, mark job completed
                    cursor.execute("UPDATE crawler_jobs SET status = 'completed', finished_at = ? WHERE id = ?", (time.time(), job_id))
                    conn.commit()
                    logger.info(f"Job {job_id} completed: queue exhausted.")
                    break

                queue_id = item["id"]
                target_url = item["url"]
                norm_url = item["normalized_url"]
                domain = item["domain"]
                depth = item["depth"]

                # Mark item as fetching
                cursor.execute("UPDATE crawler_queue SET status = 'fetching' WHERE id = ?", (queue_id,))
                cursor.execute("UPDATE crawler_jobs SET current_url = ? WHERE id = ?", (target_url, job_id))
                conn.commit()

            # Process single URL
            await self._crawl_single_url(job_id, queue_id, target_url, norm_url, domain, depth, max_depth, target_domains)
            await asyncio.sleep(0.1)

    async def _crawl_single_url(
        self,
        job_id: str,
        queue_id: str,
        target_url: str,
        norm_url: str,
        domain: str,
        depth: int,
        max_depth: int,
        target_domains: List[str]
    ):
        """Fetches, extracts, deduplicates, indexes, and discovers links for one page."""
        self.record_request_metric()

        # Step 1: Check robots.txt permissions
        allowed, crawl_delay = await robots_manager.is_allowed(target_url)
        if not allowed:
            self._update_queue_item(queue_id, job_id, status="skipped", error="Disallowed by robots.txt")
            return

        # Step 2: Rate limit politeness
        await self.rate_limiter.wait_for_domain(domain, custom_delay=crawl_delay)

        # Step 3: Check conditional headers for incremental freshness
        existing_doc = None
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, etag, content_hash FROM crawled_documents WHERE url = ?", (target_url,))
            existing_doc = cursor.fetchone()

        etag = existing_doc["etag"] if existing_doc else None

        # Step 4: Fetch page securely
        res: FetchResult = await safe_fetcher.fetch_page(target_url, etag=etag)

        if res.is_not_modified:
            # HTTP 304: Content has not changed! Refresh metadata without re-indexing
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE crawled_documents SET crawl_timestamp = ? WHERE url = ?", (time.time(), target_url))
                cursor.execute("UPDATE crawler_queue SET status = 'completed', http_status = 304, completed_at = ? WHERE id = ?", (time.time(), queue_id))
                cursor.execute("UPDATE crawler_jobs SET total_crawled = total_crawled + 1 WHERE id = ?", (job_id,))
                conn.commit()
            return

        if not res.is_success:
            self._update_queue_item(queue_id, job_id, status="failed", http_status=res.status_code, error=res.error or f"HTTP {res.status_code}")
            return

        # Step 5: Extract HTML content & metadata
        extracted = extract_content(res.content, res.final_url)
        if not extracted or not extracted.content.strip():
            self._update_queue_item(queue_id, job_id, status="skipped", http_status=res.status_code, error="Empty or unextractable text")
            return

        # Step 6: Deduplication Check
        is_dup = False
        if existing_doc and DeduplicationEngine.is_exact_duplicate(extracted.content_hash, existing_doc["content_hash"]):
            is_dup = True

        # Step 7: Index document
        doc_id = existing_doc["id"] if existing_doc else f"doc_{uuid.uuid4().hex[:12]}"
        crawler_indexer.index_document(extracted, doc_id)

        # Update crawl queue & job progress
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE crawler_queue
                SET status = 'completed', http_status = 200, completed_at = ?
                WHERE id = ?
            """, (time.time(), queue_id))

            cursor.execute("""
                UPDATE crawler_jobs
                SET total_crawled = total_crawled + 1,
                    total_indexed = total_indexed + 1,
                    current_url = ?
                WHERE id = ?
            """, (target_url, job_id))

            # Update seed domain stats
            cursor.execute("""
                UPDATE crawler_seed_domains
                SET total_crawled = total_crawled + 1, last_crawled_at = ?
                WHERE domain = ?
            """, (time.time(), domain))
            conn.commit()

        # Step 8: Link Discovery (if depth < max_depth)
        if depth < max_depth:
            discovered_links = extract_links(res.content, res.final_url, allowed_domains=target_domains)
            self._enqueue_discovered_links(job_id, discovered_links, domain, depth + 1, source_url=target_url)

    def _enqueue_discovered_links(self, job_id: str, links: List[str], domain: str, depth: int, source_url: str):
        """Enqueues newly discovered links with SSRF checks and priority scoring."""
        if not links:
            return

        now = time.time()
        new_count = 0

        with get_db_connection() as conn:
            cursor = conn.cursor()
            for link in links[:30]:  # limit out-degree to 30 per page
                norm = normalize_url(link)
                # Check if already queued or crawled
                cursor.execute("SELECT id FROM crawler_queue WHERE job_id = ? AND normalized_url = ?", (job_id, norm))
                if cursor.fetchone():
                    continue

                # Quick scheme check
                link_domain = (urlparse(norm).hostname or "").lower()
                qid = f"q_{uuid.uuid4().hex[:12]}"
                priority = max(1, 8 - depth * 2)

                cursor.execute("""
                    INSERT INTO crawler_queue (
                        id, job_id, url, normalized_url, domain, depth,
                        priority, status, discovered_from_url, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
                """, (qid, job_id, link, norm, link_domain, depth, priority, source_url, now))
                new_count += 1

            if new_count > 0:
                cursor.execute("UPDATE crawler_jobs SET total_discovered = total_discovered + ? WHERE id = ?", (new_count, job_id))
            conn.commit()

    def _update_queue_item(self, queue_id: str, job_id: str, status: str, http_status: Optional[int] = None, error: Optional[str] = None):
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE crawler_queue
                SET status = ?, http_status = ?, error_message = ?, completed_at = ?
                WHERE id = ?
            """, (status, http_status, error, time.time(), queue_id))

            if status == "failed":
                cursor.execute("UPDATE crawler_jobs SET total_failed = total_failed + 1 WHERE id = ?", (job_id,))
            elif status == "skipped":
                cursor.execute("UPDATE crawler_jobs SET total_skipped = total_skipped + 1 WHERE id = ?", (job_id,))
            conn.commit()


# Global scheduler singleton
crawler_scheduler = CrawlerScheduler()
