"""
SQLite-Backed Vector Storage & Semantic Search Engine for ANVESHA.

Stores dense embedding vectors as binary float32 blobs directly within SQLite,
guaranteeing zero external C-library dependencies, cross-platform stability,
ACID transactions, and fast in-memory cosine similarity scanning.
"""
import time
import json
import struct
import logging
import re
from typing import List, Dict, Any, Optional, Tuple

from app.core.db import get_db_connection
from engine.semantic.embeddings import BaseEmbeddingProvider, get_embedding_provider
from engine.semantic.chunker import DocumentChunk, DocumentChunker

logger = logging.getLogger(__name__)


def normalize_url_canonical(url: str, canonical_url: Optional[str] = None) -> str:
    """Canonicalizes a URL for deduplication across aliases and version prefixes."""
    target = (canonical_url or url or "").strip().lower()
    # Strip protocol and www
    target = re.sub(r"^https?://", "", target)
    target = re.sub(r"^www\.", "", target)
    # Strip fragments and tracking queries
    target = target.split("#")[0]
    target = re.sub(r"\?utm_[^&]+", "", target).rstrip("?")
    # Strip trailing slashes
    target = target.rstrip("/")
    # Normalize Python documentation version aliases (e.g. docs.python.org/3.15/ -> docs.python.org/3/)
    target = re.sub(r"^docs\.python\.org/3\.\d+(/|$)", r"docs.python.org/3\1", target)
    return target


class VectorHit:
    """Represents a scored passage match from semantic vector search."""

    def __init__(
        self,
        chunk_id: str,
        document_id: str,
        url: str,
        canonical_url: str,
        domain: str,
        title: str,
        heading_context: str,
        content: str,
        score: float,
        created_at: float,
    ):
        self.chunk_id = chunk_id
        self.document_id = document_id
        self.url = url
        self.canonical_url = canonical_url
        self.domain = domain
        self.title = title
        self.heading_context = heading_context
        self.content = content
        self.score = score
        self.created_at = created_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "url": self.url,
            "canonical_url": self.canonical_url,
            "domain": self.domain,
            "title": self.title,
            "heading_context": self.heading_context,
            "snippet": self.content,
            "score": round(self.score, 4),
            "created_at": self.created_at,
            "is_internal_index": True,
            "retrieval_method": "semantic",
        }


