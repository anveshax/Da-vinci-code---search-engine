import os
import platform
import sys
import time
from datetime import datetime, timezone
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
