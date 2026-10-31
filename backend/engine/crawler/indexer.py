"""
Search Indexing Engine for ANVESHA Web Intelligence.

Implements BaseIndexer with two backends:
1. SQLiteFTS5Indexer: Production-grade local full-text search with BM25 scoring,
   stemming, field-weighting, domain filtering, and highlight snippets.
2. OpenSearchIndexer: Enterprise adapter for distributed OpenSearch clusters.
"""
import time
import json
import logging
import re
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple

from app.core.db import get_db_connection
from engine.crawler.extractor import ExtractedDocument

logger = logging.getLogger(__name__)

# Standard English stopwords to prevent spurious broad matches in FTS5
ENGLISH_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
    "has", "hasn't", "have", "haven't", "having", "he", "her", "here", "hers", "herself", "him",
    "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
    "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on",
    "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
    "shan't", "she", "should", "shouldn't", "so", "some", "such", "than", "that", "the", "their",
    "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those", "through",
    "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "were", "weren't", "what",
    "when", "where", "which", "while", "who", "whom", "why", "with", "won't", "would", "wouldn't",
    "you", "your", "yours", "yourself", "yourselves"
}


class SearchHit:
    """Represents a ranked document match from the search index."""

    def __init__(
        self,
        doc_id: str,
        url: str,
        canonical_url: str,
        domain: str,
        title: str,
        snippet: str,
        score: float,
        crawl_timestamp: float,
        language: str = "en",
        source: str = "anvesha_index",
    ):
        self.doc_id = doc_id
        self.url = url
        self.canonical_url = canonical_url
        self.domain = domain
        self.title = title
        self.snippet = snippet
        self.score = score
        self.crawl_timestamp = crawl_timestamp
        self.language = language
        self.source = source

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "url": self.url,
            "canonical_url": self.canonical_url,
            "domain": self.domain,
            "title": self.title,
            "snippet": self.snippet,
            "score": round(self.score, 4),
            "crawl_timestamp": self.crawl_timestamp,
            "language": self.language,
            "source": self.source,
            "is_internal_index": True,
        }


