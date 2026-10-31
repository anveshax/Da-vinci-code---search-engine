"""
Adaptive Search & Retrieval Router for ANVESHA.

Dynamically inspects query intent, lexical signals, and complexity to configure
optimal retrieval paths:
- Direct AI reasoning (no web overhead)
- Local Codebase Search
- Internal Documentation Search (BM25 + Semantic)
- External WWW Search (SearXNG / Web providers)
- Multi-Step Deep Research
"""
import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class AdaptiveSearchRouter:
    """
    Intelligent query intent classifier and search pipeline orchestrator.
    Prevents calling expensive external search engines or embeddings for simple or direct queries.
    """

    CODE_PATTERNS = [
        r"\bdef\s+\w+",
        r"\bclass\s+\w+",
        r"\bimport\s+\w+",
        r"\bfrom\s+\w+\s+import",
        r"\bfunction\b",
        r"\bconst\b",
        r"\blet\b",
        r"\binterface\b",
        r"\btype\b",
        r"\.tsx?\b",
        r"\.py\b",
        r"\.jsx?\b",
        r"\btraceback\b",
        r"\berror:\s+",
        r"\bexception\b",
    ]

    FACTUAL_PATTERNS = [
        r"^what is\b",
        r"^who is\b",
        r"^when did\b",
        r"^where is\b",
        r"^define\b",
        r"^meaning of\b",
    ]

    RECENT_PATTERNS = [
        r"\blatest\b",
        r"\brecent\b",
        r"\bnews\b",
        r"\btoday\b",
        r"\b202[5-9]\b",
        r"\bversion 3\.\d+\b",
        r"\bweather\b",
    ]

    DEEP_PATTERNS = [
        r"\bcompare\b",
        r"\btradeoffs?\b",
        r"\banalyze\b",
        r"\barchitecture\b",
        r"\bin-depth\b",
        r"\bcomprehensive\b",
        r"\bbenchmark\b",
        r"\bdeep research\b",
    ]

    def route_query(self, query: str) -> Dict[str, Any]:
        """
        Analyzes the query and returns execution strategy parameters:
        - category: factual | technical | conceptual | recent | programming | deep_research | direct
        - use_internal_bm25: bool
        - use_internal_semantic: bool
        - use_external_web: bool
        - use_searxng: bool
        - retrieval_depth: int
        - rerank_depth: int
        - require_reranking: bool
        - rationale: str
        """
        q_clean = query.strip()
        q_lower = q_clean.lower()

        # 1. Direct AI reasoning / Conversational (e.g. math, greeting, code generation without search)
        if len(q_clean.split()) <= 2 and q_lower in ("hello", "hi", "hey", "ping", "help", "who are you"):
            return {
                "category": "direct",
                "use_internal_bm25": False,
                "use_internal_semantic": False,
                "use_external_web": False,
                "use_searxng": False,
                "retrieval_depth": 0,
                "rerank_depth": 0,
                "require_reranking": False,
                "rationale": "Direct conversational greeting. Search bypassed for ultra-fast response.",
            }

        # 2. Local Codebase / Programming
        if any(re.search(pat, q_lower) for pat in self.CODE_PATTERNS):
            return {
                "category": "programming",
                "use_internal_bm25": True,
                "use_internal_semantic": True,
                "use_external_web": False,
                "use_searxng": False,
                "retrieval_depth": 15,
                "rerank_depth": 10,
                "require_reranking": True,
                "rationale": "Code syntax or file tokens detected. Routed to local codebase scanner & docs.",
            }

        # 3. Deep Research Query
        if any(re.search(pat, q_lower) for pat in self.DEEP_PATTERNS) or len(q_clean.split()) > 14:
            return {
                "category": "deep_research",
                "use_internal_bm25": True,
                "use_internal_semantic": True,
                "use_external_web": True,
                "use_searxng": True,
                "retrieval_depth": 12,
                "rerank_depth": 8,
                "require_reranking": True,
                "rationale": "Complex analytical objective detected. Full multi-source Deep Research activated.",
            }

        # 4. Recent / Temporal Information
        if any(re.search(pat, q_lower) for pat in self.RECENT_PATTERNS):
            return {
                "category": "recent",
                "use_internal_bm25": True,
                "use_internal_semantic": False,
                "use_external_web": True,
                "use_searxng": True,
                "retrieval_depth": 8,
                "rerank_depth": 6,
                "require_reranking": True,
                "rationale": "Recent/temporal keyword detected. External web & SearXNG prioritized for freshness.",
            }

        # 5. Factual / Quick Knowledge
        if any(re.search(pat, q_lower) for pat in self.FACTUAL_PATTERNS):
            return {
                "category": "factual",
                "use_internal_bm25": True,
                "use_internal_semantic": True,
                "use_external_web": True,
                "use_searxng": True,
                "retrieval_depth": 8,
                "rerank_depth": 6,
                "require_reranking": True,
                "rationale": "Factual definition query. Fast hybrid retrieval with calibrated reranking.",
            }

        # 6. Default Technical / Conceptual
        return {
            "category": "technical",
            "use_internal_bm25": True,
            "use_internal_semantic": True,
            "use_external_web": True,
            "use_searxng": True,
            "retrieval_depth": 8,
            "rerank_depth": 6,
            "require_reranking": True,
            "rationale": "Technical query. Parallel BM25, semantic vector retrieval and external search activated.",
        }


# Global router singleton
adaptive_search_router = AdaptiveSearchRouter()
