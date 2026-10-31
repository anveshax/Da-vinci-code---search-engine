"""
Anvesha Adaptive AI Operating System: Adaptive Intelligence & Self-Optimization APIs.
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from app.core.adaptive_classifier import AdaptiveTaskClassifier
from app.core.model_router import model_router
from app.core.self_optimizer import SelfOptimizer
from app.core.db import PlatformDB, get_db_connection

router = APIRouter(prefix="/adaptive", tags=["Adaptive AI OS"])


class ClassifyTaskRequest(BaseModel):
    prompt: str = Field(..., description="The user prompt, query, or task goal")
    user_layout_preference: Optional[str] = Field(None, description="Manual layout override if requested")
    user_provider_preference: Optional[str] = Field(None, description="Manual provider override")
    user_model_preference: Optional[str] = Field(None, description="Manual model override")


class RecommendationActionRequest(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected)$", description="Approval decision")
    reviewed_by: str = Field("administrator", description="Identifier of the human reviewer")


@router.post("/classify")
def classify_task(req: ClassifyTaskRequest):
    """
    Intelligently analyzes prompt to determine:
    - Task complexity (simple, moderate, complex, autonomous)
    - Appropriate model & configured provider
    - Required specialized agents & tools
    - Organizational memory requirements
    - Recommended adaptive workspace layout
    - Human approval guardrail requirement & risk score
    """
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")
    
    return AdaptiveTaskClassifier.classify_task(
        prompt=req.prompt,
        user_layout_preference=req.user_layout_preference,
        user_provider_preference=req.user_provider_preference,
        user_model_preference=req.user_model_preference
    )


@router.get("/router-status")
def get_router_status():
    """
    Returns multi-factor model router telemetry, capability matrices, and provider health.
    """
    return model_router.get_router_status()


@router.get("/optimization-report")
def get_optimization_report():
    """
    Runs real diagnostic analysis over execution history, telemetry, and error logs.
    Returns structured optimization recommendations with strict human review guardrail.
    """
    return SelfOptimizer.generate_system_health_and_optimization_report()


@router.post("/recommendations/{rec_id}/action")
def act_on_recommendation(rec_id: str, req: RecommendationActionRequest):
    """
    Human administrator approval/rejection for an optimization recommendation.
    """
    res = PlatformDB.update_optimization_recommendation_status(
        rec_id=rec_id,
        new_status=req.decision,
        reviewed_by=req.reviewed_by
    )
    if not res:
        raise HTTPException(status_code=404, detail="Recommendation not found.")
    return {
        "success": True,
        "recommendation": res,
        "message": f"Optimization recommendation '{res['title']}' was {req.decision} by {req.reviewed_by}."
    }


@router.get("/intent-logs")
def get_intent_logs(limit: int = 15):
    """
    Returns recent adaptive intent logs.
    """
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM adaptive_intent_logs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
