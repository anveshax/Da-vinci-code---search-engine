"""
Passage & Document Chunking Engine for ANVESHA Semantic Retrieval.

Splits technical documentation and web pages into coherent, context-preserving
passages with sentence-boundary awareness, configurable overlap, and rich citation metadata.
"""
import re
import hashlib
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict


@dataclass
class DocumentChunk:
    """Represents an indexed passage chunk with full citation lineage."""
    id: str
    document_id: str
    chunk_index: int
    url: str
    canonical_url: str
    domain: str
    title: str
    headings: List[str]
    heading_context: str
    content: str
    char_count: int
    word_count: int
    content_hash: str
    created_at: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DocumentChunker:
    """
    Intelligent sentence & paragraph aware chunker for technical documentation.
    Preserves document title and active section headings for semantic grounding.
    """

    def __init__(
        self,
        min_words: int = 15,
        target_words: int = 160,
        max_words: int = 240,
        overlap_words: int = 30,
        max_chunks_per_doc: int = 40,
    ):
        self.min_words = min_words
        self.target_words = target_words
        self.max_words = max_words
        self.overlap_words = overlap_words
        self.max_chunks_per_doc = max_chunks_per_doc

    def _split_into_sentences(self, text: str) -> List[str]:
        """Splits a paragraph into natural sentences."""
        # Clean excessive whitespace
        normalized = re.sub(r"[ \t]+", " ", text).strip()
        if not normalized:
            return []
        # Split on sentence terminals while keeping punctuation
        sentences = re.split(r"(?<=[.!?])\s+", normalized)
        return [s.strip() for s in sentences if s.strip()]

    def chunk_document(
        self,
        document_id: str,
        url: str,
        domain: str,
        title: str,
        content: str,
        headings: Optional[List[str]] = None,
        canonical_url: Optional[str] = None,
        timestamp: Optional[float] = None,
    ) -> List[DocumentChunk]:
        """
        Chunks an extracted document into semantically cohesive passages.
        """
        import time

        now = timestamp or time.time()
        headings_list = headings or []
        heading_ctx = " > ".join(headings_list[:3]) if headings_list else title
        c_url = canonical_url or url

        if not content or not content.strip():
            return []

        # 1. Normalize line endings & split into raw paragraphs
        clean_content = content.replace("\r\n", "\n").strip()
        raw_paragraphs = [p.strip() for p in re.split(r"\n\s*\n", clean_content) if p.strip()]

        # 2. Break down into sentence units
        sentence_units: List[str] = []
        for p in raw_paragraphs:
            p_sentences = self._split_into_sentences(p)
            if p_sentences:
                sentence_units.extend(p_sentences)

        if not sentence_units:
            # Fallback for unbroken text
            sentence_units = [clean_content]

        chunks: List[DocumentChunk] = []
        current_words: List[str] = []
        chunk_idx = 0

        for sentence in sentence_units:
            s_words = sentence.split()
            if not s_words:
                continue

            # If adding this sentence exceeds max_words and we already meet min_words
            if len(current_words) + len(s_words) > self.max_words and len(current_words) >= self.min_words:
                chunk_text = " ".join(current_words)
                content_hash = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()
                chunk_id = f"{document_id}_c{chunk_idx:03d}"

                chunks.append(
                    DocumentChunk(
                        id=chunk_id,
                        document_id=document_id,
                        chunk_index=chunk_idx,
                        url=url,
                        canonical_url=c_url,
                        domain=domain,
                        title=title,
                        headings=headings_list,
                        heading_context=heading_ctx,
                        content=chunk_text,
                        char_count=len(chunk_text),
                        word_count=len(current_words),
                        content_hash=content_hash,
                        created_at=now,
                    )
                )
                chunk_idx += 1

                # Carry over overlap words for semantic continuity
                current_words = current_words[-self.overlap_words :] + s_words

                if chunk_idx >= self.max_chunks_per_doc:
                    break
            else:
                current_words.extend(s_words)

        # Append trailing words as final chunk if substantial
        if current_words and len(current_words) >= self.min_words:
            chunk_text = " ".join(current_words)
            content_hash = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()
            chunk_id = f"{document_id}_c{chunk_idx:03d}"

            chunks.append(
                DocumentChunk(
                    id=chunk_id,
                    document_id=document_id,
                    chunk_index=chunk_idx,
                    url=url,
                    canonical_url=c_url,
                    domain=domain,
                    title=title,
                    headings=headings_list,
                    heading_context=heading_ctx,
                    content=chunk_text,
                    char_count=len(chunk_text),
                    word_count=len(current_words),
                    content_hash=content_hash,
                    created_at=now,
                )
            )

        # If document is short but valid, create a single chunk
        if not chunks and clean_content:
            all_words = clean_content.split()
            if len(all_words) >= 5:
                content_hash = hashlib.sha256(clean_content.encode("utf-8")).hexdigest()
                chunks.append(
                    DocumentChunk(
                        id=f"{document_id}_c000",
                        document_id=document_id,
                        chunk_index=0,
                        url=url,
                        canonical_url=c_url,
                        domain=domain,
                        title=title,
                        headings=headings_list,
                        heading_context=heading_ctx,
                        content=clean_content,
                        char_count=len(clean_content),
                        word_count=len(all_words),
                        content_hash=content_hash,
                        created_at=now,
                    )
                )

        return chunks
