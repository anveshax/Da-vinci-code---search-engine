"""
ANVESHA Deep Research 2.0 & Research Reports Library REST API Router.
Handles 3 research depths (Quick, Deep, Extended), parallel retrieval,
contradiction analysis, report saving, and Markdown export.
"""
import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.db import PlatformDB
from engine.deep_research_engine import deep_research_engine

router = APIRouter(prefix="/research", tags=["Deep Research 2.0"])


class ResearchExecuteRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500)
    depth: Optional[str] = Field("deep", description="'quick', 'deep', or 'extended'")
    persona_id: Optional[str] = Field("angel", description="'angel' or 'devil'")
    project_id: Optional[str] = Field("default")


class ReportRenameRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500)


@router.post("/stream")
async def stream_deep_research(payload: ResearchExecuteRequest):
    """
    Executes multi-stage deep research and streams progress events (SSE):
    - Decomposing query into sub-angles
    - Parallel retrieval across hybrid index & web
    - Contradiction detection
    - Persona-styled report synthesis
    - Final report persistence in SQLite
    """
    async def event_generator():
        async for step in deep_research_engine.execute_research(
            topic=payload.topic,
            depth=payload.depth or "deep",
            persona_id=payload.persona_id or "angel",
            project_id=payload.project_id or "default"
        ):
            yield f"data: {json.dumps(step)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.get("/reports")
def list_reports(q: Optional[str] = None, limit: int = 50):
    """Returns saved research reports from the library."""
    reports = PlatformDB.list_research_reports(query=q, limit=limit)
    return {"reports": reports, "total": len(reports)}


@router.get("/reports/{report_id}")
def get_report(report_id: str):
    """Retrieves full details of a single research report."""
    rep = PlatformDB.get_research_report(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Research report not found")
    return {"report": rep}


@router.put("/reports/{report_id}")
def rename_report(report_id: str, payload: ReportRenameRequest):
    """Renames a saved research report."""
    rep = PlatformDB.rename_research_report(report_id, payload.topic)
    if not rep:
        raise HTTPException(status_code=404, detail="Research report not found")
    return {"report": rep}


@router.delete("/reports/{report_id}")
def delete_report(report_id: str):
    """Deletes a research report from the library."""
    success = PlatformDB.delete_research_report(report_id)
    return {"deleted": success, "report_id": report_id}
