"""
Anvesha AI Provider Management REST API.

Provides secure endpoints for:
- Viewing configured provider statuses (keys are masked: never returned in cleartext!)
- Saving, testing, and switching providers (Gemini, Groq, OpenRouter, OpenAI-compatible)
- Testing live connectivity with latency reporting
- Setting default and fallback priority
- Removing provider credentials
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.ai_provider import ai_provider, create_provider_instance, DEFAULT_MODELS, DEFAULT_BASE_URLS

router = APIRouter(prefix="/ai-providers", tags=["AI Providers"])


class SaveProviderRequest(BaseModel):
    provider_id: str = Field(..., description="gemini | groq | openrouter | openai_compatible")
    api_key: str = Field(..., description="API Key (masked on subsequent reads)")
    model: Optional[str] = Field(None, description="Model identifier")
    base_url: Optional[str] = Field(None, description="Custom base URL for OpenAI-compatible endpoints")
    is_default: Optional[bool] = Field(False)
    is_fallback: Optional[bool] = Field(False)


class TestConnectionRequest(BaseModel):
    provider_id: str = Field(..., description="gemini | groq | openrouter | openai_compatible")
    api_key: Optional[str] = Field(None, description="Optional key to test before saving")
    model: Optional[str] = Field(None)
    base_url: Optional[str] = Field(None)


@router.get("/status")
def get_providers_status():
    """
    Returns public status of all configured AI providers.
    API keys are strictly masked (e.g. 'sk-****...1234') and never exposed.
    """
    return {
        "providers": ai_provider.get_public_provider_status(),
        "active_info": ai_provider.get_provider_info(),
        "defaults": {
            "models": DEFAULT_MODELS,
            "base_urls": DEFAULT_BASE_URLS,
        },
    }


@router.post("/save")
def save_provider(payload: SaveProviderRequest):
    """
    Saves or updates provider credentials securely in backend SQLite storage.
    """
    pid = payload.provider_id.lower().strip()
    if pid not in ("gemini", "groq", "openrouter", "openai_compatible"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported provider. Must be one of: gemini, groq, openrouter, openai_compatible"
        )

    ai_provider.save_provider_config(
        provider_id=pid,
        api_key=payload.api_key.strip(),
        model=payload.model,
        base_url=payload.base_url,
        is_default=payload.is_default or False,
        is_fallback=payload.is_fallback or False,
    )

    return {
        "message": f"Provider '{pid}' configuration saved securely.",
        "providers": ai_provider.get_public_provider_status(),
    }


@router.post("/test")
async def test_provider_connection(payload: TestConnectionRequest):
    """
    Tests live connectivity to an AI provider with the provided or saved key,
    measuring latency and returning meaningful error messages.
    """
    pid = payload.provider_id.lower().strip()
    key = payload.api_key

    # If no key passed in payload, look up saved key
    if not key:
        saved_cfgs = ai_provider.get_configured_providers()
        key = saved_cfgs.get(pid, {}).get("api_key", "")

    if not key:
        raise HTTPException(status_code=400, detail=f"No API key provided or found for '{pid}'.")

    model = payload.model or DEFAULT_MODELS.get(pid, "default")
    base_url = payload.base_url or DEFAULT_BASE_URLS.get(pid, "")

    test_instance = create_provider_instance(pid, key, model, base_url)
    health = await test_instance.check_health()
    return health


@router.delete("/{provider_id}")
def remove_provider(provider_id: str):
    """Removes stored credentials for a provider."""
    pid = provider_id.lower().strip()
    removed = ai_provider.remove_provider(pid)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Provider '{pid}' not found.")
    return {
        "message": f"Provider '{pid}' removed.",
        "providers": ai_provider.get_public_provider_status(),
    }
