"""
Centralized Asynchronous HTTP Connection Pool & Keep-Alive Manager for ANVESHA.

Reuses persistent TCP connections, DNS resolutions, and TLS handshakes across:
- Web Search & Crawling
- RSS & Worldwide News Ingestion
- Remote AI Provider Invocations
- Browser Reader Mode & Safe Fetching
"""
import httpx
from typing import Optional

_shared_async_client: Optional[httpx.AsyncClient] = None

# High-performance connection pool limits
LIMITS = httpx.Limits(
    max_connections=150,
    max_keepalive_connections=30,
    keepalive_expiry=30.0,
)

TIMEOUT = httpx.Timeout(
    timeout=10.0,
    connect=4.0,
    read=8.0,
    write=5.0,
)

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 ANVESHA/2.0 PerformanceClient",
    "Accept-Encoding": "gzip, deflate",
}


def get_shared_client() -> httpx.AsyncClient:
    """Returns the singleton pooled AsyncClient with HTTP keep-alive."""
    global _shared_async_client
    if _shared_async_client is None or _shared_async_client.is_closed:
        _shared_async_client = httpx.AsyncClient(
            limits=LIMITS,
            timeout=TIMEOUT,
            headers=DEFAULT_HEADERS,
            follow_redirects=True,
            http2=False,  # http1.1 keep-alive is rock solid across all RSS & search endpoints
        )
    return _shared_async_client


async def close_shared_client():
    """Gracefully closes all open sockets in the pool during application shutdown."""
    global _shared_async_client
    if _shared_async_client is not None and not _shared_async_client.is_closed:
        await _shared_async_client.aclose()
        _shared_async_client = None
