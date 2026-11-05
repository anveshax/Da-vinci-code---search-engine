"""
News Normalizer for ANVESHA Worldwide News Platform.
Standardizes articles across WorldPulse, Actually Relevant, RSS/Atom, and FreshRSS into clean NewsArticle objects.
"""
import re
import hashlib
from datetime import datetime, timezone
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from typing import Optional, Dict, Any
from lxml import html
from .models import NewsArticle

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "msclkid", "mc_cid", "mc_eid", "ref", "source", "feed"
}


def canonicalize_url(raw_url: str) -> str:
    """Strips tracking params, fragments, and standardizes URL."""
    if not raw_url:
        return ""
    try:
        parsed = urlparse(raw_url.strip())
        netloc = parsed.netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        query_pairs = parse_qsl(parsed.query, keep_blank_values=False)
        filtered_query = [(k, v) for k, v in query_pairs if k.lower() not in TRACKING_PARAMS]
        new_query = urlencode(filtered_query)
        path = parsed.path.rstrip("/")
        if not path:
            path = "/"
        canonical = urlunparse((parsed.scheme.lower() or "https", netloc, path, "", new_query, ""))
        return canonical
    except Exception:
        return raw_url.strip()


def generate_article_id(canonical_url: str, title: str) -> str:
    """Generates a stable deterministic ID for an article."""
    payload = f"{canonical_url}::{title.lower().strip()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def clean_text_snippet(raw_html_or_text: Optional[str], max_len: int = 350) -> str:
    """Strips HTML tags, cleans extra whitespace, and limits length."""
    if not raw_html_or_text:
        return ""
    try:
        if "<" in raw_html_or_text and ">" in raw_html_or_text:
            tree = html.fromstring(f"<div>{raw_html_or_text}</div>")
            text = " ".join(tree.xpath("//text()"))
        else:
            text = raw_html_or_text
    except Exception:
        text = re.sub(r"<[^>]+>", " ", raw_html_or_text)
    
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        text = text[:max_len].rsplit(" ", 1)[0] + "..."
    return text


def parse_datetime_to_iso(dt_input: Any) -> str:
    """Converts varied timestamps (RFC 2822, ISO, epoch) to standardized ISO 8601 UTC."""
    if not dt_input:
        return datetime.now(timezone.utc).isoformat()
    if isinstance(dt_input, datetime):
        if dt_input.tzinfo is None:
            dt_input = dt_input.replace(tzinfo=timezone.utc)
        return dt_input.isoformat()
    
    dt_str = str(dt_input).strip()
    
    # Try ISO formats
    for fmt in [
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%a, %d %b %Y %H:%M:%S",
        "%d %b %Y %H:%M:%S %z",
    ]:
        try:
            parsed = datetime.strptime(dt_str, fmt)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.isoformat()
        except ValueError:
            continue
            
    # Try regex fallback for ISO with timezone offset
    try:
        iso_clean = re.sub(r"\.([0-9]+)", "", dt_str)
        return datetime.fromisoformat(iso_clean).astimezone(timezone.utc).isoformat()
    except Exception:
        pass
        
    return datetime.now(timezone.utc).isoformat()


def map_category_slug(raw_category: Optional[str]) -> str:
    """Maps varied category labels to standardized ANVESHA categories."""
    if not raw_category:
        return "world"
    cat = raw_category.lower().strip()
    if any(k in cat for k in ["tech", "artificial intelligence", "ai", "computing", "software", "gadget", "crypto"]):
        return "technology"
    if any(k in cat for k in ["cyber", "security", "malware", "hack", "ransomware"]):
        return "cybersecurity"
    if any(k in cat for k in ["climate", "warming", "cop", "emission", "greenhouse"]):
        return "climate"
    if any(k in cat for k in ["environ", "planet", "wildlife", "ocean", "conservation"]):
        return "environment"
    if any(k in cat for k in ["finance", "market", "stock", "economy", "bank", "invest", "crypto"]):
        return "finance"
    if any(k in cat for k in ["business", "company", "trade", "enterprise"]):
        return "business"
    if any(k in cat for k in ["science", "space", "astronomy", "physics", "biology"]):
        return "science"
    if any(k in cat for k in ["health", "medicin", "virus", "vaccin", "disease", "hospital"]):
        return "health"
    if any(k in cat for k in ["politic", "election", "parliament", "congress", "senate", "minister"]):
        return "politics"
    if any(k in cat for k in ["india", "delhi", "mumbai", "bharat"]):
        return "india"
    if any(k in cat for k in ["sport", "cricket", "football", "olympic", "tennis"]):
        return "sports"
    if any(k in cat for k in ["entertain", "movie", "film", "music", "cinema"]):
        return "entertainment"
    if any(k in cat for k in ["educat", "university", "school", "student", "college"]):
        return "education"
    if any(k in cat for k in ["startup", "venture", "funding", "founder"]):
        return "startups"
    if any(k in cat for k in ["breaking", "alert", "urgent"]):
        return "breaking"
    return "world"
