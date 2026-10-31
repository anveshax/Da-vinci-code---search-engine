"""
Hybrid Retrieval & Reciprocal Rank Fusion (RRF) Engine for ANVESHA.

Concurrently executes:
1. SQLite FTS5 BM25 keyword search over crawled_documents_fts
2. Semantic dense vector search over crawled_document_chunks
Merges ranked lists using parameter-free Reciprocal Rank Fusion (RRF),
ensuring robust performance across both exact code/keyword queries
and complex semantic questions.
"""
import time
import asyncio
import logging
from typing import List, Dict, Any, Optional

from engine.crawler.indexer import crawler_indexer, SearchHit, BaseIndexer
from engine.semantic.vector_store import vector_store, SQLiteVectorStore, VectorHit, normalize_url_canonical

logger = logging.getLogger(__name__)


class HybridHit:
    """Represents a fused document result with full ranking provenance."""

    def __init__(
        self,
        doc_id: str,
        url: str,
        canonical_url: str,
        domain: str,
        title: str,
        snippet: str,
        score: float,
        bm25_score: Optional[float] = None,
        bm25_rank: Optional[int] = None,
        semantic_score: Optional[float] = None,
        semantic_rank: Optional[int] = None,
        retrieval_method: str = "hybrid",
        crawl_timestamp: float = 0.0,
        source: str = "ANVESHA Web Intelligence",
    ):
        self.doc_id = doc_id
        self.url = url
        self.canonical_url = canonical_url
        self.domain = domain
        self.title = title
        self.snippet = snippet
        self.score = score
        self.bm25_score = bm25_score
        self.bm25_rank = bm25_rank
        self.semantic_score = semantic_score
        self.semantic_rank = semantic_rank
        self.retrieval_method = retrieval_method
        self.crawl_timestamp = crawl_timestamp
        self.source = source
        self.is_internal_index = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "url": self.url,
            "canonical_url": self.canonical_url,
            "domain": self.domain,
            "title": self.title,
            "snippet": self.snippet,
            "score": round(self.score, 5),
            "bm25_score": round(self.bm25_score, 4) if self.bm25_score is not None else None,
            "bm25_rank": self.bm25_rank,
            "semantic_score": round(self.semantic_score, 4) if self.semantic_score is not None else None,
            "semantic_rank": self.semantic_rank,
            "retrieval_method": self.retrieval_method,
            "crawl_timestamp": self.crawl_timestamp,
            "source": self.source,
            "source_domain": self.domain,
            "is_internal_index": True,
        }


