"""
Anvesha V2: Multi-Agent Orchestration REST & Streaming API Endpoints.
"""
import asyncio
import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.orchestrator.orchestrator import MultiAgentOrchestrator
from app.core.db import PlatformDB

router = APIRouter(prefix="/orchestrator", tags=["Multi-Agent Orchestrator"])
logger = logging.getLogger(__name__)

orchestrator = MultiAgentOrchestrator()


class CreateTaskRequest(BaseModel):
    goal: str = Field(..., description="High-level goal for the multi-agent system")
    project_id: str = Field("default", description="Workspace project ID")
    conversation_id: Optional[str] = Field(None, description="Optional conversation thread ID")


class ResumeTaskRequest(BaseModel):
    decision: str = Field("approved", description="'approved' or 'rejected'")
    reason: Optional[str] = Field("", description="Optional human review rationale")


@router.post("/tasks")
async def create_multi_agent_task(payload: CreateTaskRequest, background_tasks: BackgroundTasks):
    """
    Initializes a new multi-agent orchestration task, plans the DAG, and kicks off execution.
    """
    if not payload.goal.strip():
        raise HTTPException(status_code=400, detail="Goal cannot be empty.")

    task = await orchestrator.create_and_plan_task(
        goal=payload.goal,
        project_id=payload.project_id,
        conversation_id=payload.conversation_id
    )
    task_id = task["id"]

    # Start task execution in background
    background_tasks.add_task(orchestrator.execute_task, task_id)

    return {
        "status": "planned",
        "task_id": task_id,
        "goal": payload.goal,
        "steps_count": len(task.get("steps", [])),
        "steps": task.get("steps", []),
    }


@router.get("/tasks")
def list_multi_agent_tasks(project_id: str = "default", limit: int = 20):
    """
    Lists recent multi-agent orchestration tasks.
    """
    return PlatformDB.list_multi_agent_tasks(project_id=project_id, limit=limit)


@router.get("/tasks/{task_id}")
def get_multi_agent_task(task_id: str):
    """
    Retrieves full details of a multi-agent task including steps and final output.
    """
    task = PlatformDB.get_multi_agent_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    return task


@router.get("/tasks/{task_id}/stream")
async def stream_task_execution(task_id: str):
    """
    Server-Sent Events (SSE) stream broadcasting real-time agent execution events.
    """
    task = PlatformDB.get_multi_agent_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    async def sse_event_generator():
        # Stream polling until completed, paused, or failed
        last_step_statuses: Dict[str, str] = {}
        timeout_seconds = 180
        start_time = asyncio.get_event_loop().time()

        yield f"event: task_info\ndata: {json.dumps(task)}\n\n"

        while True:
            current = PlatformDB.get_multi_agent_task(task_id)
            if not current:
                break

            # Check steps progress
            for s in current.get("steps", []):
                sid = s["id"]
                st = s["status"]
                if last_step_statuses.get(sid) != st:
                    last_step_statuses[sid] = st
                    payload = {
                        "task_id": task_id,
                        "step_id": sid,
                        "step_index": s["step_index"],
                        "title": s["title"],
                        "assigned_agent_id": s["assigned_agent_id"],
                        "status": st,
                        "governance_status": s.get("governance_status"),
                        "output": s.get("output_payload"),
                    }
                    yield f"event: step_update\ndata: {json.dumps(payload)}\n\n"

            # Check task status
            task_status = current.get("status")
            if task_status in {"completed", "failed", "paused_approval"}:
                yield f"event: task_status\ndata: {json.dumps({'task_id': task_id, 'status': task_status, 'final_output': current.get('final_output')})}\n\n"
                break

            # Timeout check
            if asyncio.get_event_loop().time() - start_time > timeout_seconds:
                yield f"event: timeout\ndata: {json.dumps({'error': 'Stream timed out after 3 minutes'})}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/tasks/{task_id}/resume")
async def resume_multi_agent_task(task_id: str, background_tasks: BackgroundTasks):
    """
    Resumes a task that was paused awaiting human approval.
    """
    task = PlatformDB.get_multi_agent_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    background_tasks.add_task(orchestrator.execute_task, task_id)
    return {"status": "resuming", "task_id": task_id}


@router.post("/tasks/{task_id}/cancel")
def cancel_multi_agent_task(task_id: str):
    """Cancels a running or paused multi-agent task."""
    task = PlatformDB.get_multi_agent_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    PlatformDB.update_multi_agent_task(task_id, status="cancelled")
    return {"status": "cancelled", "task_id": task_id}


@router.get("/workflows/templates")
def list_workflow_templates():
    """Lists pre-built multi-agent workflow templates."""
    from app.orchestrator.workflow_engine import workflow_engine
    return {"templates": workflow_engine.list_templates()}


class InstantiateWorkflowRequest(BaseModel):
    template_id: str
    goal: str
    project_id: str = "default"
    parameters: Optional[Dict[str, Any]] = None


@router.post("/workflows/instantiate")
async def instantiate_workflow_template(payload: InstantiateWorkflowRequest, background_tasks: BackgroundTasks):
    """Instantiates a multi-agent workflow template and starts execution."""
    from app.orchestrator.workflow_engine import workflow_engine
    try:
        task = await workflow_engine.instantiate_workflow(
            template_id=payload.template_id,
            goal=payload.goal,
            project_id=payload.project_id,
            user_params=payload.parameters,
        )
        task_id = task["id"]
        background_tasks.add_task(orchestrator.execute_task, task_id)
        return {
            "status": "instantiated",
            "task_id": task_id,
            "template_id": payload.template_id,
            "steps_count": len(task.get("steps", [])),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/tools")
def list_sandboxed_tools():
    """Lists all registered tools with parameter schemas and required permissions."""
    from app.orchestrator.tool_registry import tool_registry
    return {"tools": tool_registry.list_tools()}
