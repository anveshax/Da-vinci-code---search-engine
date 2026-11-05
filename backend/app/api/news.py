"""
FastAPI News Routes for ANVESHA Worldwide News Aggregation Platform.
Provides endpoints for worldwide news, headlines, search, filters, SSE live updates, and AI news intelligence.
"""
import json
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from engine.news import (
    global_news_service,
    ALL_COUNTRIES,
    ALL_LANGUAGES,
    ALL_CATEGORIES,
    FEED_REGISTRY,
    DailyBriefingResponse,
    AskAIStoryResponse,
)

router = APIRouter(prefix="/news", tags=["news"])


class AskAIRequest(BaseModel):
    story_id: str
    question: str


class BriefingRequest(BaseModel):
    topic: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None


@router.get("/worldwide")
async def get_worldwide_news(
    country: Optional[str] = Query(None, description="Country code (e.g. IN, US, GB, JP, WORLD)"),
    language: Optional[str] = Query(None, description="Language code (e.g. en, hi, es, fr, de, ja)"),
    category: Optional[str] = Query(None, description="Category slug (e.g. top, technology, science, finance, india)"),
    sort: str = Query("latest", description="Sort order: 'latest' or 'relevance'"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Returns aggregated worldwide news stories, story clusters, and breaking alerts.
    """
    return await global_news_service.get_worldwide_news(
        country=country,
        language=language,
        category=category,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get("/headlines")
async def get_headlines(
    category: Optional[str] = Query(None, description="Category slug"),
    limit: int = Query(15, ge=1, le=50),
):
    """
    Returns immediate breaking headlines for ticker and top banners.
    """
    return await global_news_service.get_headlines(category=category, limit=limit)


@router.get("/search")
async def search_news(
    q: str = Query(..., min_length=1, description="Search query string"),
    country: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sort: str = Query("latest", description="'latest' or 'relevance'"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Performs full-text multi-source worldwide news search.
    """
    return await global_news_service.search_news(
        query=q,
        country=country,
        language=language,
        category=category,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get("/countries")
def get_countries():
    """
    Returns supported worldwide countries and regions with flags and codes.
    """
    return {"countries": ALL_COUNTRIES}


@router.get("/languages")
def get_languages():
    """
    Returns supported source languages.
    """
    return {"languages": ALL_LANGUAGES}


@router.get("/categories")
def get_categories():
    """
    Returns standard ANVESHA news categories.
    """
    return {"categories": ALL_CATEGORIES}


@router.get("/trending")
async def get_trending_topics():
    """
    Returns top trending event clusters across the globe.
    """
    topics = await global_news_service.get_trending_topics()
    return {"trending": topics}


@router.get("/sources")
def get_sources():
    """
    Returns list of all active registered publisher feeds and providers.
    """
    return {
        "total_sources": len(FEED_REGISTRY) + 2,  # + WorldPulse & Actually Relevant
        "primary_providers": [
            {
                "id": "worldpulse",
                "name": "WorldPulse Public API",
                "type": "public_rest_api",
                "docs": "https://world-pulse.io/developers",
                "quota": "Unlimited public / 200 req/min",
            },
            {
                "id": "actually_relevant",
                "name": "Actually Relevant Public API",
                "type": "public_rest_api",
                "docs": "https://actuallyrelevant.news/developers",
                "quota": "Free public HTTP API",
            },
            {
                "id": "freshrss",
                "name": "FreshRSS Integration",
                "type": "optional_self_hosted",
                "status": "configured" if global_news_service.freshrss.is_configured else "optional_disabled",
            }
        ],
        "feeds": FEED_REGISTRY,
    }


@router.get("/status")
def get_news_status():
    """
    Returns runtime health status, response times, and failure counts for each source.
    """
    return global_news_service.health_monitor.get_summary()


@router.get("/updates")
async def stream_live_updates(request: Request):
    """
    Server-Sent Events (SSE) endpoint broadcasting live feed updates to connected clients.
    """
    async def event_generator():
        queue = global_news_service.scheduler.subscribe()
        try:
            # Yield initial connection confirmation
            yield f"data: {json.dumps({'event': 'connected', 'timestamp': global_news_service.cache.get_last_updated_timestamp()})}\n\n"
            while True:
                # Disconnect check
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat ping
                    yield f": heartbeat\n\n"
        finally:
            global_news_service.scheduler.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/briefing", response_model=DailyBriefingResponse)
async def generate_briefing(body: BriefingRequest):
    """
    Generates an AI multi-source briefing on requested topic or region with source citations.
    """
    return await global_news_service.generate_briefing(
        topic=body.topic,
        country=body.country,
        language=body.language,
    )


@router.post("/ask-ai", response_model=AskAIStoryResponse)
async def ask_ai_about_story(body: AskAIRequest):
    """
    Answers questions about a specific story or event cluster with strict source citations.
    """
    return await global_news_service.ask_ai_about_story(
        story_id=body.story_id,
        question=body.question,
    )
