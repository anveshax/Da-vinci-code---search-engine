"""
ANVESHA Tor Private Network REST API Router.
Handles real Tor daemon status, fail-closed enforcement, and circuit diagnostics.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

from engine.tor_service import tor_service

router = APIRouter(prefix="/tor", tags=["Tor Private Network"])


class TorSettingsRequest(BaseModel):
    fail_closed: Optional[bool] = Field(None, description="Toggle fail-closed guardrail")
    bridges_enabled: Optional[bool] = Field(None, description="Toggle pluggable transports")


@router.get("/status")
def get_tor_status():
    """
    Probes the real local Tor SOCKS5 daemon on 127.0.0.1:9050.
    Never returns fabricated connection states or synthetic nodes.
    """
    return tor_service.probe_tor_daemon()


@router.post("/settings")
def update_tor_settings(payload: TorSettingsRequest):
    """Updates Tor security guardrails."""
    if payload.fail_closed is not None:
        tor_service.set_fail_closed(payload.fail_closed)
    if payload.bridges_enabled is not None:
        tor_service.set_bridges(payload.bridges_enabled)
    return tor_service.probe_tor_daemon()