class HybridRetriever:
    """
    Parallel Hybrid Retrieval Engine with Reciprocal Rank Fusion.
    """

    def __init__(
        self,
        fts_indexer: Optional[BaseIndexer] = None,
        v_store: Optional[SQLiteVectorStore] = None,
        rrf_k: int = 60,
        bm25_weight: float = 1.0,
        semantic_weight: float = 1.0,
        semantic_timeout: float = 5.0,
    ):
        self.fts_indexer = fts_indexer or crawler_indexer
        self.vector_store = v_store or vector_store
        self.rrf_k = rrf_k
        self.bm25_weight = bm25_weight
        self.semantic_weight = semantic_weight
        self.semantic_timeout = semantic_timeout

    def _reciprocal_rank_fusion(
        self,
        bm25_hits: List[SearchHit],
        semantic_hits: List[VectorHit],
        limit: int = 10,
    ) -> List[HybridHit]:
        """
        Merges BM25 and Semantic ranked candidate lists using RRF:
        RRF_Score(d) = sum( w_m / (k + rank_m(d)) )
        """
        # doc_key -> metadata dict
        fused_docs: Dict[str, Dict[str, Any]] = {}

        # 1. Process BM25 ranked list
        for rank_idx, hit in enumerate(bm25_hits):
            key = normalize_url_canonical(hit.url, hit.canonical_url)
            rank = rank_idx + 1
            rrf_contrib = self.bm25_weight / (self.rrf_k + rank)

            if key not in fused_docs:
                fused_docs[key] = {
                    "doc_id": hit.doc_id,
                    "url": hit.canonical_url or hit.url,
                    "canonical_url": hit.canonical_url,
                    "domain": hit.domain,
                    "title": hit.title,
                    "snippet": hit.snippet,
                    "rrf_score": rrf_contrib,
                    "bm25_score": hit.score,
                    "bm25_rank": rank,
                    "semantic_score": None,
                    "semantic_rank": None,
                    "methods": {"bm25"},
                    "crawl_timestamp": hit.crawl_timestamp,
                }
            else:
                fused_docs[key]["rrf_score"] += rrf_contrib
                fused_docs[key]["bm25_score"] = hit.score
                fused_docs[key]["bm25_rank"] = rank
                fused_docs[key]["methods"].add("bm25")

        # 2. Process Semantic ranked list
        for rank_idx, hit in enumerate(semantic_hits):
            key = normalize_url_canonical(hit.url, hit.canonical_url)
            rank = rank_idx + 1
            rrf_contrib = self.semantic_weight / (self.rrf_k + rank)

            if key not in fused_docs:
                fused_docs[key] = {
                    "doc_id": hit.document_id,
                    "url": hit.canonical_url or hit.url,
                    "canonical_url": hit.canonical_url,
                    "domain": hit.domain,
                    "title": hit.title,
                    "snippet": hit.content,
                    "rrf_score": rrf_contrib,
                    "bm25_score": None,
                    "bm25_rank": None,
                    "semantic_score": hit.score,
                    "semantic_rank": rank,
                    "methods": {"semantic"},
                    "crawl_timestamp": hit.created_at,
                }
            else:
                fused_docs[key]["rrf_score"] += rrf_contrib
                fused_docs[key]["semantic_score"] = hit.score
                fused_docs[key]["semantic_rank"] = rank
                fused_docs[key]["methods"].add("semantic")
                # Semantic passage is often richer/more targeted than BM25 raw snippet
                if hit.content and len(hit.content) > len(fused_docs[key]["snippet"] or ""):
                    fused_docs[key]["snippet"] = hit.content

        # 3. Sort by combined RRF score descending
        sorted_items = sorted(fused_docs.values(), key=lambda x: x["rrf_score"], reverse=True)

        # 4. Construct HybridHit objects
        hybrid_hits: List[HybridHit] = []
        for item in sorted_items[:limit]:
            methods = item["methods"]
            if "bm25" in methods and "semantic" in methods:
                method_label = "hybrid"
            elif "semantic" in methods:
                method_label = "semantic"
            else:
                method_label = "bm25"

            clean_snippet = item["snippet"].replace("<mark>", "").replace("</mark>", "").strip()
            hybrid_hits.append(
                HybridHit(
                    doc_id=item["doc_id"],
                    url=item["url"],
                    canonical_url=item["canonical_url"],
                    domain=item["domain"],
                    title=item["title"],
                    snippet=clean_snippet,
                    score=item["rrf_score"],
                    bm25_score=item["bm25_score"],
                    bm25_rank=item["bm25_rank"],
                    semantic_score=item["semantic_score"],
                    semantic_rank=item["semantic_rank"],
                    retrieval_method=method_label,
                    crawl_timestamp=item["crawl_timestamp"],
                )
            )

        return hybrid_hits

    def search_sync(
        self,
        query: str,
        domain_filter: Optional[str] = None,
        limit: int = 10,
        enable_semantic: bool = True,
    ) -> List[HybridHit]:
        """Synchronous search executing BM25 and Semantic retrieval concurrently via thread pool."""
        if not query or not query.strip():
            return []

        import concurrent.futures

        bm25_hits = []
        semantic_hits: List[VectorHit] = []

        def _do_bm25():
            try:
                return self.fts_indexer.search(query=query, domain_filter=domain_filter, limit=limit * 2)
            except Exception as e:
                logger.warning(f"BM25 retrieval exception: {e}")
                return []

        def _do_semantic():
            if not enable_semantic:
                return []
            try:
                return self.vector_store.search(query=query, domain_filter=domain_filter, limit=limit * 2)
            except Exception as e:
                logger.warning(f"Semantic vector retrieval exception: {e}")
                return []

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut_bm25 = executor.submit(_do_bm25)
            fut_sem = executor.submit(_do_semantic)
            bm25_hits = fut_bm25.result()
            semantic_hits = fut_sem.result()

        # Fuse with RRF
        return self._reciprocal_rank_fusion(bm25_hits, semantic_hits, limit=limit)

    async def search_async(
        self,
        query: str,
        domain_filter: Optional[str] = None,
        limit: int = 10,
        enable_semantic: bool = True,
    ) -> List[HybridHit]:
        """
        Asynchronous concurrent retrieval. Runs BM25 and Semantic search in parallel
        threads with timeout protection.
        """
        if not query or not query.strip():
            return []

        clean_query = query.strip()

        async def _fetch_bm25():
            try:
                return await asyncio.to_thread(
                    self.fts_indexer.search, query=clean_query, domain_filter=domain_filter, limit=limit * 2
                )
            except Exception as exc:
                logger.warning(f"Async BM25 error: {exc}")
                return []

        async def _fetch_semantic():
            if not enable_semantic:
                return []
            try:
                return await asyncio.wait_for(
                    asyncio.to_thread(
                        self.vector_store.search,
                        query=clean_query,
                        domain_filter=domain_filter,
                        limit=limit * 2,
                    ),
                    timeout=self.semantic_timeout,
                )
            except asyncio.TimeoutError:
                logger.warning(f"Semantic search timed out after {self.semantic_timeout}s. Falling back to BM25.")
                return []
            except Exception as exc:
                logger.warning(f"Async semantic vector search error: {exc}")
                return []

        bm25_task = asyncio.create_task(_fetch_bm25())
        semantic_task = asyncio.create_task(_fetch_semantic())

        bm25_hits, semantic_hits = await asyncio.gather(bm25_task, semantic_task)

        return self._reciprocal_rank_fusion(bm25_hits or [], semantic_hits or [], limit=limit)


# Global hybrid retriever instance
hybrid_retriever = HybridRetriever()
