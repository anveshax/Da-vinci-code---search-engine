"""
Robots.txt Parser & Domain Politeness Engine for ANVESHA.

Fetches, parses, and caches robots.txt rules per domain with TTL.
Respects Disallow paths, Crawl-delay directives, and extracts Sitemap declarations.
"""
import time
import logging
from typing import Dict, Any, Optional, List, Tuple
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
import httpx

from engine.crawler.security import validate_crawl_url, SafeAsyncHTTPTransport

logger = logging.getLogger(__name__)

USER_AGENT = "AnveshaBot/1.0 (+https://anvesha.ai/bot)"


class DomainRobotsPolicy:
    """Stores parsed robots.txt rules, crawl delay, and sitemaps for a domain."""

    def __init__(self, domain: str, raw_text: str, status_code: int = 200):
        self.domain = domain.lower().strip()
        self.raw_text = raw_text
        self.status_code = status_code
        self.fetched_at = time.time()
        self.parser = RobotFileParser()
        self.crawl_delay: Optional[float] = None
        self.sitemaps: List[str] = []

        self._parse()

    def _parse(self):
        if self.status_code == 404:
            # HTTP 404 means no crawl restrictions
            self.parser.allow_all = True
            return

        lines = self.raw_text.splitlines()
        self.parser.parse(lines)

        # Extract crawl-delay and sitemaps
        for line in lines:
            clean = line.strip()
            if not clean or clean.startswith("#"):
                continue

            parts = clean.split(":", 1)
            if len(parts) == 2:
                key = parts[0].strip().lower()
                val = parts[1].strip()
                if key == "sitemap":
                    if val.startswith("http"):
                        self.sitemaps.append(val)
                elif key == "crawl-delay":
                    try:
                        self.crawl_delay = float(val)
                    except ValueError:
                        pass

    def can_fetch(self, url: str) -> bool:
        """Checks if AnveshaBot is permitted to fetch this URL."""
        if self.status_code == 404:
            return True
        if self.status_code >= 500:
            # Server error on robots.txt -> be conservative
            return False

        return self.parser.can_fetch(USER_AGENT, url) or self.parser.can_fetch("*", url)


class RobotsManager:
    """Manages asynchronous fetching, parsing, and caching of domain robots.txt files."""

    def __init__(self, cache_ttl_seconds: int = 86400):
        self.cache_ttl = cache_ttl_seconds
        self._cache: Dict[str, DomainRobotsPolicy] = {}

    async def get_policy(self, domain: str) -> DomainRobotsPolicy:
        """Retrieves cached policy or fetches robots.txt asynchronously."""
        clean_domain = domain.lower().strip()
        now = time.time()

        if clean_domain in self._cache:
            policy = self._cache[clean_domain]
            if now - policy.fetched_at < self.cache_ttl:
                return policy

        # Fetch fresh robots.txt
        policy = await self._fetch_robots_txt(clean_domain)
        self._cache[clean_domain] = policy
        return policy

    async def _fetch_robots_txt(self, domain: str) -> DomainRobotsPolicy:
        robots_url = f"https://{domain}/robots.txt"
        
        # SSRF check on robots.txt URL
        is_safe, reason = validate_crawl_url(robots_url)
        if not is_safe:
            logger.warning(f"Robots.txt URL failed security check for {domain}: {reason}")
            # Block crawling if domain fails security
            return DomainRobotsPolicy(domain, "", status_code=500)

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/plain",
        }

        try:
            transport = SafeAsyncHTTPTransport()
            async with httpx.AsyncClient(timeout=8.0, transport=transport, follow_redirects=True) as client:
                res = await client.get(robots_url, headers=headers)
                if res.status_code == 200:
                    return DomainRobotsPolicy(domain, res.text, status_code=200)
                elif res.status_code == 404:
                    return DomainRobotsPolicy(domain, "", status_code=404)
                else:
                    return DomainRobotsPolicy(domain, "", status_code=res.status_code)
        except Exception as e:
            logger.warning(f"Failed to fetch robots.txt for {domain}: {e}")
            # Default to permissive if connection error on small sites, or 404 behavior
            return DomainRobotsPolicy(domain, "", status_code=404)

    async def is_allowed(self, url: str) -> Tuple[bool, Optional[float]]:
        """
        Determines whether the given URL is allowed to be crawled according to robots.txt.
        Returns (is_allowed, crawl_delay_seconds).
        """
        parsed = urlparse(url)
        domain = parsed.hostname
        if not domain:
            return False, None

        policy = await self.get_policy(domain)
        allowed = policy.can_fetch(url)
        return allowed, policy.crawl_delay

    def get_policy_sync(self, domain: str) -> DomainRobotsPolicy:
        """Retrieves cached policy or fetches robots.txt synchronously."""
        clean_domain = domain.lower().strip()
        now = time.time()

        if clean_domain in self._cache:
            policy = self._cache[clean_domain]
            if now - policy.fetched_at < self.cache_ttl:
                return policy

        robots_url = f"https://{clean_domain}/robots.txt"
        is_safe, _ = validate_crawl_url(robots_url)
        if not is_safe:
            policy = DomainRobotsPolicy(clean_domain, "", status_code=500)
            self._cache[clean_domain] = policy
            return policy

        try:
            with httpx.Client(timeout=6.0, follow_redirects=True) as client:
                res = client.get(robots_url, headers={"User-Agent": USER_AGENT, "Accept": "text/plain"})
                policy = DomainRobotsPolicy(clean_domain, res.text if res.status_code == 200 else "", status_code=res.status_code)
                self._cache[clean_domain] = policy
                return policy
        except Exception:
            policy = DomainRobotsPolicy(clean_domain, "", status_code=404)
            self._cache[clean_domain] = policy
            return policy

    def is_allowed_sync(self, url: str) -> bool:
        """Synchronous check if a URL is crawlable under robots.txt."""
        parsed = urlparse(url)
        domain = parsed.hostname
        if not domain:
            return False
        policy = self.get_policy_sync(domain)
        return policy.can_fetch(url)

    def get_rules(self, domain: str) -> Optional[DomainRobotsPolicy]:
        """Convenience alias to retrieve domain robots policy synchronously."""
        return self.get_policy_sync(domain)


# Global singleton instance
robots_manager = RobotsManager()
