"""
Anvesha Document & File Intelligence REST API.

Provides endpoints for:
- Uploading and parsing documents (PDF, DOCX, Markdown, Text, Code)
- Safe sandboxed file processing and chunking
- Document-scoped and repository-scoped semantic Q&A with citations
"""
import os
import re
import uuid
import logging
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, status
from pydantic import BaseModel, Field

from app.core.db import PlatformDB
from app.core.ai_provider import ai_provider
from engine.document_parser import parse_uploaded_document, DocumentParseError

router = APIRouter(prefix="/documents", tags=["Document Intelligence"])

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB limit

ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".txt", ".md", ".py", ".ts", ".tsx",
    ".js", ".jsx", ".json", ".csv", ".yaml", ".yml",
    ".html", ".css", ".rs", ".go", ".java", ".cpp", ".c",
}


class DocumentQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    project_id: Optional[str] = Field("default")
    limit: Optional[int] = Field(5, ge=1, le=20)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    project_id: str = Form("default"),
):
    """
    Uploads a document, extracts text, computes page/line tagged chunks,
    and stores them persistently in SQLite.
    """
    raw_name = file.filename or "uploaded_document.txt"
    ext = os.path.splitext(raw_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported extensions: {sorted(list(ALLOWED_EXTENSIONS))}"
        )

    # Sanitize filename (prevent path traversal)
    clean_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", os.path.basename(raw_name))

    try:
        content_bytes = await file.read()
        file_size = len(content_bytes)

        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB"
            )

        # Parse document into chunks
        chunks = parse_uploaded_document(clean_name, content_bytes)
        if not chunks:
            raise HTTPException(status_code=400, detail="No readable text content could be extracted from this file.")

        doc_id = str(uuid.uuid4())
        doc = PlatformDB.save_document(
            doc_id=doc_id,
            project_id=project_id,
            filename=clean_name,
            file_type=ext.lstrip("."),
            file_size=file_size,
            chunks=chunks,
        )

        return {
            "message": f"Successfully uploaded and indexed '{clean_name}'",
            "document": doc,
        }
    except DocumentParseError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@router.get("")
def list_documents(project_id: str = Query("default")):
    """Lists all uploaded documents within a workspace project."""
    return {"documents": PlatformDB.list_documents(project_id)}


@router.get("/{document_id}")
def get_document(document_id: str):
    """Retrieves document details and its indexed chunks."""
    doc = PlatformDB.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"document": doc}


@router.delete("/{document_id}")
def delete_document(document_id: str):
    """Deletes an uploaded document and its chunks."""
    success = PlatformDB.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted successfully"}


@router.post("/query")
async def query_documents(payload: DocumentQueryRequest):
    """
    Searches document chunks and generates an AI answer citing pages and line ranges.
    """
    chunks = PlatformDB.search_document_chunks(
        query=payload.query,
        project_id=payload.project_id or "default",
        limit=payload.limit or 5,
    )

    if not chunks:
        return {
            "query": payload.query,
            "answer": "No relevant document passages found matching your query.",
            "citations": [],
            "chunks": [],
        }

    # Format context passages
    citations = []
    context_lines = ["### Referenced Document Passages:"]
    for idx, c in enumerate(chunks, 1):
        page_info = f"Page {c['page_number']}" if c.get("page_number") else ""
        line_info = f"Lines {c['line_start']}-{c['line_end']}" if c.get("line_start") else ""
        location = ", ".join(filter(None, [page_info, line_info])) or "General"

        citation_entry = {
            "type": "document",
            "title": c["filename"],
            "location": location,
            "snippet": c["content"][:200],
        }
        citations.append(citation_entry)

        context_lines.append(
            f"[{idx}] Document: {c['filename']} ({location})\n"
            f"```\n{c['content']}\n```\n"
        )

    context_prompt = "\n".join(context_lines)
    system_prompt = (
        "You are Anvesha Document Intelligence Engine.\n"
        "Answer the user's question accurately using ONLY the provided document passages.\n"
        "Cite the document name and page/line numbers when stating facts (e.g. `[Document: spec.pdf, Page 2]`).\n"
        "If the document passages do not contain the answer, honestly state that."
    )

    messages = [
        {"role": "system", "content": context_prompt},
        {"role": "user", "content": payload.query},
    ]

    try:
        answer = await ai_provider.generate_chat_completion(
            messages=messages,
            system_prompt=system_prompt,
            max_tokens=1024,
        )
    except Exception as e:
        logger.warning(f"Document intelligence model call fallback: {e}")
        top_snippet = "\n\n".join(c.get("content", "") for c in chunks[:2])
        answer = f"Based on retrieved document context:\n\n{top_snippet}"

    return {
        "query": payload.query,
        "answer": answer,
        "citations": citations,
        "chunks": chunks,
    }
