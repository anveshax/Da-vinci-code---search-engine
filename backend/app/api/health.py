import os
import platform
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/health", tags=["System Health"])

# Record server boot time
SERVER_START_TIME = time.time()


class SystemTelemetry(BaseModel):
    python_version: str
    os_platform: str
    process_id: int
    uptime_seconds: float
    workspace_root: str


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    telemetry: SystemTelemetry


@router.get("", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """
    Returns live system telemetry and health status of the backend server.
    All data is read directly from host runtime metrics.
    """
    uptime = round(time.time() - SERVER_START_TIME, 2)
    current_time = datetime.now(timezone.utc).isoformat()

    telemetry = SystemTelemetry(
        python_version=sys.version.split()[0],
        os_platform=f"{platform.system()} {platform.release()} ({platform.machine()})",
        process_id=os.getpid(),
        uptime_seconds=uptime,
        workspace_root=settings.WORKSPACE_ROOT,
    )

    return HealthResponse(
        status="healthy",
        service="codebase-intelligence-engine-api",
        timestamp=current_time,
        telemetry=telemetry,
    )


@router.get("/integrations")
async def get_integrations_health() -> Dict[str, Any]:
    """
    Returns live health, latency, and quota telemetry for all 6 external intelligence providers
    (GitHub, OpenAlex, Jina AI, Firecrawl, Google Maps, Groq) with credentials securely masked.
    """
    from engine.integrations import provider_registry
    return await provider_registry.check_all_providers()


@router.get("/integrations/usage")
def get_integrations_usage() -> Dict[str, Any]:
    """Returns aggregated API call counts, unit consumption, and estimated costs in USD."""
    from engine.integrations import cost_tracker
    return cost_tracker.get_summary()


@router.post("/integrations/{provider_id}/toggle")
def toggle_provider(provider_id: str, enabled: bool) -> Dict[str, Any]:
    """Dynamically enables or disables an external provider to prevent cost overruns."""
    from engine.integrations import provider_registry
    provider_registry.set_enabled(provider_id, enabled)
    return {
        "provider_id": provider_id,
        "enabled": provider_registry.is_enabled(provider_id),
        "status": "updated",
    }