class SQLiteVectorStore:
    """
    Production-ready Vector Store integrated with ANVESHA's SQLite intelligence database.
    """

    def __init__(self, embedding_provider: Optional[BaseEmbeddingProvider] = None):
        self.provider = embedding_provider or get_embedding_provider()
        self.chunker = DocumentChunker()
        self._ensure_tables()

    def _ensure_tables(self):
        """Creates crawled_document_chunks table and indexes if not already present."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS crawled_document_chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    canonical_url TEXT,
                    domain TEXT NOT NULL,
                    title TEXT NOT NULL,
                    headings TEXT,
                    heading_context TEXT,
                    content TEXT NOT NULL,
                    char_count INTEGER NOT NULL,
                    word_count INTEGER NOT NULL,
                    content_hash TEXT NOT NULL,
                    embedding_blob BLOB,
                    embedding_model TEXT,
                    embedding_dim INTEGER,
                    created_at REAL NOT NULL,
                    FOREIGN KEY (document_id) REFERENCES crawled_documents(id) ON DELETE CASCADE
                );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON crawled_document_chunks(document_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_url ON crawled_document_chunks(url);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_domain ON crawled_document_chunks(domain);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_hash ON crawled_document_chunks(content_hash);")
            conn.commit()

    @staticmethod
    def pack_vector(vec: List[float]) -> bytes:
        """Serializes float list to compact binary IEEE 754 float32 bytes."""
        return struct.pack(f"{len(vec)}f", *vec)

    @staticmethod
    def unpack_vector(blob: bytes, dim: int) -> List[float]:
        """Deserializes binary bytes back to float list."""
        if not blob or len(blob) != dim * 4:
            return []
        return list(struct.unpack(f"{dim}f", blob))

    def index_document_passages(
        self,
        document_id: str,
        url: str,
        domain: str,
        title: str,
        content: str,
        headings: Optional[List[str]] = None,
        canonical_url: Optional[str] = None,
    ) -> int:
        """
        Chunks an extracted document, embeds passages incrementally,
        and saves vectors into SQLite. Avoids recalculating embeddings
        if chunk content hashes are unchanged.
        """
        chunks = self.chunker.chunk_document(
            document_id=document_id,
            url=url,
            domain=domain,
            title=title,
            content=content,
            headings=headings,
            canonical_url=canonical_url,
        )

        if not chunks:
            return 0

        # Check existing hashes to avoid redundant embedding calls
        hash_to_blob: Dict[str, bytes] = {}
        with get_db_connection() as conn:
            cursor = conn.cursor()
            hashes = [c.content_hash for c in chunks]
            placeholders = ",".join("?" for _ in hashes)
            cursor.execute(
                f"SELECT content_hash, embedding_blob FROM crawled_document_chunks WHERE content_hash IN ({placeholders}) AND embedding_blob IS NOT NULL",
                hashes,
            )
            for row in cursor.fetchall():
                hash_to_blob[row["content_hash"]] = row["embedding_blob"]

        # Identify chunks needing fresh embeddings
        missing_chunks: List[DocumentChunk] = []
        for c in chunks:
            if c.content_hash not in hash_to_blob:
                missing_chunks.append(c)

        if missing_chunks:
            # Generate embeddings in batch
            # Prepend title and context for higher semantic precision
            texts_to_embed = [
                f"{c.title} — {c.heading_context}\n{c.content}" for c in missing_chunks
            ]
            try:
                embeddings = self.provider.embed_batch(texts_to_embed)
                for c, vec in zip(missing_chunks, embeddings):
                    hash_to_blob[c.content_hash] = self.pack_vector(vec)
            except Exception as exc:
                logger.error(f"Failed to generate embeddings for document {document_id}: {exc}")
                # Fallback to local hash provider if primary fails
                from engine.semantic.embeddings import LocalHashEmbeddingProvider
                fallback_p = LocalHashEmbeddingProvider(dimension=self.provider.dimension)
                embeddings = fallback_p.embed_batch(texts_to_embed)
                for c, vec in zip(missing_chunks, embeddings):
                    hash_to_blob[c.content_hash] = self.pack_vector(vec)

        # Atomic database update
        now = time.time()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Delete old chunks for this document
            cursor.execute("DELETE FROM crawled_document_chunks WHERE document_id = ?", (document_id,))

            # Insert new chunks
            for c in chunks:
                blob = hash_to_blob.get(c.content_hash)
                cursor.execute(
                    """
                    INSERT INTO crawled_document_chunks (
                        id, document_id, chunk_index, url, canonical_url, domain,
                        title, headings, heading_context, content, char_count,
                        word_count, content_hash, embedding_blob, embedding_model,
                        embedding_dim, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        c.id,
                        c.document_id,
                        c.chunk_index,
                        c.url,
                        c.canonical_url,
                        c.domain,
                        c.title,
                        json.dumps(c.headings),
                        c.heading_context,
                        c.content,
                        c.char_count,
                        c.word_count,
                        c.content_hash,
                        blob,
                        self.provider.model,
                        self.provider.dimension,
                        now,
                    ),
                )
            conn.commit()

        return len(chunks)

    def search(
        self,
        query: str,
        domain_filter: Optional[str] = None,
        limit: int = 10,
        min_similarity: float = 0.52,
    ) -> List[VectorHit]:
        """
        Executes dense semantic vector retrieval over indexed passage chunks.
        Computes cosine similarities in memory against stored normalized vectors.
        """
        if not query or not query.strip():
            return []

        try:
            # 1. Embed query
            query_vec = self.provider.embed_text(query.strip())
            if not query_vec:
                return []
        except Exception as exc:
            logger.warning(f"Semantic query embedding failed: {exc}")
            return []

        dim = self.provider.dimension
        model_name = self.provider.model
        fmt = f"{dim}f"

        # 2. Fetch candidate chunks (strictly isolate by model/dimension to prevent contamination)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # First attempt: match both dimension and exact embedding model
            if domain_filter:
                cursor.execute(
                    """
                    SELECT id, document_id, url, canonical_url, domain, title,
                           heading_context, content, embedding_blob, created_at
                    FROM crawled_document_chunks
                    WHERE domain = ? AND embedding_blob IS NOT NULL
                      AND embedding_dim = ? AND embedding_model = ?
                    """,
                    (domain_filter.lower().strip(), dim, model_name),
                )
            else:
                cursor.execute(
                    """
                    SELECT id, document_id, url, canonical_url, domain, title,
                           heading_context, content, embedding_blob, created_at
                    FROM crawled_document_chunks
                    WHERE embedding_blob IS NOT NULL
                      AND embedding_dim = ? AND embedding_model = ?
                    """,
                    (dim, model_name),
                )

            rows = cursor.fetchall()

            # Second attempt: if no model-isolated rows found, check matching dimension with general/hash model
            if not rows:
                if domain_filter:
                    cursor.execute(
                        """
                        SELECT id, document_id, url, canonical_url, domain, title,
                               heading_context, content, embedding_blob, created_at
                        FROM crawled_document_chunks
                        WHERE domain = ? AND embedding_blob IS NOT NULL AND embedding_dim = ?
                        """,
                        (domain_filter.lower().strip(), dim),
                    )
                else:
                    cursor.execute(
                        """
                        SELECT id, document_id, url, canonical_url, domain, title,
                               heading_context, content, embedding_blob, created_at
                        FROM crawled_document_chunks
                        WHERE embedding_blob IS NOT NULL AND embedding_dim = ?
                        """,
                        (dim,),
                    )
                rows = cursor.fetchall()

        if not rows:
            return []

        # 3. Calculate cosine similarity
        # Since vectors are L2-normalized during embedding, dot product == cosine similarity.
        scored: List[Tuple[float, Any]] = []
        for r in rows:
            blob = r["embedding_blob"]
            if not blob or len(blob) != dim * 4:
                continue
            chunk_vec = struct.unpack(fmt, blob)
            sim = sum(q * c for q, c in zip(query_vec, chunk_vec))
            if sim >= min_similarity:
                scored.append((sim, r))

        # 4. Rank descending by similarity score
        scored.sort(key=lambda x: x[0], reverse=True)

        # 5. Build ranked hits list with URL canonical deduplication
        hits: List[VectorHit] = []
        seen_canonical_keys = set()

        for sim, r in scored:
            url = r["url"]
            canon_key = normalize_url_canonical(url, r["canonical_url"])
            if canon_key in seen_canonical_keys:
                continue
            seen_canonical_keys.add(canon_key)

            hits.append(
                VectorHit(
                    chunk_id=r["id"],
                    document_id=r["document_id"],
                    url=url,
                    canonical_url=r["canonical_url"] or url,
                    domain=r["domain"],
                    title=r["title"],
                    heading_context=r["heading_context"] or r["title"],
                    content=r["content"],
                    score=float(sim),
                    created_at=float(r["created_at"]),
                )
            )
            if len(hits) >= limit:
                break

        return hits

    def backfill_crawled_documents(self, limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Backfills passage chunks and embeddings for existing crawled documents
        that have not yet been chunked into crawled_document_chunks.
        """
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT d.id, d.url, d.canonical_url, d.domain, d.title, d.content, d.headings
                FROM crawled_documents d
                LEFT JOIN (
                    SELECT DISTINCT document_id FROM crawled_document_chunks
                ) c ON d.id = c.document_id
                WHERE c.document_id IS NULL
                ORDER BY d.crawl_timestamp DESC
                """
            )
            rows = cursor.fetchall()

        target_rows = rows[:limit] if limit else rows
        total_backfilled_docs = 0
        total_chunks_created = 0

        for r in target_rows:
            try:
                headings = json.loads(r["headings"] or "[]")
            except Exception:
                headings = []

            count = self.index_document_passages(
                document_id=r["id"],
                url=r["url"],
                domain=r["domain"],
                title=r["title"],
                content=r["content"],
                headings=headings,
                canonical_url=r["canonical_url"],
            )
            total_backfilled_docs += 1
            total_chunks_created += count

        return {
            "documents_processed": total_backfilled_docs,
            "chunks_created": total_chunks_created,
            "total_pending_remaining": max(0, len(rows) - total_backfilled_docs),
        }

    def get_model_stats(self) -> Dict[str, Any]:
        """Returns distribution of stored vectors by model and dimension."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT embedding_model, embedding_dim, COUNT(*) as chunk_count
                FROM crawled_document_chunks
                WHERE embedding_blob IS NOT NULL
                GROUP BY embedding_model, embedding_dim
            """)
            rows = cursor.fetchall()
            return {
                "active_provider": self.provider.provider_id,
                "active_model": self.provider.model,
                "active_dim": self.provider.dimension,
                "stored_models": [
                    {
                        "model": r["embedding_model"],
                        "dimension": r["embedding_dim"],
                        "chunk_count": r["chunk_count"],
                    }
                    for r in rows
                ],
            }

    def count_chunks(self) -> int:
        """Returns total passage chunks in the vector index."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as cnt FROM crawled_document_chunks")
            row = cursor.fetchone()
            return row["cnt"] if row else 0


# Global vector store instance
vector_store = SQLiteVectorStore()
