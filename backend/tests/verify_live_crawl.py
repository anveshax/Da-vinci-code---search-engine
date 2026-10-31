"""
Live Verification Script for ANVESHA Web Crawler & Hybrid Search Integration.
Crawl a small, permitted technical documentation subset from docs.python.org,
index the content, and test retrieval through ANVESHA Search V2.
"""
import asyncio
import time
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from engine.crawler.engine import web_intelligence_engine
from engine.crawler.indexer import crawler_indexer
from app.core.db import get_db_connection

async def run_live_test():
    print("=== ANVESHA LIVE CRAWL & INDEXING TEST ===")
    
    # 1. Target a permitted technical documentation domain
    domain = "docs.python.org"
    print(f"[Step 1] Target Domain: {domain}")
    
    # 2. Dispatch a controlled, small crawl job (cap 5 pages, max_depth 1)
    print(f"[Step 2] Dispatching controlled crawl job...")
    job_id = await web_intelligence_engine.create_and_start_job(
        title="Live Python 3 Docs Test Crawl",
        domains=[domain],
        max_pages=4,
        max_depth=1
    )
    print(f"Job ID: {job_id} dispatched.")
    
    # 3. Wait for crawler worker to process seed and initial pages
    print("[Step 3] Waiting for worker execution...")
    for _ in range(15):
        await asyncio.sleep(1.0)
        job = web_intelligence_engine.get_job(job_id)
        print(f"Status: {job['status']} | Crawled: {job['total_crawled']} | Indexed: {job['total_indexed']} | Discovered: {job['total_discovered']}")
        if job["total_indexed"] >= 2 or job["status"] in ("completed", "failed"):
            break
            
    # 4. Verify indexed documents
    print(f"\n[Step 4] Checking Indexed Documents in SQLite FTS5...")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, url, title, word_count, crawl_timestamp FROM crawled_documents WHERE domain = ?", (domain,))
        rows = cursor.fetchall()
        print(f"Total documents indexed for {domain}: {len(rows)}")
        for r in rows:
            print(f"- Title: {r['title']}")
            print(f"  URL: {r['url']}")
            print(f"  Words: {r['word_count']} | Timestamp: {r['crawl_timestamp']}")
            
    # 5. Search the internal index
    query = "Python tutorial documentation"
    print(f"\n[Step 5] Searching Internal Index with Query: '{query}'")
    hits = crawler_indexer.search(query=query, limit=3)
    print(f"Hits found in internal index: {len(hits)}")
    for h in hits:
        print(f"* Match: {h.title} (BM25 Score: {round(h.score, 4)})")
        print(f"  URL: {h.url}")
        print(f"  Snippet: {h.snippet[:120]}...")
        
    print("\n[Step 6] Verification complete!")

if __name__ == "__main__":
    asyncio.run(run_live_test())