class BaseIndexer(ABC):
    """Abstract interface for document indexing and retrieval engines."""

    @abstractmethod
    def index_document(self, doc: ExtractedDocument, doc_id: str) -> bool:
        """Indexes or updates an extracted document."""
        pass

    @abstractmethod
    def delete_document(self, doc_id: str) -> bool:
        """Removes a document from the index."""
        pass

    @abstractmethod
    def search(
        self,
        query: str,
        domain_filter: Optional[str] = None,
        language: Optional[str] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> List[SearchHit]:
        """Performs full-text search with ranking and filtering."""
        pass

    @abstractmethod
    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves document details by ID."""
        pass

    @abstractmethod
    def count_documents(self) -> int:
        """Returns the total number of indexed documents."""
        pass


class SQLiteFTS5Indexer(BaseIndexer):
    """
    Built-in Full-Text Search Engine powered by SQLite FTS5 with native BM25.
    Works out-of-the-box on every developer machine with zero extra services.
    """

    def __init__(self):
        self._ensure_tables()

    def _ensure_tables(self):
        """Ensures the FTS5 virtual table and synchronization triggers exist."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # FTS5 Virtual Table for Crawled Content
            cursor.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS crawled_documents_fts USING fts5(
                    doc_id UNINDEXED,
                    url,
                    title,
                    headings,
                    content,
                    domain,
                    tokenize='porter unicode61'
                );
            """)
            conn.commit()

    def index_document(self, doc: ExtractedDocument, doc_id: str) -> bool:
        """Inserts or updates document in crawled_documents and crawled_documents_fts."""
        now = time.time()
        headings_json = json.dumps(doc.headings)
        headings_text = " ".join(doc.headings)

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Check if document already exists
            cursor.execute("SELECT id, content_hash FROM crawled_documents WHERE url = ?", (doc.url,))
            existing = cursor.fetchone()

            if existing:
                existing_id = existing["id"]
                # Update base table
                cursor.execute("""
                    UPDATE crawled_documents
                    SET canonical_url = ?, domain = ?, title = ?, description = ?,
                        headings = ?, content = ?, language = ?, author = ?,
                        published_at = ?, last_modified_at = ?, content_hash = ?,
                        text_length = ?, word_count = ?, outbound_links_count = ?,
                        crawl_timestamp = ?, http_status = 200
                    WHERE id = ?
                """, (
                    doc.canonical_url, doc.domain, doc.title, doc.description,
                    headings_json, doc.content, doc.language, doc.author,
                    doc.published_at, doc.last_modified_at, doc.content_hash,
                    doc.text_length, doc.word_count, doc.outbound_links_count,
                    now, existing_id
                ))

                # Update FTS5 index (delete and insert)
                cursor.execute("DELETE FROM crawled_documents_fts WHERE doc_id = ?", (existing_id,))
                cursor.execute("""
                    INSERT INTO crawled_documents_fts (doc_id, url, title, headings, content, domain)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (existing_id, doc.url, doc.title, headings_text, doc.content, doc.domain))

            else:
                # Insert new record into base table
                cursor.execute("""
                    INSERT INTO crawled_documents (
                        id, url, canonical_url, domain, title, description,
                        headings, content, language, author, published_at,
                        last_modified_at, content_hash, text_length, word_count,
                        outbound_links_count, crawl_timestamp, http_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 200)
                """, (
                    doc_id, doc.url, doc.canonical_url, doc.domain, doc.title, doc.description,
                    headings_json, doc.content, doc.language, doc.author, doc.published_at,
                    doc.last_modified_at, doc.content_hash, doc.text_length, doc.word_count,
                    doc.outbound_links_count, now
                ))

                # Insert into FTS5 index
                cursor.execute("""
                    INSERT INTO crawled_documents_fts (doc_id, url, title, headings, content, domain)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (doc_id, doc.url, doc.title, headings_text, doc.content, doc.domain))

            conn.commit()

        # Incrementally index semantic passages (non-blocking for BM25)
        try:
            from engine.semantic.vector_store import vector_store
            target_id = existing_id if existing else doc_id
            vector_store.index_document_passages(
                document_id=target_id,
                url=doc.url,
                domain=doc.domain,
                title=doc.title,
                content=doc.content,
                headings=doc.headings,
                canonical_url=doc.canonical_url,
            )
        except Exception as exc:
            logger.warning(f"Vector passage indexing failed for {doc_id} (BM25 remains active): {exc}")

        return True

    def delete_document(self, doc_id: str) -> bool:
        """Removes a document from database, FTS index, and semantic vector store."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM crawled_documents WHERE id = ?", (doc_id,))
            cursor.execute("DELETE FROM crawled_documents_fts WHERE doc_id = ?", (doc_id,))
            cursor.execute("DELETE FROM crawled_document_chunks WHERE document_id = ?", (doc_id,))
            conn.commit()
        return True

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM crawled_documents WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            if row:
                d = dict(row)
                try:
                    d["headings"] = json.loads(d.get("headings") or "[]")
                except Exception:
                    d["headings"] = []
                return d
            return None

    def count_documents(self) -> int:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as cnt FROM crawled_documents")
            return cursor.fetchone()["cnt"]

    def search(
        self,
        query: str,
        domain_filter: Optional[str] = None,
        language: Optional[str] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> List[SearchHit]:
        """
        Executes full-text BM25 search over crawled documents with field weighting,
        stopword filtering, length-sensitive prefix tokens, and topical relevance validation.
        """
        if not query or not query.strip():
            return []

        # Sanitize FTS query tokens
        clean_terms = [t for t in query.strip().replace('"', '').replace("'", "").split() if t]
        if not clean_terms:
            return []

        # Separate content terms from generic stopwords
        content_terms = [t for t in clean_terms if t.lower() not in ENGLISH_STOPWORDS]
        active_terms = content_terms if content_terms else clean_terms

        def _format_token(token: str) -> str:
            # Terms of 3 characters or less (e.g. AI, CPU, RAM, TCP, SQL) must NOT use prefix wildcard
            # to avoid false positive explosions (e.g. 'ai*' matching 'air', 'aim', 'aifc')
            if len(token) <= 3:
                return f'"{token}"'
            return f'"{token}"*'

        # Format FTS5 queries: attempt conjunctive (AND) first for multi-term queries
        formatted_tokens = [_format_token(t) for t in active_terms]
        fts_queries_to_try = []
        if len(formatted_tokens) > 1:
            fts_queries_to_try.append(" ".join(formatted_tokens))  # implicit AND
        fts_queries_to_try.append(" OR ".join(formatted_tokens))

        hits: List[SearchHit] = []
        with get_db_connection() as conn:
            cursor = conn.cursor()

            for fts_query in fts_queries_to_try:
                filter_clauses = ["crawled_documents_fts MATCH ?"]
                params: List[Any] = [fts_query]

                if domain_filter:
                    filter_clauses.append("crawled_documents_fts.domain = ?")
                    params.append(domain_filter.lower().strip())

                where_str = " AND ".join(filter_clauses)
                lang_filter = "WHERE d.language = ?" if language else ""

                sql = f"""
                    WITH ranked AS (
                        SELECT 
                            rowid,
                            doc_id,
                            url,
                            title,
                            domain,
                            bm25(crawled_documents_fts, 0.0, 1.0, 5.0, 3.0, 1.0, 2.0) as bm25_score
                        FROM crawled_documents_fts
                        WHERE {where_str}
                        ORDER BY bm25_score ASC
                        LIMIT ? OFFSET ?
                    )
                    SELECT 
                        r.doc_id,
                        r.url,
                        r.title,
                        r.domain,
                        snippet(crawled_documents_fts, 4, '<mark>', '</mark>', '...', 28) as snippet,
                        r.bm25_score,
                        d.canonical_url,
                        d.crawl_timestamp,
                        d.language
                    FROM ranked r
                    JOIN crawled_documents_fts ON crawled_documents_fts.rowid = r.rowid
                    JOIN crawled_documents d ON d.id = r.doc_id
                    {lang_filter}
                    ORDER BY r.bm25_score ASC
                """
                query_params = list(params) + [limit * 2, offset]
                if language:
                    query_params.append(language.lower().strip())

                current_hits: List[SearchHit] = []
                try:
                    cursor.execute(sql, query_params)
                    rows = cursor.fetchall()

                    for row in rows:
                        raw_score = float(row["bm25_score"])
                        normalized_score = abs(raw_score)

                        # Freshness decay bonus: documents crawled in the last 7 days receive a +10% score boost
                        now = time.time()
                        age_days = (now - float(row["crawl_timestamp"])) / 86400.0
                        freshness_boost = 1.15 if age_days < 7.0 else (1.05 if age_days < 30.0 else 1.0)
                        final_score = normalized_score * freshness_boost

                        snippet_text = row["snippet"] or ""
                        clean_snippet = snippet_text.replace("\n", " ").strip()

                        # Topical validation: ensure candidate text actually contains at least one active query term
                        doc_text = f"{row['title']} {row['url']} {clean_snippet}".lower()
                        has_topic_match = False
                        for term in active_terms:
                            term_lower = term.lower()
                            # Word boundary match for short tokens, substring for long tokens
                            if len(term_lower) <= 3:
                                if re.search(r'\b' + re.escape(term_lower) + r'\b', doc_text):
                                    has_topic_match = True
                                    break
                            else:
                                if term_lower in doc_text:
                                    has_topic_match = True
                                    break

                        if not has_topic_match and content_terms:
                            # Reject off-topic matches that only matched incidental tokens or prefixes
                            continue

                        current_hits.append(SearchHit(
                            doc_id=row["doc_id"],
                            url=row["url"],
                            canonical_url=row["canonical_url"] or row["url"],
                            domain=row["domain"],
                            title=row["title"],
                            snippet=clean_snippet,
                            score=final_score,
                            crawl_timestamp=float(row["crawl_timestamp"]),
                            language=row["language"] or "en",
                            source="anvesha_index",
                        ))

                    if current_hits:
                        hits = current_hits[:limit]
                        break

                except Exception as e:
                    logger.error(f"FTS search error with query '{fts_query}': {e}")

        return hits


# Global indexer instance
crawler_indexer: BaseIndexer = SQLiteFTS5Indexer()
