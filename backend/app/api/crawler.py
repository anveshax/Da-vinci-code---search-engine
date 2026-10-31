"""
Web Intelligence & Web Crawler REST API Router.

Endpoints for managing seed domains, crawl jobs, full-text document index,
and real-time monitoring metrics.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field

from engine.crawler.engine import web_intelligence_engine
from engine.crawler.security import SSRFSecurityError

router = APIRouter(prefix="/crawler", tags=["Web Intelligence & Crawler"])


# --- Request & Response Models ---

class AddDomainRequest(BaseModel):
    domain: str = Field(..., description="Fully qualified domain name, e.g. docs.python.org")
    allowed_paths: Optional[List[str]] = Field(default=["/"], description="Allowed path prefixes")
    crawl_delay_sec: float = Field(default=1.0, ge=0.5, le=10.0, description="Polite crawl delay in seconds")
    max_depth: int = Field(default=2, ge=1, le=5, description="Maximum crawl traversal depth")
    max_pages: int = Field(default=50, ge=5, le=500, description="Maximum pages to crawl")


class CreateJobRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=100, description="Job title or label")
    target_domains: List[str] = Field(..., min_length=1, description="List of domains to crawl")
    max_pages: int = Field(default=30, ge=5, le=200, description="Target pages cap")
    max_depth: int = Field(default=2, ge=1, le=4, description="Link traversal depth")


# --- Endpoints ---

@router.get("/stats")
def get_crawler_overview_stats():
    """Returns high-level statistics for Web Intelligence dashboard."""
    return web_intelligence_engine.get_overview_stats()


@router.get("/domains")
def list_crawler_domains():
    """Lists all configured seed domains with robots.txt status and metrics."""
    return {"domains": web_intelligence_engine.list_domains()}


@router.post("/domains")
def add_crawler_domain(payload: AddDomainRequest):
    """Adds a new domain to the crawl allowlist after security validation."""
    try:
        res = web_intelligence_engine.add_domain(
            domain=payload.domain,
            allowed_paths=payload.allowed_paths,
            crawl_delay_sec=payload.crawl_delay_sec,
            max_depth=payload.max_depth,
            max_pages=payload.max_pages,
        )
        return {"status": "success", "domain": res}
    except SSRFSecurityError as s_err:
        raise HTTPException(status_code=400, detail=f"SSRF Security Violation: {str(s_err)}")
    except ValueError as v_err:
        raise HTTPException(status_code=409, detail=str(v_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add domain: {str(e)}")


@router.post("/domains/{domain_id}/toggle")
def toggle_crawler_domain(domain_id: str):
    """Enables or disables a domain for future crawling."""
    enabled = web_intelligence_engine.toggle_domain(domain_id)
    return {"status": "success", "domain_id": domain_id, "enabled": enabled}


@router.delete("/domains/{domain_id}")
def delete_crawler_domain(domain_id: str):
    """Removes a domain from the crawl allowlist."""
    web_intelligence_engine.delete_domain(domain_id)
    return {"status": "success", "domain_id": domain_id}


@router.get("/jobs")
def list_crawler_jobs(limit: int = Query(20, ge=1, le=100)):
    """Lists crawl jobs with status, page counts, and progress percentages."""
    return {"jobs": web_intelligence_engine.list_jobs(limit=limit)}


@router.get("/jobs/{job_id}")
def get_crawler_job_details(job_id: str):
    """Returns detailed job status, config, and recent queue entries."""
    job = web_intelligence_engine.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Crawl job '{job_id}' not found.")
    return job


@router.post("/jobs")
async def create_and_start_crawler_job(payload: CreateJobRequest, background_tasks: BackgroundTasks):
    """Creates and starts an asynchronous crawling task."""
    try:
        job_id = await web_intelligence_engine.create_and_start_job(
            title=payload.title,
            domains=payload.target_domains,
            max_pages=payload.max_pages,
            max_depth=payload.max_depth,
        )
        return {"status": "started", "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not start crawl job: {str(e)}")


@router.post("/jobs/{job_id}/pause")
def pause_crawler_job(job_id: str):
    """Pauses an active crawl job."""
    web_intelligence_engine.scheduler.pause_job(job_id)
    return {"status": "paused", "job_id": job_id}


@router.post("/jobs/{job_id}/resume")
def resume_crawler_job(job_id: str):
    """Resumes a paused crawl job."""
    web_intelligence_engine.scheduler.resume_job(job_id)
    return {"status": "resumed", "job_id": job_id}


@router.post("/jobs/{job_id}/cancel")
def cancel_crawler_job(job_id: str):
    """Cancels a crawl job."""
    web_intelligence_engine.scheduler.cancel_job(job_id)
    return {"status": "cancelled", "job_id": job_id}


@router.post("/jobs/{job_id}/retry")
async def retry_crawler_job_failures(job_id: str):
    """Retries all failed URLs for a given job."""
    await web_intelligence_engine.scheduler.retry_failed_urls(job_id)
    return {"status": "retrying", "job_id": job_id}


@router.get("/documents")
def list_indexed_documents(
    q: Optional[str] = Query(None, description="Full-text search query"),
    domain: Optional[str] = Query(None, description="Domain filter"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Searches or lists indexed documents from the full-text BM25 index."""
    return web_intelligence_engine.list_documents(query=q, domain=domain, limit=limit, offset=offset)


