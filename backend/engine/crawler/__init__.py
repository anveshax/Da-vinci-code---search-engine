"""
ANVESHA Web Intelligence, Crawling & Indexing Engine.
"""
from engine.crawler.security import validate_crawl_url, resolve_and_validate_hostname, SSRFSecurityError
from engine.crawler.url_utils import normalize_url, extract_canonical_url, extract_links
from engine.crawler.robots import robots_manager, DomainRobotsPolicy
from engine.crawler.fetcher import safe_fetcher, FetchResult
from engine.crawler.extractor import extract_content, ExtractedDocument
from engine.crawler.dedup import DeduplicationEngine
from engine.crawler.indexer import crawler_indexer, BaseIndexer, SearchHit
from engine.crawler.scheduler import crawler_scheduler, CrawlerScheduler
from engine.crawler.engine import web_intelligence_engine, WebIntelligenceEngine

__all__ = [
    "validate_crawl_url",
    "resolve_and_validate_hostname",
    "SSRFSecurityError",
    "normalize_url",
    "extract_canonical_url",
    "extract_links",
    "robots_manager",
    "DomainRobotsPolicy",
    "safe_fetcher",
    "FetchResult",
    "extract_content",
    "ExtractedDocument",
    "DeduplicationEngine",
    "crawler_indexer",
    "BaseIndexer",
    "SearchHit",
    "crawler_scheduler",
    "CrawlerScheduler",
    "web_intelligence_engine",
    "WebIntelligenceEngine",
]
