"""
Modular Embedding Provider Engine for ANVESHA.

Supports:
1. Google Gemini Native Embeddings (gemini-embedding-001, gemini-embedding-2)
   with configurable output dimensionality (e.g. 768) and batchEmbedContents.
2. LocalHashEmbeddingProvider: High-speed, zero-dependency local vectorizer
   using feature hashing and character n-grams normalized to unit length.
   Serves as a deterministic offline fallback when API keys are not provided.
"""
import os
import re
import math
import time
import logging
import hashlib
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Automatically load backend/.env and root .env
_backend_env = Path(__file__).resolve().parents[3] / "backend" / ".env"
_root_env = Path(__file__).resolve().parents[4] / ".env"
if _backend_env.exists():
    load_dotenv(_backend_env)
elif _root_env.exists():
    load_dotenv(_root_env)
else:
    load_dotenv()

logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    """Base exception for embedding operations."""
    def __init__(self, message: str, provider: str, status_code: Optional[int] = None, retryable: bool = False):
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code
        self.retryable = retryable


class BaseEmbeddingProvider(ABC):
    """Abstract interface for text embedding providers."""

    def __init__(self, provider_id: str, model: str, dimension: int):
        self.provider_id = provider_id
        self.model = model
        self.dimension = dimension

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Generates an embedding vector for a single text passage."""
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generates embedding vectors for a list of text passages."""
        pass

    @abstractmethod
    def check_health(self) -> Dict[str, Any]:
        """Checks connectivity and credential validity."""
        pass


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """
    Google Gemini REST API Embedding Provider.
    Calls https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent
    and batchEmbedContents.
    """

    SUPPORTED_MODELS = ["gemini-embedding-001", "gemini-embedding-2"]

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-embedding-001",
        dimension: int = 768,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
        max_batch_size: int = 40,
        timeout: float = 12.0,
    ):
        clean_model = model.strip() if model else "gemini-embedding-001"
        if clean_model not in self.SUPPORTED_MODELS:
            logger.warning(
                f"Model '{clean_model}' may not be a verified Gemini embedding model. "
                f"Supported: {self.SUPPORTED_MODELS}. Defaulting to 'gemini-embedding-001'."
            )
            clean_model = "gemini-embedding-001"

        super().__init__(provider_id="gemini", model=clean_model, dimension=dimension)
        self.api_key = api_key or os.getenv("EMBEDDING_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
        self.base_url = base_url.rstrip("/")
        self.max_batch_size = max_batch_size
        self.timeout = timeout
        self._client: Optional[httpx.Client] = None

    def _get_client(self) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(timeout=self.timeout)
        return self._client

    def _get_headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise EmbeddingError("Gemini API key is not configured for embeddings.", self.provider_id, 401)
        return {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    def _normalize_vector(self, vec: List[float]) -> List[float]:
        """Normalizes vector to unit length (L2 norm) so dot product equals cosine similarity."""
        if not vec:
            return [0.0] * self.dimension
        sq_sum = sum(x * x for x in vec)
        if sq_sum <= 0.0:
            return vec
        norm = math.sqrt(sq_sum)
        return [x / norm for x in vec]

    def embed_text(self, text: str) -> List[float]:
        """Embeds a single string with in-memory caching."""
        if not text or not text.strip():
            return [0.0] * self.dimension

        clean_text = text.strip()
        cache_key = f"emb:{self.model}:{self.dimension}:{clean_text}"
        try:
            from engine.cache_engine import embedding_cache
            cached = embedding_cache.get(cache_key, dim=self.dimension)
            if cached is not None:
                return cached
        except Exception:
            pass

        results = self.embed_batch([clean_text])
        if results and len(results) > 0:
            vec = results[0]
            try:
                from engine.cache_engine import embedding_cache
                embedding_cache.set(cache_key, vec)
            except Exception:
                pass
            return vec
        return [0.0] * self.dimension

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embeds a list of strings in batches."""
        if not texts:
            return []

        # Filter and sanitize
        sanitized = [t.strip() if t and t.strip() else " " for t in texts]
        all_embeddings: List[List[float]] = []

        headers = self._get_headers()
        url = f"{self.base_url}/models/{self.model}:batchEmbedContents"

        for i in range(0, len(sanitized), self.max_batch_size):
            batch = sanitized[i : i + self.max_batch_size]
            requests_payload = []
            for t in batch:
                item_req: Dict[str, Any] = {
                    "model": f"models/{self.model}",
                    "content": {"parts": [{"text": t[:4000]}]},
                }
                if self.dimension:
                    item_req["outputDimensionality"] = self.dimension
                requests_payload.append(item_req)

            payload = {"requests": requests_payload}

            # Retry with exponential backoff on transient errors (429, 503)
            max_retries = 3
            backoff = 1.0
            last_err: Optional[Exception] = None

            for attempt in range(max_retries):
                try:
                    client = self._get_client()
                    response = client.post(url, headers=headers, json=payload)

                    if response.status_code == 200:
                        data = response.json()
                        raw_embs = data.get("embeddings", [])
                        for item in raw_embs:
                            vec = item.get("values", [])
                            all_embeddings.append(self._normalize_vector(vec))
                        # Only throttle between consecutive batches during bulk crawl
                        if i + self.max_batch_size < len(sanitized):
                            time.sleep(0.3)
                        break

                    elif response.status_code in (429, 503):
                        logger.warning(
                            f"Gemini embedding batch rate limit/demand ({response.status_code}). "
                            f"Retry {attempt + 1}/{max_retries} in {backoff:.1f}s..."
                        )
                        time.sleep(backoff)
                        backoff *= 2.0
                        continue

                    elif response.status_code in (401, 403):
                        raise EmbeddingError(
                            f"Gemini API key unauthorized: {response.text[:150]}",
                            self.provider_id,
                            response.status_code,
                        )

                    else:
                        raise EmbeddingError(
                            f"Gemini embedding request failed ({response.status_code}): {response.text[:200]}",
                            self.provider_id,
                            response.status_code,
                        )

                except httpx.RequestError as exc:
                    self._client = None
                    last_err = exc
                    logger.warning(f"Network error during Gemini embedding: {exc}. Retrying...")
                    time.sleep(backoff)
                    backoff *= 1.5

            else:
                logger.warning(
                    f"Gemini batch embedding exhausted {max_retries} attempts: {last_err}. "
                    "Falling back to local feature-hash vectorizer for this batch."
                )
                local_fallback = LocalHashEmbeddingProvider(dimension=self.dimension)
                all_embeddings.extend(local_fallback.embed_batch(batch))

        return all_embeddings

    def check_health(self) -> Dict[str, Any]:
        """Validates API credentials with a minimal embedding request."""
        if not self.api_key:
            return {
                "status": "unconfigured",
                "provider": self.provider_id,
                "model": self.model,
                "dimension": self.dimension,
                "message": "GEMINI_API_KEY is not configured.",
            }

        try:
            vec = self.embed_text("health check")
            if vec and len(vec) == self.dimension:
                return {
                    "status": "healthy",
                    "provider": self.provider_id,
                    "model": self.model,
                    "dimension": self.dimension,
                    "message": f"Connected to Google Gemini ({self.model}, dim={self.dimension})",
                }
            return {
                "status": "degraded",
                "provider": self.provider_id,
                "model": self.model,
                "dimension": len(vec) if vec else 0,
                "message": f"Unexpected embedding dimension: {len(vec) if vec else 0}",
            }
        except Exception as exc:
            return {
                "status": "offline",
                "provider": self.provider_id,
                "model": self.model,
                "dimension": self.dimension,
                "error": str(exc),
            }


class OllamaEmbeddingProvider(BaseEmbeddingProvider):
    """
    Local Ollama Embedding Provider.
    Generates dense embeddings offline using local models such as 'nomic-embed-text' (768-dim),
    'mxbai-embed-large' (1024-dim), or 'all-minilm' (384-dim).
    Zero external cloud network calls.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: str = "nomic-embed-text",
        dimension: int = 768,
        timeout: float = 60.0,
        max_batch_size: int = 32,
    ):
        clean_model = model.strip() if model else "nomic-embed-text"
        super().__init__(provider_id="ollama", model=clean_model, dimension=dimension)
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")
        self.timeout = timeout
        self.max_batch_size = max_batch_size
        self._client: Optional[httpx.Client] = None

    def _get_client(self) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(timeout=self.timeout)
        return self._client

    def _normalize_vector(self, vec: List[float]) -> List[float]:
        """Normalizes vector to unit length (L2 norm) for cosine dot product."""
        if not vec:
            return [0.0] * self.dimension
        sq_sum = sum(x * x for x in vec)
        if sq_sum <= 0.0:
            return vec
        norm = math.sqrt(sq_sum)
        return [x / norm for x in vec]

    def embed_text(self, text: str) -> List[float]:
        """Generates embedding for a single text string with caching."""
        if not text or not text.strip():
            return [0.0] * self.dimension

        clean_text = text.strip()
        cache_key = f"emb:ollama:{self.model}:{self.dimension}:{clean_text}"
        try:
            from engine.cache_engine import embedding_cache
            cached = embedding_cache.get(cache_key, dim=self.dimension)
            if cached is not None:
                return cached
        except Exception:
            pass

        results = self.embed_batch([clean_text])
        if results and len(results) > 0:
            vec = results[0]
            try:
                from engine.cache_engine import embedding_cache
                embedding_cache.set(cache_key, vec)
            except Exception:
                pass
            return vec
        return [0.0] * self.dimension

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Embeds a batch of texts using Ollama /api/embed (or fallback /api/embeddings).
        """
        if not texts:
            return []

        sanitized = [t.strip() if t and t.strip() else " " for t in texts]
        all_embeddings: List[List[float]] = []
        client = self._get_client()

        for i in range(0, len(sanitized), self.max_batch_size):
            batch = sanitized[i:i + self.max_batch_size]
            batch_vectors: List[List[float]] = []

            # 1. Try modern Ollama /api/embed (batch endpoint)
            try:
                res = client.post(
                    f"{self.base_url}/api/embed",
                    json={"model": self.model, "input": batch, "keep_alive": "5m"}
                )
                if res.status_code == 200:
                    data = res.json()
                    embs = data.get("embeddings", [])
                    for raw_vec in embs:
                        if len(raw_vec) != self.dimension:
                            self.dimension = len(raw_vec)
                        batch_vectors.append(self._normalize_vector(raw_vec))
                elif res.status_code == 404:
                    # Older Ollama version without /api/embed -> fallback to /api/embeddings sequentially
                    for single_text in batch:
                        single_res = client.post(
                            f"{self.base_url}/api/embeddings",
                            json={"model": self.model, "prompt": single_text, "keep_alive": "5m"}
                        )
                        if single_res.status_code == 200:
                            raw_vec = single_res.json().get("embedding", [])
                            if len(raw_vec) != self.dimension:
                                self.dimension = len(raw_vec)
                            batch_vectors.append(self._normalize_vector(raw_vec))
                        else:
                            raise EmbeddingError(
                                f"Ollama /api/embeddings failed ({single_res.status_code}): {single_res.text[:200]}",
                                "ollama",
                                single_res.status_code
                            )
                else:
                    raise EmbeddingError(
                        f"Ollama /api/embed failed ({res.status_code}): {res.text[:200]}",
                        "ollama",
                        res.status_code
                    )

            except (httpx.ConnectError, httpx.TimeoutException, EmbeddingError) as exc:
                is_strict = os.getenv("LOCAL_AI_STRICT_MODE", "false").lower() in ("true", "1")
                if is_strict:
                    raise EmbeddingError(
                        f"Local Ollama embedding failed: {exc}. Ensure Ollama is running and model '{self.model}' is pulled ('ollama pull {self.model}').",
                        "ollama"
                    )
                logger.warning(
                    f"Ollama embedding unavailable ({exc}). Using deterministic LocalHashEmbeddingProvider fallback."
                )
                fallback = LocalHashEmbeddingProvider(dimension=self.dimension)
                batch_vectors = fallback.embed_batch(batch)

            all_embeddings.extend(batch_vectors)

        return all_embeddings

    def check_health(self) -> Dict[str, Any]:
        """Checks if local Ollama daemon is reachable and whether the embedding model exists."""
        try:
            client = self._get_client()
            res = client.get(f"{self.base_url}/api/tags")
            if res.status_code == 200:
                data = res.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                clean_name = self.model.split(":")[0].lower()
                has_model = any(clean_name in m.lower() for m in models)
                return {
                    "status": "healthy" if has_model else "model_missing",
                    "provider": "ollama",
                    "model": self.model,
                    "dimension": self.dimension,
                    "is_local": True,
                    "message": (
                        f"Local Ollama embedding provider active with model '{self.model}'."
                        if has_model
                        else f"Ollama is running, but embedding model '{self.model}' is not pulled yet. Run: 'ollama pull {self.model}'"
                    )
                }
            else:
                return {
                    "status": "error",
                    "provider": "ollama",
                    "model": self.model,
                    "error": f"Ollama returned HTTP {res.status_code}",
                }
        except Exception as exc:
            return {
                "status": "offline",
                "provider": "ollama",
                "model": self.model,
                "dimension": self.dimension,
                "is_local": True,
                "error": f"Cannot connect to local Ollama at {self.base_url}: {str(exc)}",
            }


class LocalHashEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic Pure-Python Feature-Hashing Embedding Provider.
    Transforms text passages into normalized high-dimensional sparse-dense vectors
    using subwords, character 3-grams, and word tokens.
    
    Guarantees:
    - 0 network requests
    - 0 native dependencies (runs in pure Python standard library)
    - High semantic overlap sensitivity
    - Never throws; 100% offline uptime
    """

    def __init__(self, dimension: int = 768):
        super().__init__(provider_id="local_hash", model="feature-hash-v1", dimension=dimension)

    def _hash_token(self, token: str) -> int:
        """Computes fast deterministic 32-bit FNV-1a hash for a token."""
        h = 2166136261
        for b in token.encode("utf-8"):
            h ^= b
            h = (h * 16777619) & 0xFFFFFFFF
        return h % self.dimension

    def _vectorize(self, text: str) -> List[float]:
        vec = [0.0] * self.dimension
        if not text:
            return vec

        cleaned = text.lower()
        words = re.findall(r"\b\w+\b", cleaned)

        # 1. Word frequency weighting
        for w in words:
            idx = self._hash_token(f"w:{w}")
            vec[idx] += 1.5

        # 2. Word bi-grams for phrase semantics
        for i in range(len(words) - 1):
            bigram = f"bg:{words[i]}_{words[i+1]}"
            idx = self._hash_token(bigram)
            vec[idx] += 2.0

        # 3. Fast character 3-grams for typo-resilience and morphological semantics
        cl_len = len(cleaned)
        for i in range(0, max(0, cl_len - 2), 2):
            idx = self._hash_token(f"c3:{cleaned[i:i+3]}")
            vec[idx] += 0.5

        # Normalize to unit length (L2 norm)
        sq_sum = sum(x * x for x in vec)
        if sq_sum > 0.0:
            norm = math.sqrt(sq_sum)
            vec = [x / norm for x in vec]

        return vec

    def embed_text(self, text: str) -> List[float]:
        return self._vectorize(text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self._vectorize(t) for t in texts]

    def check_health(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "provider": self.provider_id,
            "model": self.model,
            "dimension": self.dimension,
            "message": "Local deterministic hashing vectorizer active (zero-dependency).",
        }


# Global singleton instance cache
_embedding_provider_instance: Optional[BaseEmbeddingProvider] = None


def get_embedding_provider(force_provider: Optional[str] = None) -> BaseEmbeddingProvider:
    """
    Factory function returning the configured embedding provider.
    Reads environment variables:
    - EMBEDDING_PROVIDER ('gemini', 'ollama', or 'local_hash')
    - EMBEDDING_MODEL ('gemini-embedding-001', 'nomic-embed-text', etc.)
    - EMBEDDING_DIM ('768', '1536', '3072')
    - GEMINI_API_KEY
    - OLLAMA_BASE_URL, OLLAMA_EMBED_MODEL
    """
    global _embedding_provider_instance
    if _embedding_provider_instance and not force_provider:
        return _embedding_provider_instance

    provider_name = (force_provider or os.getenv("EMBEDDING_PROVIDER", "gemini")).lower().strip()
    dim = int(os.getenv("EMBEDDING_DIM", "768"))
    gemini_key = os.getenv("EMBEDDING_API_KEY") or os.getenv("GEMINI_API_KEY", "").strip()

    if provider_name == "ollama":
        ollama_model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text").strip()
        ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
        provider = OllamaEmbeddingProvider(base_url=ollama_base_url, model=ollama_model, dimension=dim)
    elif provider_name == "gemini" and gemini_key:
        model = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001").strip()
        provider = GeminiEmbeddingProvider(api_key=gemini_key, model=model, dimension=dim)
    elif provider_name == "local_hash" or not gemini_key:
        if not gemini_key and provider_name == "gemini":
            logger.info("GEMINI_API_KEY not configured for embeddings. Using LocalHashEmbeddingProvider fallback.")
        provider = LocalHashEmbeddingProvider(dimension=dim)
    else:
        provider = LocalHashEmbeddingProvider(dimension=dim)

    if not force_provider:
        _embedding_provider_instance = provider
    return provider
