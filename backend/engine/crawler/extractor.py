"""
HTML Content Extraction Engine for ANVESHA Web Crawler.

Cleans HTML, eliminates boilerplate/scripts/ads/navigation,
and extracts structured technical content, headings, code blocks,
and page metadata.
"""
import re
import hashlib
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
import lxml.html
from lxml import etree

from engine.crawler.url_utils import extract_canonical_url

# Tags to drop completely along with their inner content
TAGS_TO_DROP = {
    "script", "style", "noscript", "nav", "footer", "header",
    "aside", "iframe", "svg", "canvas", "form", "select", "button",
    "dialog"
}

# Regex for noisy class/id patterns (cookie banners, ads, sidebars)
NOISY_PATTERNS = re.compile(
    r"(cookie|consent|banner|ad-|advert|promo|popup|newsletter|share-bar|social-share|disclaimer)",
    re.IGNORECASE
)

# Whitespace normalization regex
MULTI_WS = re.compile(r"\s+")


class ExtractedDocument:
    """Represents normalized, clean extracted document content and metadata."""

    def __init__(
        self,
        url: str,
        title: str,
        content: str,
        canonical_url: Optional[str] = None,
        description: str = "",
        headings: Optional[List[str]] = None,
        language: str = "en",
        author: Optional[str] = None,
        published_at: Optional[str] = None,
        last_modified_at: Optional[str] = None,
        content_hash: str = "",
        word_count: int = 0,
        text_length: int = 0,
        outbound_links_count: int = 0,
    ):
        self.url = url
        self.title = title
        self.content = content
        self.canonical_url = canonical_url or url
        self.description = description
        self.headings = headings or []
        self.language = language
        self.author = author
        self.published_at = published_at
        self.last_modified_at = last_modified_at
        self.content_hash = content_hash or hashlib.sha256(content.encode("utf-8")).hexdigest()
        self.word_count = word_count or len(content.split())
        self.text_length = text_length or len(content)
        self.outbound_links_count = outbound_links_count

    @property
    def domain(self) -> str:
        return (urlparse(self.url).hostname or "").lower()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "url": self.url,
            "canonical_url": self.canonical_url,
            "domain": self.domain,
            "title": self.title,
            "description": self.description,
            "headings": self.headings,
            "content": self.content,
            "language": self.language,
            "author": self.author,
            "published_at": self.published_at,
            "last_modified_at": self.last_modified_at,
            "content_hash": self.content_hash,
            "word_count": self.word_count,
            "text_length": self.text_length,
            "outbound_links_count": self.outbound_links_count,
        }


def extract_content(html: str, url: str) -> Optional[ExtractedDocument]:
    """
    Parses and extracts structured content and metadata from an HTML document.
    """
    if not html or not html.strip():
        return None

    try:
        doc = lxml.html.fromstring(html)
    except Exception:
        return None

    # 1. Extract Metadata
    title = ""
    title_tags = doc.xpath("//title/text()")
    if title_tags:
        title = str(title_tags[0]).strip()
    if not title:
        og_title = doc.xpath('//meta[@property="og:title"]/@content')
        if og_title:
            title = str(og_title[0]).strip()

    canonical_url = extract_canonical_url(html, url)

    description = ""
    meta_desc = doc.xpath('//meta[@name="description"]/@content')
    if meta_desc:
        description = str(meta_desc[0]).strip()
    elif doc.xpath('//meta[@property="og:description"]/@content'):
        description = str(doc.xpath('//meta[@property="og:description"]/@content')[0]).strip()

    language = "en"
    lang_attr = doc.xpath("//html/@lang")
    if lang_attr:
        language = str(lang_attr[0]).split("-")[0].strip().lower()

    author = None
    author_attr = doc.xpath('//meta[@name="author"]/@content')
    if author_attr:
        author = str(author_attr[0]).strip()

    published_at = None
    pub_meta = doc.xpath('//meta[@property="article:published_time"]/@content')
    if pub_meta:
        published_at = str(pub_meta[0]).strip()

    last_modified_at = None
    mod_meta = doc.xpath('//meta[@property="article:modified_time"]/@content')
    if mod_meta:
        last_modified_at = str(mod_meta[0]).strip()

    # Outbound links count before stripping
    outbound_links = doc.xpath("//a/@href")
    outbound_count = len(outbound_links)

    # 2. Extract Headings before dropping tags
    headings: List[str] = []
    heading_nodes = doc.xpath("//h1 | //h2 | //h3")
    for h in heading_nodes:
        txt = h.text_content().strip()
        if txt and len(txt) < 200:
            clean_txt = MULTI_WS.sub(" ", txt)
            if clean_txt not in headings:
                headings.append(clean_txt)

    # 3. Clean Boilerplate & Noise
    # Remove unwanted tags
    for tag in TAGS_TO_DROP:
        for el in doc.xpath(f"//{tag}"):
            el.drop_tree()

    # Remove elements with noisy classes or ids
    for el in doc.xpath("//*[@class or @id]"):
        cls = el.get("class", "")
        el_id = el.get("id", "")
        if NOISY_PATTERNS.search(cls) or NOISY_PATTERNS.search(el_id):
            el.drop_tree()

    # 4. Extract Main Content Text with code block preservation
    # Prefer <main> or <article> if available and substantial
    content_root = None
    candidates = doc.xpath("//main | //article | //div[@role='main'] | //div[contains(@class, 'content')] | //div[contains(@class, 'document')]")
    for c in candidates:
        text_len = len(c.text_content().strip())
        if text_len > 300:
            content_root = c
            break

    if content_root is None:
        content_root = doc.body if doc.body is not None else doc

    # Collect structured blocks
    blocks: List[str] = []
    for el in content_root.iter():
        tag = el.tag
        if tag in ("p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "pre", "blockquote"):
            text = el.text_content().strip()
            if text:
                clean_text = MULTI_WS.sub(" ", text)
                if len(clean_text) > 10:
                    blocks.append(clean_text)

    # Fallback to direct text content if block extraction is too sparse
    if not blocks or sum(len(b) for b in blocks) < 100:
        raw_body_text = content_root.text_content().strip()
        lines = [MULTI_WS.sub(" ", line).strip() for line in raw_body_text.splitlines() if line.strip()]
        full_text = "\n\n".join(lines)
    else:
        full_text = "\n\n".join(blocks)

    if not full_text.strip():
        return None

    # Calculate content hash
    content_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()

    return ExtractedDocument(
        url=url,
        title=title or (headings[0] if headings else url),
        content=full_text,
        canonical_url=canonical_url,
        description=description,
        headings=headings[:10],
        language=language,
        author=author,
        published_at=published_at,
        last_modified_at=last_modified_at,
        content_hash=content_hash,
        word_count=len(full_text.split()),
        text_length=len(full_text),
        outbound_links_count=outbound_count,
    )
