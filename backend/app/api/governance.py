"""
Anvesha V2: Central Governance REST API Endpoints.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import PlatformDB
from app.governance.engine import CentralGovernanceEngine
from app.memory.service import OrganizationalMemoryService
from app.agents.registry import AgentRegistry

router = APIRouter(prefix="/governance", tags=["Central Governance"])


class PolicyCreateRequest(BaseModel):
    name: str = Field(..., description="Policy name")
    description: str = Field("", description="Policy explanation")
    target_action: str = Field(..., description="e.g. tool:file_modify, tool:code_exec, network:fetch")
    condition: Dict[str, Any] = Field(default_factory=dict, description="Rule conditions")
    action_type: str = Field(..., description="ALLOW, DENY, or REQUIRE_APPROVAL")
    risk_level: str = Field("medium", description="low, medium, high, critical")


class ResolveApprovalRequest(BaseModel):
    decision: str = Field(..., description="'approved' or 'rejected'")
    reviewed_by: str = Field("administrator", description="Reviewer identity")
    review_reason: str = Field("", description="Justification for decision")


class MemoryCreateRequest(BaseModel):
    memory_type: str = Field(..., description="episodic, semantic, procedural, decision")
    title: str = Field(..., description="Memory title")
    content: str = Field(..., description="Memory content")
    created_by: str = Field("user", description="Author or system origin")
    project_id: str = Field("default", description="Workspace project ID")
    metadata: Dict[str, Any] = Field(default_factory=dict)


@router.get("/agents")
async def list_agents():
    """Lists all registered agents and their current execution status."""
    reg = AgentRegistry.get_instance()
    await reg.initialize()
    agents = PlatformDB.list_agents()
    return {"count": len(agents), "agents": agents}


@router.get("/policies")
def list_policies(active_only: bool = False):
    """Lists platform governance policies."""
    policies = PlatformDB.list_governance_policies(active_only=active_only)
    return {"count": len(policies), "policies": policies}


@router.post("/policies")
def create_policy(payload: PolicyCreateRequest):
    """Creates or updates a governance policy rule."""
    policy = PlatformDB.create_governance_policy(
        name=payload.name,
        target_action=payload.target_action,
        condition=payload.condition,
        action_type=payload.action_type.upper(),
        risk_level=payload.risk_level.lower(),
        description=payload.description
    )
    return policy


@router.get("/approvals")
def list_approval_requests(status: Optional[str] = None, task_id: Optional[str] = None):
    """Lists pending and reviewed human approval requests."""
    approvals = PlatformDB.list_approval_requests(status=status, task_id=task_id)
    return {"count": len(approvals), "approvals": approvals}


@router.post("/approvals/{request_id}/resolve")
def resolve_approval_request(request_id: str, payload: ResolveApprovalRequest):
    """Processes human approval or rejection for a paused high-risk action."""
    if payload.decision not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'.")

    try:
        updated = CentralGovernanceEngine.resolve_human_approval(
            request_id=request_id,
            decision=payload.decision,
            reviewed_by=payload.reviewed_by,
            review_reason=payload.review_reason
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/audit-logs")
def list_audit_logs(task_id: str):
    """Returns the tamper-evident message and governance ledger for a task."""
    logs = PlatformDB.list_agent_messages(task_id=task_id)
    return {"task_id": task_id, "count": len(logs), "logs": logs}


@router.get("/memory")
def query_memory(
    query: str = Query("", description="Search term"),
    memory_type: Optional[str] = Query(None, description="episodic, semantic, procedural, decision"),
    project_id: str = "default",
    limit: int = 10
):
    """Searches shared organizational memory."""
    if query.strip():
        memories = OrganizationalMemoryService.query_memory(
            query=query,
            memory_type=memory_type,
            project_id=project_id,
            limit=limit
        )
    else:
        memories = OrganizationalMemoryService.list_memories(
            project_id=project_id,
            memory_type=memory_type
        )
    return {"count": len(memories), "memories": memories}


@router.post("/memory")
def add_memory(payload: MemoryCreateRequest):
    """Adds a verified entry to organizational memory."""
    try:
        mem = OrganizationalMemoryService.add_memory(
            memory_type=payload.memory_type,
            title=payload.title,
            content=payload.content,
            created_by=payload.created_by,
            metadata=payload.metadata,
            project_id=payload.project_id
        )
        return mem
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
