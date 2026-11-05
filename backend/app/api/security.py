"""
ANVESHA Security Center & Privacy Shield REST API Router.
Handles real security audits, HTTPS enforcement, and security event logs.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

from engine.security_service import security_service
from app.core.db import PlatformDB

router = APIRouter(prefix="/security", tags=["Security Center"])


class SecurityToggleRequest(BaseModel):
    https_enforced: Optional[bool] = None
    webrtc_shield_active: Optional[bool] = None


@router.get("/audit")
def get_security_audit():
    """Runs a real security audit evaluating system posture without hardcoded scores."""
    return security_service.run_security_audit()


@router.post("/audit")
def trigger_security_audit():
    """Manually triggers a fresh security audit."""
    return security_service.run_security_audit()


@router.post("/settings")
def update_security_settings(payload: SecurityToggleRequest):
    """Updates HTTPS enforcement and WebRTC shield options."""
    if payload.https_enforced is not None:
        security_service.toggle_https_enforcement(payload.https_enforced)
    if payload.webrtc_shield_active is not None:
        security_service.toggle_webrtc_shield(payload.webrtc_shield_active)
    return security_service.run_security_audit()


@router.get("/events")
def list_security_events(limit: int = 50):
    """Returns recent security audit events and telemetry."""
    return {"events": PlatformDB.list_security_events(limit=limit)}
