"""
Asynchronous HTTP Fetching Engine with SSRF Protection and Conditional Requests.
"""
import time
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse
import httpx

from engine.crawler.security import (
    validate_crawl_url,
    validate_content_type,
    MAX_RESPONSE_BYTES,
    SSRFSecurityError,
    SafeAsyncHTTPTransport,
)
from engine.crawler.robots import USER_AGENT

logger = logging.getLogger(__name__)


class FetchResult:
    """Represents the outcome of an HTTP fetch request."""

    def __init__(
        self,
        url: str,
        final_url: str = "",
        status_code: int = 0,
        content: str = "",
        raw_bytes_length: int = 0,
        etag: Optional[str] = None,
        last_modified: Optional[str] = None,
        content_type: str = "",
        latency_ms: int = 0,
        error: Optional[str] = None,
        is_not_modified: bool = False,
    ):
        self.url = url
        self.final_url = final_url or url
        self.status_code = status_code
        self.content = content
        self.raw_bytes_length = raw_bytes_length
        self.etag = etag
        self.last_modified = last_modified
        self.content_type = content_type
        self.latency_ms = latency_ms
        self.error = error
        self.is_not_modified = is_not_modified

    @property
    def is_success(self) -> bool:
        return self.status_code == 200 and not self.error


class SafeFetcher:
    """
    Executes secure HTTP fetches with SSRF prevention, redirect re-validation,
    content-type filtering, size bounding, and conditional HTTP caching.
    """

    def __init__(
        self,
        connect_timeout: float = 5.0,
        read_timeout: float = 12.0,
        max_redirects: int = 5,
    ):
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self.max_redirects = max_redirects

    async def fetch_page(
        self,
        url: str,
        etag: Optional[str] = None,
        last_modified: Optional[str] = None,
    ) -> FetchResult:
        """
        Safely fetches an HTML webpage, adhering to SSRF controls and size caps.
        """
        # Step 1: Initial SSRF check on target URL
        is_safe, reason = validate_crawl_url(url)
        if not is_safe:
            return FetchResult(url, status_code=403, error=f"Security rejection: {reason}")

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
        }

        # Step 2: Conditional caching headers for incremental freshness
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified

        current_url = url
        redirect_count = 0
        start_time = time.time()

        timeout = httpx.Timeout(
            connect=self.connect_timeout,
            read=self.read_timeout,
            write=10.0,
            pool=10.0,
        )

        try:
            transport = SafeAsyncHTTPTransport()
            async with httpx.AsyncClient(timeout=timeout, transport=transport, follow_redirects=False) as client:
                while redirect_count <= self.max_redirects:
                    response = await client.get(current_url, headers=headers)
                    latency = round((time.time() - start_time) * 1000)

                    # Handle Redirects manually to re-verify every target destination for SSRF
                    if response.status_code in (301, 302, 303, 307, 308):
                        location = response.headers.get("location")
                        if not location:
                            return FetchResult(url, current_url, response.status_code, latency_ms=latency, error="Redirect missing Location header")

                        from urllib.parse import urljoin
                        next_url = urljoin(current_url, location)

                        # Validate redirect target against SSRF!
                        safe_dest, dest_reason = validate_crawl_url(next_url)
                        if not safe_dest:
                            return FetchResult(url, next_url, 403, latency_ms=latency, error=f"Redirect blocked by SSRF check: {dest_reason}")

                        current_url = next_url
                        redirect_count += 1
                        continue

                    # 304 Not Modified
                    if response.status_code == 304:
                        return FetchResult(
                            url=url,
                            final_url=current_url,
                            status_code=304,
                            latency_ms=latency,
                            is_not_modified=True,
                        )

                    # Check Content-Type
                    content_type = response.headers.get("content-type", "")
                    is_valid_type, type_reason = validate_content_type(content_type)
                    if not is_valid_type:
                        return FetchResult(
                            url=url,
                            final_url=current_url,
                            status_code=response.status_code,
                            content_type=content_type,
                            latency_ms=latency,
                            error=f"MIME type rejected: {type_reason}",
                        )

                    # Stream read body up to MAX_RESPONSE_BYTES
                    raw_bytes = bytearray()
                    async for chunk in response.aiter_bytes():
                        raw_bytes.extend(chunk)
                        if len(raw_bytes) > MAX_RESPONSE_BYTES:
                            return FetchResult(
                                url=url,
                                final_url=current_url,
                                status_code=response.status_code,
                                content_type=content_type,
                                latency_ms=latency,
                                error=f"Response exceeded size limit ({MAX_RESPONSE_BYTES} bytes)",
                            )

                    # Decode HTML text
                    charset = response.encoding or "utf-8"
                    try:
                        decoded_text = raw_bytes.decode(charset, errors="replace")
                    except Exception:
                        decoded_text = raw_bytes.decode("utf-8", errors="replace")

                    return FetchResult(
                        url=url,
                        final_url=current_url,
                        status_code=response.status_code,
                        content=decoded_text,
                        raw_bytes_length=len(raw_bytes),
                        etag=response.headers.get("etag"),
                        last_modified=response.headers.get("last-modified"),
                        content_type=content_type,
                        latency_ms=latency,
                    )

                return FetchResult(url, current_url, status_code=310, error="Too many redirects")

        except httpx.TimeoutException:
            latency = round((time.time() - start_time) * 1000)
            return FetchResult(url, current_url, status_code=408, latency_ms=latency, error="Fetch request timed out")
        except SSRFSecurityError as se:
            latency = round((time.time() - start_time) * 1000)
            return FetchResult(url, current_url, status_code=403, latency_ms=latency, error=f"SSRF violation: {se}")
        except Exception as e:
            latency = round((time.time() - start_time) * 1000)
            return FetchResult(url, current_url, status_code=500, latency_ms=latency, error=f"Network error: {str(e)}")


# Global fetcher singleton
safe_fetcher = SafeFetcher()
