"""
ANVESHA Personas REST API Router.
Handles Angel AI and Devil AI configuration and creator inquiries.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.core.persona import persona_engine, PERSONA_PROFILES

router = APIRouter(prefix="/personas", tags=["Personas"])


class PersonaUpdateRequest(BaseModel):
    persona_mode: str = Field(..., description="'auto', 'force_angel', or 'force_devil'")
    is_dark_theme: Optional[bool] = Field(True, description="Current client theme")


@router.get("/settings")
def get_persona_settings():
    """Returns saved persona mode, active persona, and profiles for Angel and Devil AI."""
    settings = persona_engine.get_settings()
    active_id = settings.get("active_persona", "angel")
    return {
        "settings": settings,
        "active_profile": persona_engine.get_persona_profile(active_id),
        "profiles": PERSONA_PROFILES,
    }


@router.post("/settings")
def update_persona_settings(payload: PersonaUpdateRequest):
    """Updates user persona mode preference and resolves active persona."""
    updated = persona_engine.update_settings(
        persona_mode=payload.persona_mode,
        is_dark_theme=payload.is_dark_theme if payload.is_dark_theme is not None else True
    )
    active_id = updated.get("active_persona", "angel")
    return {
        "message": f"Persona set to {updated['persona_mode']} ({active_id.upper()})",
        "settings": updated,
        "active_profile": persona_engine.get_persona_profile(active_id),
    }
