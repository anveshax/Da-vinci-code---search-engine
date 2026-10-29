from typing import List, Optional, Literal
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import settings
from engine.scanner import CodebaseScanner
from engine.router import classify_query
from engine.web_search import execute_web_search

router = APIRouter(prefix="", tags=["Codebase Search"])

# Initialize scanner with the configured workspace root
scanner = CodebaseScanner(settings.WORKSPACE_ROOT)


class SearchQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200, description="Search term or symbol")
    mode: Optional[Literal["auto", "code", "web"]] = Field("auto", description="Routing mode: 'auto', 'code', or 'web'")
    max_results: Optional[int] = Field(50, ge=1, le=200)


class SearchResultItem(BaseModel):
    file_path: str
    relative_path: str
    line_number: int
    column: int
    match_type: str  # "symbol" | "filename" | "content"
    symbol_name: Optional[str] = None
    snippet: str


class WebSearchResultItem(BaseModel):
    title: str
    url: str
    snippet: str
    source_domain: str


class SearchResponse(BaseModel):
    query: str
    mode_requested: str
    mode_used: str
    routing_reason: Optional[str] = None
    total_matches: int
    workspace_root: str
    results: List[SearchResultItem] = []
    web_results: List[WebSearchResultItem] = []
    web_error: Optional[str] = None


class FileContentResponse(BaseModel):
    relative_path: str
    file_name: str
    content: str
    total_lines: int
    size_bytes: int
    extension: str


@router.post("/search", response_model=SearchResponse)
def search_codebase(payload: SearchQueryRequest) -> SearchResponse:
    """
    Unified search endpoint:
    - Auto: classifies queries locally into code or web
    - Code: searches local workspace files and symbols
    - Web: searches real public internet sources (DuckDuckGo/Wikipedia) with real citations
    """
    req_mode = payload.mode or "auto"
    reason = None

    if req_mode == "auto":
        routing = classify_query(payload.query, settings.WORKSPACE_ROOT)
        mode_used = routing["mode_selected"]
        reason = routing["reason"]
    elif req_mode == "code":
        mode_used = "code"
        reason = "User explicitly forced local codebase search."
    else:
        mode_used = "web"
        reason = "User explicitly forced internet web research."

    code_results: List[SearchResultItem] = []
    web_results: List[WebSearchResultItem] = []
    web_error: Optional[str] = None

    if mode_used == "code":
        # Pure local filesystem search
        matches = scanner.search(payload.query, max_results=payload.max_results or 50)
        code_results = [SearchResultItem(**item) for item in matches]
        total = len(code_results)
    else:
        # Zero-cost real web search
        web_data = execute_web_search(payload.query, max_results=8)
        web_results = [WebSearchResultItem(**w) for w in web_data["results"]]
        web_error = web_data.get("error")
        total = len(web_results)

    return SearchResponse(
        query=payload.query,
        mode_requested=req_mode,
        mode_used=mode_used,
        routing_reason=reason,
        total_matches=total,
        workspace_root=settings.WORKSPACE_ROOT,
        results=code_results,
        web_results=web_results,
        web_error=web_error,
    )


@router.get("/file/content", response_model=FileContentResponse)
def get_file_content(path: str = Query(..., description="Relative path of file inside workspace")) -> FileContentResponse:
    """
    Fetches raw file content securely for code inspection.
    Access is strictly restricted to files within the workspace root.
    """
    result = scanner.get_file_content(path)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"File not found or outside workspace boundaries: '{path}'"
        )

    return FileContentResponse(**result)