@router.get("/documents/{document_id}")
def get_indexed_document(document_id: str):
    """Retrieves full content, headings, and metadata of an indexed document."""
    doc = web_intelligence_engine.indexer.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@router.delete("/documents/{document_id}")
def delete_indexed_document(document_id: str):
    """Removes a document from the index and database."""
    web_intelligence_engine.indexer.delete_document(document_id)
    return {"status": "deleted", "document_id": document_id}


@router.get("/monitoring")
def get_crawler_monitoring_metrics():
    """Provides fetch latency, HTTP status distribution, and domain-level crawl activity."""
    return web_intelligence_engine.get_monitoring_metrics()


@router.get("/semantic/health")
def get_semantic_engine_health():
    """Returns connectivity and configuration status of the embedding provider."""
    from engine.semantic.embeddings import get_embedding_provider
    provider = get_embedding_provider()
    return provider.check_health()


@router.get("/semantic/stats")
def get_semantic_stats():
    """Returns vector store metrics, passage chunks count, and active dimensions."""
    from engine.semantic.vector_store import vector_store
    return {
        "total_chunks": vector_store.count_chunks(),
        "embedding_provider": vector_store.provider.provider_id,
        "embedding_model": vector_store.provider.model,
        "embedding_dim": vector_store.provider.dimension,
    }


@router.post("/semantic/backfill")
def trigger_semantic_backfill(limit: Optional[int] = Query(20, ge=1, le=200)):
    """Triggers incremental embedding generation for pending crawled documents."""
    from engine.semantic.vector_store import vector_store
    result = vector_store.backfill_crawled_documents(limit=limit)
    return {
        "status": "success",
        "result": result,
        "total_chunks_now": vector_store.count_chunks(),
    }


@router.get("/search/hybrid")
def hybrid_search_test(
    q: str = Query(..., min_length=1, max_length=500),
    domain: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """Executes reciprocal rank fusion search combining SQLite BM25 and dense vector search."""
    from engine.semantic.hybrid_retriever import hybrid_retriever
    hits = hybrid_retriever.search_sync(query=q, domain_filter=domain, limit=limit)
    return {
        "query": q,
        "total": len(hits),
        "results": [h.to_dict() for h in hits],
    }


class SitemapIngestRequest(BaseModel):
    sitemap_url: str = Field(..., description="Full URL to sitemap.xml or sitemap_index.xml")
    job_id: Optional[str] = Field(default="default_job", description="Associated job ID")
    max_urls: Optional[int] = Field(default=200, ge=1, le=1000)


@router.post("/sitemap/ingest")
def ingest_sitemap_urls(payload: SitemapIngestRequest):
    """Parses and enqueues URLs from an XML sitemap or sitemap index into ANVESHA's frontier."""
    from engine.crawler.sitemap import sitemap_processor
    res = sitemap_processor.ingest_sitemap(
        sitemap_url=payload.sitemap_url,
        job_id=payload.job_id or "default_job",
        max_urls_to_enqueue=payload.max_urls or 200,
    )
    return res


@router.get("/sitemap/discover")
def discover_domain_sitemaps(domain: str = Query(..., min_length=3)):
    """Discovers sitemaps for a domain via robots.txt and standard locations."""
    from engine.crawler.sitemap import sitemap_processor
    sitemaps = sitemap_processor.discover_sitemaps_for_domain(domain)
    return {"domain": domain, "sitemaps": sitemaps}

